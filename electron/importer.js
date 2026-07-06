const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { compareAndStoreSnapshot, stableStringify } = require("./diagnostic-snapshots");

const IMPORTER_LAYOUT_VERSION = 3;
const IMPORTER_LAYOUT_VERSION_KEY = "codex_card_feed_importer_layout_version";
const SESSION_INDEX_SIGNATURE_KEY = "codex_card_feed_session_index_signature";
const GLOBAL_STATE_SIGNATURE_KEY = "codex_card_feed_global_state_signature";
const SESSION_DIAGNOSIS_SNAPSHOT_KEY = "diagnostic_snapshot.session_diagnosis";
const SOURCE_FILE_STATUS_ACTIVE = "active";
const SOURCE_FILE_STATUS_MISSING = "missing";
const SOURCE_FILE_STATUS_ERROR = "error";
const KNOWN_TOP_LEVEL_ENTRY_TYPES = new Set([
  "session_meta",
  "turn_context",
  "event_msg",
  "response_item",
  "compacted"
]);
const KNOWN_EVENT_MSG_TYPES = new Set([
  "agent_message",
  "context_compacted",
  "dynamic_tool_call_request",
  "dynamic_tool_call_response",
  "error",
  "exec_command_end",
  "image_generation_end",
  "item_completed",
  "mcp_tool_call_end",
  "patch_apply_end",
  "task_complete",
  "task_started",
  "thread_name_updated",
  "thread_rolled_back",
  "token_count",
  "turn_aborted",
  "user_message",
  "view_image_tool_call",
  "web_search_end"
]);
const KNOWN_RESPONSE_ITEM_TYPES = new Set([
  "custom_tool_call",
  "custom_tool_call_output",
  "function_call",
  "function_call_output",
  "image_generation_call",
  "message",
  "reasoning",
  "tool_search_call",
  "tool_search_output",
  "web_search_call"
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function incrementTypeCount(bucket, key) {
  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}

function createValidationState() {
  return {
    warnings: [],
    errors: [],
    issueKeys: new Set(),
    observedTypes: {
      topLevel: new Map(),
      eventMsg: new Map(),
      responseItem: new Map()
    },
    stats: {
      sessionIndexLineCount: 0,
      validSessionIndexEntryCount: 0,
      invalidSessionIndexLineCount: 0,
      globalStateReadCount: 0
    }
  };
}

function addValidationIssue(validationState, severity, issue) {
  if (!validationState) {
    return;
  }

  const issueKey =
    issue.dedupeKey ??
    [
      severity,
      issue.scope ?? "",
      issue.filePath ?? "",
      issue.code ?? "",
      issue.lineNumber ?? "",
      issue.field ?? "",
      issue.typeName ?? ""
    ].join("|");

  if (validationState.issueKeys.has(issueKey)) {
    return;
  }

  validationState.issueKeys.add(issueKey);

  const entry = {
    scope: issue.scope ?? "import",
    filePath: issue.filePath ?? null,
    code: issue.code ?? "unknown_validation_issue",
    message: issue.message ?? "",
    lineNumber: issue.lineNumber ?? null
  };

  if (severity === "error") {
    validationState.errors.push(entry);
    return;
  }

  validationState.warnings.push(entry);
}

function addValidationWarning(validationState, issue) {
  addValidationIssue(validationState, "warning", issue);
}

function addValidationError(validationState, issue) {
  addValidationIssue(validationState, "error", issue);
}

function toTypeCountRows(typeMap) {
  return [...typeMap.entries()]
    .sort((left, right) => {
      if (left[1] !== right[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([type, count]) => ({
      type,
      count
    }));
}

function buildValidationSummary(validationState) {
  return {
    warningCount: validationState.warnings.length,
    errorCount: validationState.errors.length,
    sessionIndex: {
      lineCount: validationState.stats.sessionIndexLineCount,
      validEntryCount: validationState.stats.validSessionIndexEntryCount,
      invalidLineCount: validationState.stats.invalidSessionIndexLineCount
    },
    globalState: {
      readCount: validationState.stats.globalStateReadCount
    },
    observedTypes: {
      topLevel: toTypeCountRows(validationState.observedTypes.topLevel),
      eventMsg: toTypeCountRows(validationState.observedTypes.eventMsg),
      responseItem: toTypeCountRows(validationState.observedTypes.responseItem)
    }
  };
}

function listValidationLogEntries(validationState) {
  return [
    ...validationState.warnings.map((entry) => ({
      ...entry,
      severity: "warning"
    })),
    ...validationState.errors.map((entry) => ({
      ...entry,
      severity: "error"
    }))
  ];
}

function getDefaultCodexHome() {
  return path.join(os.homedir(), ".codex");
}

function getSessionsRoot(codexHome = getDefaultCodexHome()) {
  return path.join(codexHome, "sessions");
}

function getSessionIndexPath(codexHome = getDefaultCodexHome()) {
  return path.join(codexHome, "session_index.jsonl");
}

function getGlobalStatePath(codexHome = getDefaultCodexHome()) {
  return path.join(codexHome, ".codex-global-state.json");
}

function listSidebarWorkspaceRoots(codexHome = getDefaultCodexHome()) {
  return [...loadCodexStateIndex(codexHome).savedWorkspaceRoots];
}

function getOptionalFileSignature(filePath) {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  const fileStat = fs.statSync(filePath);
  return `${Number(fileStat.size)}:${Math.trunc(fileStat.mtimeMs)}`;
}

function createSourceFileSnapshot(filePath) {
  const fileStat = fs.statSync(filePath);

  return {
    sourcePath: filePath,
    fileSize: Number(fileStat.size),
    modifiedAtMs: Math.trunc(fileStat.mtimeMs),
    modifiedAt: fileStat.mtime.toISOString()
  };
}

function discoverSessionFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...discoverSessionFiles(fullPath));
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function loadSessionIndex(codexHome, validationState = null) {
  const indexPath = getSessionIndexPath(codexHome);
  const sessionIndex = new Map();

  if (!fs.existsSync(indexPath)) {
    return sessionIndex;
  }

  const lines = fs.readFileSync(indexPath, "utf8").split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!line.trim()) {
      continue;
    }

    if (validationState) {
      validationState.stats.sessionIndexLineCount += 1;
    }

    let parsed;

    try {
      parsed = JSON.parse(line);
    } catch {
      if (validationState) {
        validationState.stats.invalidSessionIndexLineCount += 1;
      }
      addValidationWarning(validationState, {
        scope: "session_index",
        filePath: indexPath,
        lineNumber: index + 1,
        code: "session_index_invalid_json_line",
        message: "Skipping invalid JSON line in session_index.jsonl."
      });
      continue;
    }

    if (!isRecord(parsed)) {
      if (validationState) {
        validationState.stats.invalidSessionIndexLineCount += 1;
      }
      addValidationWarning(validationState, {
        scope: "session_index",
        filePath: indexPath,
        lineNumber: index + 1,
        code: "session_index_invalid_entry_shape",
        message: "Skipping non-object entry in session_index.jsonl."
      });
      continue;
    }

    if (!isNonEmptyString(parsed.id)) {
      if (validationState) {
        validationState.stats.invalidSessionIndexLineCount += 1;
      }
      addValidationWarning(validationState, {
        scope: "session_index",
        filePath: indexPath,
        lineNumber: index + 1,
        code: "session_index_missing_id",
        message: "Skipping session index entry without a valid id."
      });
      continue;
    }

    if (parsed.thread_name !== undefined && typeof parsed.thread_name !== "string") {
      addValidationWarning(validationState, {
        scope: "session_index",
        filePath: indexPath,
        lineNumber: index + 1,
        code: "session_index_invalid_thread_name",
        message: "Session index thread_name is not a string; using an empty title."
      });
    }

    if (parsed.updated_at !== undefined && typeof parsed.updated_at !== "string") {
      addValidationWarning(validationState, {
        scope: "session_index",
        filePath: indexPath,
        lineNumber: index + 1,
        code: "session_index_invalid_updated_at",
        message: "Session index updated_at is not a string; using null."
      });
    }

    sessionIndex.set(parsed.id, {
      title: typeof parsed.thread_name === "string" ? parsed.thread_name : "",
      updatedAt: typeof parsed.updated_at === "string" ? parsed.updated_at : null
    });

    if (validationState) {
      validationState.stats.validSessionIndexEntryCount += 1;
    }
  }

  return sessionIndex;
}

function readValidatedStateValue(parsedState, persistedState, key) {
  return parsedState[key] ?? persistedState[key] ?? null;
}

function readValidatedStringArrayValue(
  readStateValue,
  key,
  filePath,
  validationState,
  options = {}
) {
  const value = readStateValue(key);

  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    const message = `${key} must be an array when present in the Codex global state.`;
    addValidationError(validationState, {
      scope: "global_state",
      filePath,
      code: "global_state_invalid_array_field",
      field: key,
      message
    });

    if (options.strict) {
      throw new Error(message);
    }

    return [];
  }

  return value.filter((entry, index) => {
    if (typeof entry === "string" && entry) {
      return true;
    }

    addValidationWarning(validationState, {
      scope: "global_state",
      filePath,
      code: "global_state_invalid_array_entry",
      field: key,
      lineNumber: index + 1,
      message: `${key} contains a non-string entry; it will be ignored.`
    });
    return false;
  });
}

function readValidatedStringMapValue(
  readStateValue,
  key,
  filePath,
  validationState,
  options = {}
) {
  const value = readStateValue(key);

  if (value === null || value === undefined) {
    return {};
  }

  if (!isRecord(value)) {
    const message = `${key} must be an object when present in the Codex global state.`;
    addValidationError(validationState, {
      scope: "global_state",
      filePath,
      code: "global_state_invalid_object_field",
      field: key,
      message
    });

    if (options.strict) {
      throw new Error(message);
    }

    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([entryKey, entryValue]) => {
      if (typeof entryKey === "string" && entryKey && typeof entryValue === "string" && entryValue) {
        return [[entryKey, entryValue]];
      }

      addValidationWarning(validationState, {
        scope: "global_state",
        filePath,
        code: "global_state_invalid_object_entry",
        field: key,
        message: `${key} contains a non-string key/value pair; it will be ignored.`
      });
      return [];
    })
  );
}

function loadCodexStateIndex(codexHome, options = {}) {
  const validationState = options.validationState ?? null;
  const strict = options.strict ?? false;
  const globalStatePath = getGlobalStatePath(codexHome);
  const stateIndex = {
    projectlessThreadIds: new Set(),
    projectlessOutputDirectoryByThreadId: new Map(),
    projectlessWorkspaceRoots: new Set(),
    savedWorkspaceRoots: new Set(),
    threadWorkspaceRootHints: new Map(),
    workspaceRootLabels: new Map()
  };

  if (!fs.existsSync(globalStatePath)) {
    return stateIndex;
  }

  if (validationState) {
    validationState.stats.globalStateReadCount += 1;
  }

  let parsedState;

  try {
    parsedState = JSON.parse(fs.readFileSync(globalStatePath, "utf8"));
  } catch {
    const message = "Codex global state file could not be parsed as JSON.";
    addValidationError(validationState, {
      scope: "global_state",
      filePath: globalStatePath,
      code: "global_state_invalid_json",
      message
    });

    if (strict) {
      throw new Error(message);
    }

    return stateIndex;
  }

  if (!isRecord(parsedState)) {
    const message = "Codex global state root must be an object.";
    addValidationError(validationState, {
      scope: "global_state",
      filePath: globalStatePath,
      code: "global_state_invalid_root",
      message
    });

    if (strict) {
      throw new Error(message);
    }

    return stateIndex;
  }

  const persistedStateRaw = parsedState["electron-persisted-atom-state"];

  if (persistedStateRaw !== undefined && persistedStateRaw !== null && !isRecord(persistedStateRaw)) {
    const message = "electron-persisted-atom-state must be an object when present.";
    addValidationError(validationState, {
      scope: "global_state",
      filePath: globalStatePath,
      code: "global_state_invalid_persisted_state",
      message
    });

    if (strict) {
      throw new Error(message);
    }
  }

  const persistedState = isRecord(persistedStateRaw) ? persistedStateRaw : {};
  const readStateValue = (key) => readValidatedStateValue(parsedState, persistedState, key);
  const savedWorkspaceRoots = [
    ...readValidatedStringArrayValue(
      readStateValue,
      "electron-saved-workspace-roots",
      globalStatePath,
      validationState,
      { strict }
    ),
    ...readValidatedStringArrayValue(
      readStateValue,
      "project-order",
      globalStatePath,
      validationState,
      { strict }
    )
  ];

  for (const workspaceRoot of savedWorkspaceRoots) {
    stateIndex.savedWorkspaceRoots.add(normalizePathForId(workspaceRoot));
  }

  const workspaceRootLabels = readValidatedStringMapValue(
    readStateValue,
    "electron-workspace-root-labels",
    globalStatePath,
    validationState,
    { strict }
  );

  for (const [workspaceRoot, displayName] of Object.entries(workspaceRootLabels)) {
    stateIndex.workspaceRootLabels.set(normalizePathForId(workspaceRoot), displayName.trim());
  }

  for (const threadId of readValidatedStringArrayValue(
    readStateValue,
    "projectless-thread-ids",
    globalStatePath,
    validationState,
    { strict }
  )) {
    stateIndex.projectlessThreadIds.add(threadId);
  }

  for (const [threadId, outputDirectory] of Object.entries(
    readValidatedStringMapValue(
      readStateValue,
      "thread-projectless-output-directories",
      globalStatePath,
      validationState,
      { strict }
    )
  )) {
    stateIndex.projectlessOutputDirectoryByThreadId.set(threadId, outputDirectory);
  }

  for (const [threadId, workspaceRoot] of Object.entries(
    readValidatedStringMapValue(
      readStateValue,
      "thread-workspace-root-hints",
      globalStatePath,
      validationState,
      { strict }
    )
  )) {
    stateIndex.threadWorkspaceRootHints.set(threadId, workspaceRoot);
  }

  for (const threadId of [
    ...stateIndex.projectlessThreadIds,
    ...stateIndex.projectlessOutputDirectoryByThreadId.keys()
  ]) {
    const workspaceRoot = stateIndex.threadWorkspaceRootHints.get(threadId);

    if (workspaceRoot) {
      stateIndex.projectlessWorkspaceRoots.add(normalizePathForId(workspaceRoot));
    }
  }

  return stateIndex;
}

function normalizePathForId(sourcePath) {
  const normalized = path.normalize(sourcePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function normalizePathList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value) => typeof value === "string" && value.trim()).map((value) => path.normalize(value));
}

function isPathInsideDirectory(candidatePath, directoryPath) {
  if (!candidatePath || !directoryPath) {
    return false;
  }

  const normalizedCandidate = normalizePathForId(candidatePath);
  const normalizedDirectory = normalizePathForId(directoryPath);

  return (
    normalizedCandidate === normalizedDirectory ||
    normalizedCandidate.startsWith(`${normalizedDirectory}${path.sep}`)
  );
}

function isProjectlessWorkspacePath(candidatePath, codexStateIndex) {
  if (!candidatePath) {
    return false;
  }

  for (const projectlessWorkspaceRoot of codexStateIndex.projectlessWorkspaceRoots) {
    if (isPathInsideDirectory(candidatePath, projectlessWorkspaceRoot)) {
      return true;
    }
  }

  return false;
}

function toIsoFromUnixSeconds(value) {
  if (typeof value !== "number") {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function extractTextFromMessage(payload) {
  if (Array.isArray(payload.content)) {
    return payload.content
      .map((part) => {
        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  if (typeof payload.text === "string") {
    return payload.text.trim();
  }

  return "";
}

function clipSnippet(text, maxLength = 240) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function isBootstrapUserMessage(text) {
  return text.trimStart().startsWith("# AGENTS.md instructions");
}

function getMessageKind(role, phase, textContent) {
  if (role === "user" && isBootstrapUserMessage(textContent)) {
    return "message:bootstrap_context";
  }

  return phase ? `message:${phase}` : "message";
}

function buildReasoningPayload(payload) {
  const summary = Array.isArray(payload.summary) ? payload.summary : [];
  const encryptedContent =
    typeof payload.encrypted_content === "string" ? payload.encrypted_content : "";

  return {
    summaryCount: summary.length,
    hasContent: payload.content !== null && payload.content !== undefined,
    encryptedLength: encryptedContent.length
  };
}

function createFallbackPreviewSnippet(text, maxLength = 240) {
  if (typeof text !== "string" || isBootstrapUserMessage(text)) {
    return "";
  }

  return clipSnippet(text, maxLength);
}

function compareNullableIso(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left < right ? -1 : 1;
}

function pickEarlierIso(currentValue, nextValue) {
  if (!currentValue) {
    return nextValue ?? null;
  }

  if (!nextValue) {
    return currentValue;
  }

  return nextValue < currentValue ? nextValue : currentValue;
}

function pickLaterIso(currentValue, nextValue) {
  if (!currentValue) {
    return nextValue ?? null;
  }

  if (!nextValue) {
    return currentValue;
  }

  return nextValue > currentValue ? nextValue : currentValue;
}

function pickPreferredText(currentValue, nextValue) {
  const currentText = currentValue ?? "";
  const nextText = nextValue ?? "";

  if (!currentText) {
    return nextText;
  }

  if (!nextText) {
    return currentText;
  }

  return nextText.length > currentText.length ? nextText : currentText;
}

function buildTurnContentHash(items) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        items.map((item) => ({
          role: item.role,
          kind: item.kind,
          textContent: item.textContent
        }))
      )
    )
    .digest("hex");
}

function createEmptyTokenUsage() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    tokenEventCount: 0
  };
}

function normalizeTokenUsage(usage) {
  if (!usage || typeof usage !== "object") {
    return null;
  }

  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    cachedInputTokens: Number(usage.cached_input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    reasoningOutputTokens: Number(usage.reasoning_output_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? 0),
    tokenEventCount: 1
  };
}

function summarizeTokenEvents(tokenEvents) {
  const usage = createEmptyTokenUsage();

  for (const tokenEvent of tokenEvents) {
    usage.inputTokens += tokenEvent.inputTokens;
    usage.cachedInputTokens += tokenEvent.cachedInputTokens;
    usage.outputTokens += tokenEvent.outputTokens;
    usage.reasoningOutputTokens += tokenEvent.reasoningOutputTokens;
    usage.totalTokens += tokenEvent.totalTokens;
    usage.tokenEventCount += 1;
  }

  return usage;
}

function createProjectlessProjectMetadata(codexHome) {
  return {
    projectId: "projectless:local",
    sourceKind: "projectless",
    sourcePath: path.join(codexHome, "threads"),
    displayName: "Projectless Chats"
  };
}

function createWorkspaceProjectMetadata(workspaceRoot, codexStateIndex) {
  const normalizedWorkspaceRoot = normalizePathForId(workspaceRoot);
  const storedDisplayName =
    codexStateIndex.workspaceRootLabels.get(normalizedWorkspaceRoot) ?? null;

  return {
    projectId: `workspace:${normalizedWorkspaceRoot}`,
    sourceKind: "workspace",
    sourcePath: workspaceRoot,
    displayName: storedDisplayName || path.basename(workspaceRoot) || workspaceRoot
  };
}

function isGitBackedPath(directoryPath) {
  if (!directoryPath) {
    return false;
  }

  return fs.existsSync(path.join(directoryPath, ".git"));
}

function getProjectMetadata(threadId, threadCwd, workspaceRoots, codexHome, codexStateIndex) {
  const normalizedWorkspaceRoots = normalizePathList(workspaceRoots);
  const normalizedCwd = threadCwd ? path.normalize(threadCwd) : null;

  if (
    threadId &&
    (codexStateIndex.projectlessThreadIds.has(threadId) ||
      codexStateIndex.projectlessOutputDirectoryByThreadId.has(threadId))
  ) {
    return createProjectlessProjectMetadata(codexHome);
  }

  const workspaceRootHint =
    threadId ? codexStateIndex.threadWorkspaceRootHints.get(threadId) ?? null : null;
  const normalizedWorkspaceRootHint = workspaceRootHint ? path.normalize(workspaceRootHint) : null;
  const savedWorkspaceRoot =
    normalizedWorkspaceRoots.find((workspaceRoot) =>
      codexStateIndex.savedWorkspaceRoots.has(normalizePathForId(workspaceRoot))
    ) ??
    (normalizedWorkspaceRootHint &&
    codexStateIndex.savedWorkspaceRoots.has(normalizePathForId(normalizedWorkspaceRootHint))
      ? normalizedWorkspaceRootHint
      : null) ??
    (codexStateIndex.savedWorkspaceRoots.has(normalizePathForId(normalizedCwd))
      ? normalizedCwd
      : null);

  if (
    normalizedWorkspaceRootHint &&
    codexStateIndex.projectlessWorkspaceRoots.has(
      normalizePathForId(normalizedWorkspaceRootHint)
    )
  ) {
    return createProjectlessProjectMetadata(codexHome);
  }

  if (savedWorkspaceRoot) {
    return createWorkspaceProjectMetadata(savedWorkspaceRoot, codexStateIndex);
  }

  if (!threadCwd) {
    return createProjectlessProjectMetadata(codexHome);
  }

  const normalizedCodexHome = path.normalize(codexHome);
  const disjointWorkspaceRoots = normalizedWorkspaceRoots.filter(
    (workspaceRoot) =>
      !isPathInsideDirectory(workspaceRoot, normalizedCwd) &&
      !isPathInsideDirectory(normalizedCwd, workspaceRoot)
  );
  const preferredDisjointWorkspaceRoot =
    disjointWorkspaceRoots.find((workspaceRoot) => isGitBackedPath(workspaceRoot)) ??
    disjointWorkspaceRoots[0] ??
    null;

  if (preferredDisjointWorkspaceRoot) {
    return createWorkspaceProjectMetadata(preferredDisjointWorkspaceRoot, codexStateIndex);
  }

  if (workspaceRootHint) {
    return createWorkspaceProjectMetadata(normalizedWorkspaceRootHint, codexStateIndex);
  }

  const gitBackedWorkspaceRoot =
    normalizedWorkspaceRoots.find((workspaceRoot) => isGitBackedPath(workspaceRoot)) ??
    (isGitBackedPath(normalizedCwd) ? normalizedCwd : null);

  if (gitBackedWorkspaceRoot) {
    return createWorkspaceProjectMetadata(gitBackedWorkspaceRoot, codexStateIndex);
  }

  if (
    isProjectlessWorkspacePath(normalizedCwd, codexStateIndex) ||
    normalizedWorkspaceRoots.some((workspaceRoot) =>
      isProjectlessWorkspacePath(workspaceRoot, codexStateIndex)
    )
  ) {
    return createProjectlessProjectMetadata(codexHome);
  }

  if (normalizePathForId(normalizedCwd).startsWith(normalizePathForId(normalizedCodexHome))) {
    return createProjectlessProjectMetadata(codexHome);
  }

  const containingWorkspaceRoots = normalizedWorkspaceRoots.filter((workspaceRoot) =>
    isPathInsideDirectory(normalizedCwd, workspaceRoot)
  );

  if (containingWorkspaceRoots.length) {
    const projectRoot = [...containingWorkspaceRoots].sort(
      (left, right) => left.length - right.length
    )[0];

    if (
      containingWorkspaceRoots.every(
        (workspaceRoot) =>
          isPathInsideDirectory(workspaceRoot, normalizedCwd) ||
          isPathInsideDirectory(normalizedCwd, workspaceRoot)
      )
    ) {
      return createProjectlessProjectMetadata(codexHome);
    }

    return createWorkspaceProjectMetadata(projectRoot, codexStateIndex);
  }

  return createWorkspaceProjectMetadata(normalizedCwd, codexStateIndex);
}

function createTurnState(turnId, ordinal) {
  return {
    id: turnId,
    ordinal,
    startedAt: null,
    completedAt: null,
    status: "in_progress",
    firstUserSnippet: "",
    fallbackUserSnippet: "",
    itemCounter: 0,
    items: [],
    tokenEvents: []
  };
}

function resolveResponseItemTurnId(payload, activeTurnId) {
  const explicitTurnId = payload.internal_chat_message_metadata_passthrough?.turn_id;

  if (explicitTurnId) {
    return explicitTurnId;
  }

  return activeTurnId ?? null;
}

function parseSessionFile(
  filePath,
  sessionIndex,
  codexHome,
  codexStateIndex,
  fileSnapshot = null,
  validationState = null
) {
  const sourceFileSnapshot = fileSnapshot ?? createSourceFileSnapshot(filePath);
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split(/\r?\n/).filter((line) => line.trim());
  const lastSeenAt = sourceFileSnapshot.modifiedAt;

  let sessionId = null;
  let threadCwd = null;
  let threadCreatedAt = null;
  let threadWorkspaceRoots = [];
  const turns = new Map();
  const turnOrder = [];
  let fallbackPreview = "";
  let activeTurnId = null;

  function failValidation(code, message, lineNumber = null) {
    addValidationError(validationState, {
      scope: "session_file",
      filePath,
      lineNumber,
      code,
      message
    });

    return {
      ok: false,
      code,
      reason: message,
      filePath
    };
  }

  function warnValidation(code, message, lineNumber = null, typeName = null) {
    addValidationWarning(validationState, {
      scope: "session_file",
      filePath,
      lineNumber,
      code,
      typeName,
      message
    });
  }

  function ensureTurn(turnId) {
    if (!turns.has(turnId)) {
      const turn = createTurnState(turnId, turnOrder.length + 1);
      turns.set(turnId, turn);
      turnOrder.push(turnId);
    }

    return turns.get(turnId);
  }

  function addTurnItem(turnId, role, kind, textContent, rawPayload, createdAt) {
    const turn = ensureTurn(turnId);
    turn.itemCounter += 1;

    turn.items.push({
      id: `${turnId}:${turn.itemCounter}`,
      turnId,
      ordinal: turn.itemCounter,
      role,
      kind,
      textContent,
      rawJson: rawPayload ? JSON.stringify(rawPayload) : null,
      createdAt
    });

    if (role === "user" && !turn.firstUserSnippet && textContent) {
      turn.fallbackUserSnippet = createFallbackPreviewSnippet(textContent);
    }
  }

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    let parsed;

    try {
      parsed = JSON.parse(line);
    } catch {
      return failValidation(
        "session_file_invalid_json_line",
        "Session file contains an invalid JSON line.",
        lineNumber
      );
    }

    if (!isRecord(parsed)) {
      return failValidation(
        "session_file_invalid_entry_shape",
        "Session file entry must be an object.",
        lineNumber
      );
    }

    if (!isNonEmptyString(parsed.type)) {
      return failValidation(
        "session_file_missing_entry_type",
        "Session file entry is missing a valid type.",
        lineNumber
      );
    }

    incrementTypeCount(validationState.observedTypes.topLevel, parsed.type);

    if (!KNOWN_TOP_LEVEL_ENTRY_TYPES.has(parsed.type)) {
      warnValidation(
        "session_file_unknown_top_level_type",
        `Encountered unknown top-level session entry type "${parsed.type}".`,
        lineNumber,
        parsed.type
      );
      continue;
    }

    if (parsed.type === "session_meta") {
      if (!isRecord(parsed.payload)) {
        return failValidation(
          "session_meta_invalid_payload",
          "session_meta payload must be an object.",
          lineNumber
        );
      }

      const resolvedSessionId = parsed.payload.session_id ?? parsed.payload.id ?? null;

      if (!isNonEmptyString(resolvedSessionId)) {
        return failValidation(
          "session_meta_missing_session_id",
          "session_meta must include payload.session_id or payload.id as a string.",
          lineNumber
        );
      }

      if (parsed.payload.cwd !== undefined && parsed.payload.cwd !== null && typeof parsed.payload.cwd !== "string") {
        warnValidation(
          "session_meta_invalid_cwd",
          "session_meta payload.cwd is not a string; ignoring it.",
          lineNumber
        );
      }

      if (
        parsed.payload.workspace_roots !== undefined &&
        parsed.payload.workspace_roots !== null &&
        !Array.isArray(parsed.payload.workspace_roots)
      ) {
        warnValidation(
          "session_meta_invalid_workspace_roots",
          "session_meta payload.workspace_roots is not an array; ignoring it.",
          lineNumber
        );
      }

      sessionId = resolvedSessionId;
      threadCwd = typeof parsed.payload.cwd === "string" ? parsed.payload.cwd : threadCwd;
      threadCreatedAt = parsed.payload.timestamp ?? parsed.timestamp ?? threadCreatedAt;
      if (!threadWorkspaceRoots.length) {
        threadWorkspaceRoots = normalizePathList(parsed.payload.workspace_roots);
      }
      continue;
    }

    if (parsed.type === "turn_context") {
      if (!isRecord(parsed.payload)) {
        return failValidation(
          "turn_context_invalid_payload",
          "turn_context payload must be an object.",
          lineNumber
        );
      }

      if (!isNonEmptyString(parsed.payload.turn_id)) {
        return failValidation(
          "turn_context_missing_turn_id",
          "turn_context must include payload.turn_id as a string.",
          lineNumber
        );
      }

      if (
        parsed.payload.workspace_roots !== undefined &&
        parsed.payload.workspace_roots !== null &&
        !Array.isArray(parsed.payload.workspace_roots)
      ) {
        warnValidation(
          "turn_context_invalid_workspace_roots",
          "turn_context payload.workspace_roots is not an array; ignoring it.",
          lineNumber
        );
      }

      const turn = ensureTurn(parsed.payload.turn_id);
      turn.startedAt = pickEarlierIso(turn.startedAt, parsed.timestamp);
      if (!threadWorkspaceRoots.length) {
        threadWorkspaceRoots = normalizePathList(parsed.payload.workspace_roots);
      }
      continue;
    }

    if (parsed.type === "event_msg") {
      if (!isRecord(parsed.payload)) {
        return failValidation(
          "event_msg_invalid_payload",
          "event_msg payload must be an object.",
          lineNumber
        );
      }

      const payload = parsed.payload;

      if (!isNonEmptyString(payload.type)) {
        return failValidation(
          "event_msg_missing_type",
          "event_msg must include payload.type as a string.",
          lineNumber
        );
      }

      incrementTypeCount(validationState.observedTypes.eventMsg, payload.type);

      if (!KNOWN_EVENT_MSG_TYPES.has(payload.type)) {
        warnValidation(
          "event_msg_unknown_type",
          `Encountered unknown event_msg payload.type "${payload.type}".`,
          lineNumber,
          payload.type
        );
      }

      if (payload.turn_id !== undefined && payload.turn_id !== null && !isNonEmptyString(payload.turn_id)) {
        return failValidation(
          "event_msg_invalid_turn_id",
          "event_msg payload.turn_id must be a string when present.",
          lineNumber
        );
      }

      if (payload.type === "user_message") {
        if (typeof payload.message !== "string") {
          return failValidation(
            "event_msg_invalid_user_message",
            "event_msg user_message must include payload.message as a string.",
            lineNumber
          );
        }

        const turnId = payload.turn_id ?? activeTurnId;

        if (turnId) {
          const turn = ensureTurn(turnId);
          const previewSnippet = clipSnippet(payload.message);

          if (previewSnippet) {
            turn.firstUserSnippet = turn.firstUserSnippet || previewSnippet;

            if (!fallbackPreview) {
              fallbackPreview = previewSnippet;
            }
          }
        } else {
          warnValidation(
            "event_msg_unresolved_user_message_turn",
            "event_msg user_message could not be attached to a turn.",
            lineNumber
          );
        }

        continue;
      }

      if (payload.turn_id) {
        const turn = ensureTurn(payload.turn_id);

        if (payload.type === "task_started") {
          activeTurnId = payload.turn_id;
          turn.startedAt = pickEarlierIso(
            turn.startedAt,
            toIsoFromUnixSeconds(payload.started_at) ?? parsed.timestamp
          );
        } else if (payload.type === "task_complete") {
          turn.completedAt = pickLaterIso(
            turn.completedAt,
            toIsoFromUnixSeconds(payload.completed_at) ?? parsed.timestamp
          );
          turn.status = "completed";

          if (activeTurnId === payload.turn_id) {
            activeTurnId = null;
          }
        }

        continue;
      }

      if (payload.type === "token_count" && activeTurnId) {
        const usage = normalizeTokenUsage(payload.info?.last_token_usage);

        if (usage) {
          const turn = ensureTurn(activeTurnId);
          turn.tokenEvents.push({
            id: [
              activeTurnId,
              parsed.timestamp ?? "",
              usage.inputTokens,
              usage.cachedInputTokens,
              usage.outputTokens,
              usage.reasoningOutputTokens,
              usage.totalTokens
            ].join(":"),
            createdAt: parsed.timestamp ?? null,
            ...usage
          });
        }
      }

      continue;
    }

    if (parsed.type !== "response_item") {
      if (parsed.type === "compacted" && parsed.payload !== undefined && parsed.payload !== null && !isRecord(parsed.payload)) {
        warnValidation(
          "compacted_invalid_payload",
          "compacted payload is not an object; ignoring it.",
          lineNumber
        );
      }
      continue;
    }

    if (!isRecord(parsed.payload)) {
      return failValidation(
        "response_item_invalid_payload",
        "response_item payload must be an object.",
        lineNumber
      );
    }

    const payload = parsed.payload;

    if (!isNonEmptyString(payload.type)) {
      return failValidation(
        "response_item_missing_type",
        "response_item must include payload.type as a string.",
        lineNumber
      );
    }

    incrementTypeCount(validationState.observedTypes.responseItem, payload.type);

    if (!KNOWN_RESPONSE_ITEM_TYPES.has(payload.type)) {
      warnValidation(
        "response_item_unknown_type",
        `Encountered unknown response_item payload.type "${payload.type}".`,
        lineNumber,
        payload.type
      );
    }

    const turnId = resolveResponseItemTurnId(payload, activeTurnId);

    if (!turnId) {
      warnValidation(
        "response_item_unresolved_turn_id",
        "response_item could not be attached to a turn and was skipped.",
        lineNumber,
        payload.type
      );
      continue;
    }

    if (payload.type === "message") {
      if (payload.role !== undefined && payload.role !== null && typeof payload.role !== "string") {
        warnValidation(
          "response_item_invalid_message_role",
          "response_item message role is not a string; defaulting to assistant.",
          lineNumber
        );
      }

      if (
        payload.content !== undefined &&
        payload.content !== null &&
        !Array.isArray(payload.content) &&
        typeof payload.text !== "string"
      ) {
        warnValidation(
          "response_item_unrecognized_message_shape",
          "response_item message text shape is unrecognized; storing empty text.",
          lineNumber
        );
      }

      const textContent = extractTextFromMessage(payload);
      const role = payload.role ?? "assistant";
      addTurnItem(
        turnId,
        role,
        getMessageKind(role, payload.phase ?? null, textContent),
        textContent,
        {
          id: payload.id ?? null,
          phase: payload.phase ?? null,
          content: payload.content ?? null
        },
        parsed.timestamp
      );

      if (role === "user" && !fallbackPreview && textContent) {
        fallbackPreview = createFallbackPreviewSnippet(textContent);
      }

      continue;
    }

    if (payload.type === "reasoning") {
      addTurnItem(
        turnId,
        "assistant",
        "reasoning",
        "",
        buildReasoningPayload(payload),
        parsed.timestamp
      );

      continue;
    }

    const kind = payload.type;
    const role = kind.endsWith("_output") || kind === "function_call_output" ? "tool" : "assistant";
    const textContent =
      typeof payload.output === "string"
        ? payload.output
        : typeof payload.arguments === "string"
          ? payload.arguments
          : typeof payload.name === "string"
            ? payload.name
            : "";

    addTurnItem(turnId, role, kind, textContent, payload, parsed.timestamp);
  }

  if (!sessionId) {
    return failValidation(
      "session_file_missing_session_meta",
      "Session file does not contain a valid session_meta entry."
    );
  }

  const titleEntry = sessionIndex.get(sessionId);
  const project = getProjectMetadata(
    sessionId,
    threadCwd,
    threadWorkspaceRoots,
    codexHome,
    codexStateIndex
  );
  const normalizedTurns = turnOrder.map((turnId) => {
    const turn = turns.get(turnId);
    const firstUserSnippet = turn.firstUserSnippet || turn.fallbackUserSnippet;

    return {
      id: turn.id,
      threadId: sessionId,
      ordinal: turn.ordinal,
      startedAt: turn.startedAt,
      completedAt: turn.completedAt,
      status: turn.status,
      firstUserSnippet,
      contentHash: buildTurnContentHash(turn.items),
      lastSeenAt,
      tokenUsage: summarizeTokenEvents(turn.tokenEvents),
      tokenEvents: turn.tokenEvents,
      items: turn.items
    };
  });

  const preview =
    normalizedTurns.find((turn) => turn.firstUserSnippet)?.firstUserSnippet ??
    fallbackPreview;

  return {
    ok: true,
    project,
    thread: {
      id: sessionId,
      projectId: project.projectId,
      sourceCwd: threadCwd,
      sourceSessionPath: filePath,
      sourceKind: "codex_session_jsonl",
      title: titleEntry?.title || preview || path.basename(filePath, ".jsonl"),
      preview,
      createdAt: threadCreatedAt,
      updatedAt: titleEntry?.updatedAt ?? lastSeenAt,
      lastSeenAt
    },
    turns: normalizedTurns
  };
}

function mergeTurnSnapshots(turns, threadId) {
  const turnsById = new Map();

  for (const turn of turns) {
    if (!turnsById.has(turn.id)) {
      turnsById.set(turn.id, {
        id: turn.id,
        threadId,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
        status: turn.status,
        firstUserSnippet: turn.firstUserSnippet,
        lastSeenAt: turn.lastSeenAt,
        items: new Map(turn.items.map((item) => [item.id, { ...item }])),
        tokenEvents: new Map(turn.tokenEvents.map((tokenEvent) => [tokenEvent.id, { ...tokenEvent }]))
      });
      continue;
    }

    const mergedTurn = turnsById.get(turn.id);
    mergedTurn.startedAt = pickEarlierIso(mergedTurn.startedAt, turn.startedAt);
    mergedTurn.completedAt = pickLaterIso(mergedTurn.completedAt, turn.completedAt);
    mergedTurn.status =
      mergedTurn.completedAt || turn.status === "completed"
        ? "completed"
        : mergedTurn.status;
    mergedTurn.firstUserSnippet = pickPreferredText(
      mergedTurn.firstUserSnippet,
      turn.firstUserSnippet
    );
    mergedTurn.lastSeenAt = pickLaterIso(mergedTurn.lastSeenAt, turn.lastSeenAt);

    for (const item of turn.items) {
      if (!mergedTurn.items.has(item.id)) {
        mergedTurn.items.set(item.id, { ...item });
        continue;
      }

      const mergedItem = mergedTurn.items.get(item.id);
      mergedItem.ordinal = Math.min(mergedItem.ordinal, item.ordinal);
      mergedItem.textContent = pickPreferredText(
        mergedItem.textContent,
        item.textContent
      );
      mergedItem.rawJson = pickPreferredText(mergedItem.rawJson, item.rawJson);
      mergedItem.createdAt = pickEarlierIso(mergedItem.createdAt, item.createdAt);
    }

    for (const tokenEvent of turn.tokenEvents) {
      if (!mergedTurn.tokenEvents.has(tokenEvent.id)) {
        mergedTurn.tokenEvents.set(tokenEvent.id, { ...tokenEvent });
      }
    }
  }

  return [...turnsById.values()]
    .map((turn) => {
      const items = [...turn.items.values()]
        .sort((left, right) => {
          if (left.ordinal !== right.ordinal) {
            return left.ordinal - right.ordinal;
          }

          const createdAtOrder = compareNullableIso(left.createdAt, right.createdAt);

          if (createdAtOrder !== 0) {
            return createdAtOrder;
          }

          return left.id.localeCompare(right.id);
        })
        .map((item, index) => ({
          ...item,
          ordinal: index + 1
        }));

      let firstUserSnippet = turn.firstUserSnippet;

      if (!firstUserSnippet) {
        for (const item of items) {
          if (item.role !== "user") {
            continue;
          }

          firstUserSnippet = createFallbackPreviewSnippet(item.textContent ?? "");

          if (firstUserSnippet) {
            break;
          }
        }
      }

      const tokenEvents = [...turn.tokenEvents.values()].sort((left, right) => {
        const createdAtOrder = compareNullableIso(left.createdAt, right.createdAt);

        if (createdAtOrder !== 0) {
          return createdAtOrder;
        }

        return left.id.localeCompare(right.id);
      });

      return {
        id: turn.id,
        threadId,
        ordinal: 0,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
        status: turn.completedAt || turn.status === "completed" ? "completed" : "in_progress",
        firstUserSnippet,
        contentHash: buildTurnContentHash(items),
        lastSeenAt: turn.lastSeenAt,
        tokenUsage: summarizeTokenEvents(tokenEvents),
        tokenEvents,
        items
      };
    })
    .sort((left, right) => {
      const startedAtOrder = compareNullableIso(left.startedAt, right.startedAt);

      if (startedAtOrder !== 0) {
        return startedAtOrder;
      }

      const completedAtOrder = compareNullableIso(left.completedAt, right.completedAt);

      if (completedAtOrder !== 0) {
        return completedAtOrder;
      }

      const lastSeenOrder = compareNullableIso(left.lastSeenAt, right.lastSeenAt);

      if (lastSeenOrder !== 0) {
        return lastSeenOrder;
      }

      return left.id.localeCompare(right.id);
    })
    .map((turn, index) => ({
      ...turn,
      ordinal: index + 1
    }));
}

function mergeThreadSnapshots(parsedSessions) {
  const preferredProject =
    parsedSessions.find((session) => session.project.sourceKind === "workspace")?.project ??
    parsedSessions[0].project;
  const latestSnapshot = parsedSessions.reduce((best, current) => {
    if (!best) {
      return current;
    }

    const bestActivity =
      best.thread.updatedAt ?? best.thread.lastSeenAt ?? best.thread.createdAt;
    const currentActivity =
      current.thread.updatedAt ?? current.thread.lastSeenAt ?? current.thread.createdAt;

    return compareNullableIso(bestActivity, currentActivity) < 0 ? current : best;
  }, null);
  const turns = mergeTurnSnapshots(
    parsedSessions.flatMap((session) => session.turns),
    latestSnapshot.thread.id
  );
  const preview =
    turns.find((turn) => turn.firstUserSnippet)?.firstUserSnippet ??
    latestSnapshot.thread.preview;

  return {
    project: preferredProject,
    thread: {
      id: latestSnapshot.thread.id,
      projectId: preferredProject.projectId,
      sourceCwd:
        latestSnapshot.thread.sourceCwd ??
        parsedSessions.find((session) => session.thread.sourceCwd)?.thread.sourceCwd ??
        null,
      sourceSessionPath: latestSnapshot.thread.sourceSessionPath,
      sourceKind: latestSnapshot.thread.sourceKind,
      title:
        latestSnapshot.thread.title ||
        preview ||
        path.basename(latestSnapshot.thread.sourceSessionPath, ".jsonl"),
      preview,
      createdAt: parsedSessions.reduce(
        (value, session) => pickEarlierIso(value, session.thread.createdAt),
        null
      ),
      updatedAt: parsedSessions.reduce(
        (value, session) => pickLaterIso(value, session.thread.updatedAt),
        null
      ),
      lastSeenAt: parsedSessions.reduce(
        (value, session) => pickLaterIso(value, session.thread.lastSeenAt),
        null
      )
    },
    turns
  };
}

function upsertProject(database, project, importedAt) {
  database
    .prepare(`
      INSERT INTO projects (
        id,
        source_path,
        display_name,
        source_kind,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_path = excluded.source_path,
        display_name = excluded.display_name,
        source_kind = excluded.source_kind,
        updated_at = excluded.updated_at
    `)
    .run(
      project.projectId,
      project.sourcePath,
      project.displayName,
      project.sourceKind,
      importedAt,
      importedAt
    );
}

function upsertThread(database, thread) {
  database
    .prepare(`
      INSERT INTO threads (
        id,
        project_id,
        source_cwd,
        source_session_path,
        source_kind,
        title,
        preview,
        created_at,
        updated_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        source_cwd = excluded.source_cwd,
        source_session_path = excluded.source_session_path,
        source_kind = excluded.source_kind,
        title = excluded.title,
        preview = excluded.preview,
        created_at = COALESCE(threads.created_at, excluded.created_at),
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at
    `)
    .run(
      thread.id,
      thread.projectId,
      thread.sourceCwd,
      thread.sourceSessionPath,
      thread.sourceKind,
      thread.title,
      thread.preview,
      thread.createdAt,
      thread.updatedAt,
      thread.lastSeenAt
    );
}

function upsertTurn(database, turn) {
  database
    .prepare(`
      INSERT INTO turns (
        id,
        thread_id,
        ordinal,
        started_at,
        completed_at,
        status,
        first_user_snippet,
        content_hash,
        last_seen_at,
        input_tokens,
        cached_input_tokens,
        output_tokens,
        reasoning_output_tokens,
        total_tokens,
        token_event_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        thread_id = excluded.thread_id,
        ordinal = excluded.ordinal,
        started_at = COALESCE(turns.started_at, excluded.started_at),
        completed_at = excluded.completed_at,
        status = excluded.status,
        first_user_snippet = excluded.first_user_snippet,
        content_hash = excluded.content_hash,
        last_seen_at = excluded.last_seen_at,
        input_tokens = excluded.input_tokens,
        cached_input_tokens = excluded.cached_input_tokens,
        output_tokens = excluded.output_tokens,
        reasoning_output_tokens = excluded.reasoning_output_tokens,
        total_tokens = excluded.total_tokens,
        token_event_count = excluded.token_event_count
    `)
    .run(
      turn.id,
      turn.threadId,
      turn.ordinal,
      turn.startedAt,
      turn.completedAt,
      turn.status,
      turn.firstUserSnippet,
      turn.contentHash,
      turn.lastSeenAt,
      turn.tokenUsage.inputTokens,
      turn.tokenUsage.cachedInputTokens,
      turn.tokenUsage.outputTokens,
      turn.tokenUsage.reasoningOutputTokens,
      turn.tokenUsage.totalTokens,
      turn.tokenUsage.tokenEventCount
    );
}

function upsertItem(database, item) {
  database
    .prepare(`
      INSERT INTO items (
        id,
        turn_id,
        ordinal,
        role,
        kind,
        text_content,
        raw_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        turn_id = excluded.turn_id,
        ordinal = excluded.ordinal,
        role = excluded.role,
        kind = excluded.kind,
        text_content = excluded.text_content,
        raw_json = excluded.raw_json,
        created_at = excluded.created_at
    `)
    .run(
      item.id,
      item.turnId,
      item.ordinal,
      item.role,
      item.kind,
      item.textContent,
      item.rawJson,
      item.createdAt
    );
}

function getImporterMetaValue(database, key) {
  const row = database
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(key);

  return row?.value ?? null;
}

function setImporterMetaValue(database, key, value) {
  database
    .prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, value);
}

function listTrackedSourceFiles(database) {
  return new Map(
    database
      .prepare(`
        SELECT
          source_path,
          thread_id,
          file_size,
          modified_at_ms,
          modified_at,
          status,
          last_imported_at,
          last_error
        FROM session_source_files
      `)
      .all()
      .map((row) => [
        row.source_path,
        {
          sourcePath: row.source_path,
          threadId: row.thread_id ?? null,
          fileSize: Number(row.file_size ?? 0),
          modifiedAtMs: Number(row.modified_at_ms ?? 0),
          modifiedAt: row.modified_at ?? null,
          status: row.status,
          lastImportedAt: row.last_imported_at,
          lastError: row.last_error ?? null
        }
      ])
  );
}

function listExistingThreadSourceFiles(database) {
  return database
    .prepare(`
      SELECT
        id,
        source_session_path
      FROM threads
      WHERE source_session_path IS NOT NULL
        AND source_session_path <> ''
    `)
    .all()
    .map((row) => ({
      threadId: row.id,
      sourcePath: row.source_session_path
    }));
}

function upsertTrackedSourceFile(database, sourceFile, importedAt) {
  database
    .prepare(`
      INSERT INTO session_source_files (
        source_path,
        thread_id,
        file_size,
        modified_at_ms,
        modified_at,
        status,
        last_imported_at,
        last_error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_path) DO UPDATE SET
        thread_id = excluded.thread_id,
        file_size = excluded.file_size,
        modified_at_ms = excluded.modified_at_ms,
        modified_at = excluded.modified_at,
        status = excluded.status,
        last_imported_at = excluded.last_imported_at,
        last_error = excluded.last_error
    `)
    .run(
      sourceFile.sourcePath,
      sourceFile.threadId,
      sourceFile.fileSize,
      sourceFile.modifiedAtMs,
      sourceFile.modifiedAt,
      sourceFile.status,
      importedAt,
      sourceFile.lastError ?? null
    );
}

function hasTrackedSourceFileChanged(trackedSourceFile, currentSourceFile) {
  if (!trackedSourceFile) {
    return true;
  }

  if (trackedSourceFile.status !== SOURCE_FILE_STATUS_ACTIVE) {
    return true;
  }

  return (
    trackedSourceFile.fileSize !== currentSourceFile.fileSize ||
    trackedSourceFile.modifiedAtMs !== currentSourceFile.modifiedAtMs
  );
}

function deleteStaleItemsForTurn(database, turnId, itemIds) {
  if (!itemIds.length) {
    database.prepare("DELETE FROM items WHERE turn_id = ?").run(turnId);
    return;
  }

  const placeholders = itemIds.map(() => "?").join(", ");
  database
    .prepare(`
      DELETE FROM items
      WHERE turn_id = ?
        AND id NOT IN (${placeholders})
    `)
    .run(turnId, ...itemIds);
}

function deleteStaleTurnsForThread(database, threadId, turnIds) {
  if (!turnIds.length) {
    database.prepare("DELETE FROM turns WHERE thread_id = ?").run(threadId);
    return;
  }

  const placeholders = turnIds.map(() => "?").join(", ");
  database
    .prepare(`
      DELETE FROM turns
      WHERE thread_id = ?
        AND id NOT IN (${placeholders})
    `)
    .run(threadId, ...turnIds);
}

function reconcileThreadSnapshot(database, mergedSession, importedAt) {
  upsertProject(database, mergedSession.project, importedAt);
  upsertThread(database, mergedSession.thread);

  const turnIds = [];

  for (const turn of mergedSession.turns) {
    turnIds.push(turn.id);
    upsertTurn(database, turn);

    const itemIds = [];

    for (const item of turn.items) {
      itemIds.push(item.id);
      upsertItem(database, item);
    }

    deleteStaleItemsForTurn(database, turn.id, itemIds);
  }

  deleteStaleTurnsForThread(database, mergedSession.thread.id, turnIds);
}

function pruneEmptyProjects(database) {
  database.exec(`
    DELETE FROM projects
    WHERE id NOT IN (
      SELECT DISTINCT project_id
      FROM threads
      WHERE project_id IS NOT NULL
    )
  `);
}

function startSyncRun(database, sourceName, startedAt) {
  const result = database
    .prepare(`
      INSERT INTO sync_runs (
        source_name,
        status,
        started_at,
        details_json
      )
      VALUES (?, 'running', ?, '{}')
    `)
    .run(sourceName, startedAt);

  return Number(result.lastInsertRowid);
}

function finishSyncRun(database, syncRunId, status, completedAt, details) {
  database
    .prepare(`
      UPDATE sync_runs
      SET status = ?,
          completed_at = ?,
          details_json = ?
      WHERE id = ?
    `)
    .run(status, completedAt, JSON.stringify(details), syncRunId);
}

function persistValidationLogs(database, syncRunId, validationState, createdAt) {
  const logEntries = listValidationLogEntries(validationState);

  if (!logEntries.length) {
    return;
  }

  const insertLogStatement = database.prepare(`
    INSERT INTO import_validation_logs (
      sync_run_id,
      severity,
      scope,
      file_path,
      code,
      message,
      line_number,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const entry of logEntries) {
    insertLogStatement.run(
      syncRunId,
      entry.severity,
      entry.scope,
      entry.filePath ?? null,
      entry.code,
      entry.message,
      entry.lineNumber ?? null,
      createdAt
    );
  }
}

function getImporterLayoutVersion(database) {
  const value = getImporterMetaValue(database, IMPORTER_LAYOUT_VERSION_KEY);

  if (!value) {
    return 0;
  }

  return Number.parseInt(value, 10) || 0;
}

function setImporterLayoutVersion(database, version) {
  setImporterMetaValue(database, IMPORTER_LAYOUT_VERSION_KEY, String(version));
}

function resetImportedLibrary(database) {
  database.exec("BEGIN");

  try {
    database.exec(`
      DELETE FROM sync_runs;
      DELETE FROM session_source_files;
      DELETE FROM threads;
      DELETE FROM projects;
    `);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function importCodexSessions(database, options = {}) {
  const codexHome = options.codexHome ?? getDefaultCodexHome();
  const sessionsRoot = getSessionsRoot(codexHome);
  const needsFullRebuild = getImporterLayoutVersion(database) < IMPORTER_LAYOUT_VERSION;

  if (needsFullRebuild) {
    resetImportedLibrary(database);
  }

  const startedAt = new Date().toISOString();
  const syncRunId = startSyncRun(database, "codex_sessions", startedAt);
  const sessionIndexSignature = getOptionalFileSignature(getSessionIndexPath(codexHome));
  const globalStateSignature = getOptionalFileSignature(getGlobalStatePath(codexHome));
  const previousSessionIndexSignature = getImporterMetaValue(
    database,
    SESSION_INDEX_SIGNATURE_KEY
  );
  const previousGlobalStateSignature = getImporterMetaValue(database, GLOBAL_STATE_SIGNATURE_KEY);
  const validationState = createValidationState();

  const result = {
    syncRunId,
    startedAt,
    completedAt: null,
    codexHome,
    sessionsRoot,
    scannedFiles: 0,
    importedThreads: 0,
    importedTurns: 0,
    importedItems: 0,
    importedProjects: 0,
    skippedFiles: 0,
    newFiles: 0,
    changedFiles: 0,
    unchangedFiles: 0,
    missingFiles: 0,
    errorFiles: 0,
    reparsedFiles: 0,
    rebuiltLibrary: needsFullRebuild,
    forcedFileReparse: false,
    warnings: [],
    validationSummary: buildValidationSummary(validationState),
    errors: []
  };

  try {
    const sessionIndex = loadSessionIndex(codexHome, validationState);
    const codexStateIndex = loadCodexStateIndex(codexHome, {
      validationState,
      strict: true
    });
    const files = discoverSessionFiles(sessionsRoot);
    const currentSourceFiles = new Map(
      files.map((filePath) => [filePath, createSourceFileSnapshot(filePath)])
    );
    const trackedSourceFiles = listTrackedSourceFiles(database);
    const forceReparseAllFiles =
      trackedSourceFiles.size > 0 &&
      (sessionIndexSignature !== previousSessionIndexSignature ||
        globalStateSignature !== previousGlobalStateSignature);
    const bootstrapMissingSourceFiles =
      trackedSourceFiles.size === 0
        ? listExistingThreadSourceFiles(database).filter(
            (sourceFile) => !currentSourceFiles.has(sourceFile.sourcePath)
          )
        : [];

    result.scannedFiles = files.length;
    result.forcedFileReparse = forceReparseAllFiles;

    const parseQueue = new Set();
    const attemptedParseFiles = new Set();
    const parsedSessionsByFilePath = new Map();
    const sourceFileUpdates = new Map();
    const affectedThreadIds = new Set();
    const blockedThreadIds = new Set();

    for (const [filePath, sourceFile] of currentSourceFiles) {
      const trackedSourceFile = trackedSourceFiles.get(filePath);

      if (!trackedSourceFile) {
        result.newFiles += 1;
      } else if (hasTrackedSourceFileChanged(trackedSourceFile, sourceFile)) {
        result.changedFiles += 1;
      } else {
        result.unchangedFiles += 1;
      }

      if (forceReparseAllFiles || hasTrackedSourceFileChanged(trackedSourceFile, sourceFile)) {
        parseQueue.add(filePath);
      }
    }

    for (const trackedSourceFile of trackedSourceFiles.values()) {
      if (!currentSourceFiles.has(trackedSourceFile.sourcePath)) {
        result.missingFiles += 1;

        if (trackedSourceFile.threadId) {
          affectedThreadIds.add(trackedSourceFile.threadId);
        }
      }
    }

    for (const sourceFile of bootstrapMissingSourceFiles) {
      result.missingFiles += 1;
      affectedThreadIds.add(sourceFile.threadId);
    }

    while (true) {
      const pendingFiles = [...parseQueue].filter((filePath) => !attemptedParseFiles.has(filePath));

      if (!pendingFiles.length) {
        break;
      }

      for (const filePath of pendingFiles) {
        attemptedParseFiles.add(filePath);

        const sourceFile = currentSourceFiles.get(filePath);
        const trackedSourceFile = trackedSourceFiles.get(filePath) ?? null;
        const parsed = parseSessionFile(
          filePath,
          sessionIndex,
          codexHome,
          codexStateIndex,
          sourceFile,
          validationState
        );

        if (!parsed.ok) {
          result.skippedFiles += 1;
          result.errorFiles += 1;
          result.errors.push({
            code: parsed.code ?? "session_file_invalid_structure",
            filePath,
            reason: parsed.reason
          });

          if (trackedSourceFile?.threadId) {
            blockedThreadIds.add(trackedSourceFile.threadId);
          }

          sourceFileUpdates.set(filePath, {
            sourcePath: filePath,
            threadId: trackedSourceFile?.threadId ?? null,
            fileSize: sourceFile.fileSize,
            modifiedAtMs: sourceFile.modifiedAtMs,
            modifiedAt: sourceFile.modifiedAt,
            status: SOURCE_FILE_STATUS_ERROR,
            lastError: parsed.reason
          });
          continue;
        }

        parsedSessionsByFilePath.set(filePath, parsed);
        affectedThreadIds.add(parsed.thread.id);

        if (trackedSourceFile?.threadId && trackedSourceFile.threadId !== parsed.thread.id) {
          affectedThreadIds.add(trackedSourceFile.threadId);
        }

        sourceFileUpdates.set(filePath, {
          sourcePath: filePath,
          threadId: parsed.thread.id,
          fileSize: sourceFile.fileSize,
          modifiedAtMs: sourceFile.modifiedAtMs,
          modifiedAt: sourceFile.modifiedAt,
          status: SOURCE_FILE_STATUS_ACTIVE,
          lastError: null
        });
      }

      if (forceReparseAllFiles) {
        continue;
      }

      for (const [filePath] of currentSourceFiles) {
        if (attemptedParseFiles.has(filePath)) {
          continue;
        }

        const knownThreadId =
          parsedSessionsByFilePath.get(filePath)?.thread.id ??
          trackedSourceFiles.get(filePath)?.threadId ??
          null;

        if (knownThreadId && affectedThreadIds.has(knownThreadId)) {
          parseQueue.add(filePath);
        }
      }
    }

    result.reparsedFiles = attemptedParseFiles.size;

    const parsedSessionsByThreadId = new Map();

    for (const parsedSession of parsedSessionsByFilePath.values()) {
      const groupedSessions = parsedSessionsByThreadId.get(parsedSession.thread.id) ?? [];
      groupedSessions.push(parsedSession);
      parsedSessionsByThreadId.set(parsedSession.thread.id, groupedSessions);
    }

    database.exec("BEGIN");
    const importedProjectIds = new Set();

    for (const trackedSourceFile of trackedSourceFiles.values()) {
      if (currentSourceFiles.has(trackedSourceFile.sourcePath)) {
        continue;
      }

      upsertTrackedSourceFile(
        database,
        {
          sourcePath: trackedSourceFile.sourcePath,
          threadId: trackedSourceFile.threadId,
          fileSize: trackedSourceFile.fileSize,
          modifiedAtMs: trackedSourceFile.modifiedAtMs,
          modifiedAt: trackedSourceFile.modifiedAt,
          status: SOURCE_FILE_STATUS_MISSING,
          lastError: null
        },
        startedAt
      );
    }

    for (const sourceFile of bootstrapMissingSourceFiles) {
      upsertTrackedSourceFile(
        database,
        {
          sourcePath: sourceFile.sourcePath,
          threadId: sourceFile.threadId,
          fileSize: 0,
          modifiedAtMs: 0,
          modifiedAt: null,
          status: SOURCE_FILE_STATUS_MISSING,
          lastError: null
        },
        startedAt
      );
    }

    for (const [filePath, sourceFile] of currentSourceFiles) {
      const nextSourceFile = sourceFileUpdates.get(filePath) ?? {
        sourcePath: filePath,
        threadId: trackedSourceFiles.get(filePath)?.threadId ?? null,
        fileSize: sourceFile.fileSize,
        modifiedAtMs: sourceFile.modifiedAtMs,
        modifiedAt: sourceFile.modifiedAt,
        status: SOURCE_FILE_STATUS_ACTIVE,
        lastError: null
      };

      upsertTrackedSourceFile(database, nextSourceFile, startedAt);
    }

    for (const [threadId, parsedSessions] of parsedSessionsByThreadId) {
      if (blockedThreadIds.has(threadId)) {
        continue;
      }

      const mergedSession = mergeThreadSnapshots(parsedSessions);

      if (!importedProjectIds.has(mergedSession.project.projectId)) {
        importedProjectIds.add(mergedSession.project.projectId);
        result.importedProjects += 1;
      }

      reconcileThreadSnapshot(database, mergedSession, startedAt);
      result.importedThreads += 1;
      result.importedTurns += mergedSession.turns.length;
      result.importedItems += mergedSession.turns.reduce(
        (count, turn) => count + turn.items.length,
        0
      );
    }

    pruneEmptyProjects(database);
    database.exec("COMMIT");
    setImporterLayoutVersion(database, IMPORTER_LAYOUT_VERSION);
    setImporterMetaValue(database, SESSION_INDEX_SIGNATURE_KEY, sessionIndexSignature);
    setImporterMetaValue(database, GLOBAL_STATE_SIGNATURE_KEY, globalStateSignature);
    result.warnings = validationState.warnings;
    result.validationSummary = buildValidationSummary(validationState);
    result.completedAt = new Date().toISOString();
    persistValidationLogs(database, syncRunId, validationState, result.completedAt);
    finishSyncRun(database, syncRunId, "completed", result.completedAt, result);
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Ignore rollback errors when no import transaction is active.
    }
    result.warnings = validationState.warnings;
    result.validationSummary = buildValidationSummary(validationState);
    result.completedAt = new Date().toISOString();
    result.errors.push({
      code: "import_failed",
      filePath: null,
      reason: error instanceof Error ? error.message : String(error)
    });
    persistValidationLogs(database, syncRunId, validationState, result.completedAt);
    finishSyncRun(database, syncRunId, "failed", result.completedAt, result);
    throw error;
  }
}

function listThreadSourceRecords(database) {
  return database
    .prepare(`
      SELECT
        id,
        title,
        source_session_path
      FROM threads
    `)
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      sourceSessionPath: row.source_session_path ?? null
    }));
}

function createDiagnosisIssue({
  code,
  category,
  severity,
  title,
  message,
  sourcePath = null,
  parsedThreadId = null,
  trackedThreadId = null,
  trackedStatus = null,
  relatedSourcePaths = [],
  relatedThreadIds = [],
  suggestedAction = "inspect",
  lastImportedAt = null,
  lastError = null
}) {
  return {
    code,
    category,
    severity,
    title,
    message,
    sourcePath,
    parsedThreadId,
    trackedThreadId,
    trackedStatus,
    relatedSourcePaths,
    relatedThreadIds,
    suggestedAction,
    lastImportedAt,
    lastError
  };
}

function createDiagnosisIssueRef(issue) {
  return stableStringify({
    code: issue.code,
    category: issue.category,
    sourcePath: issue.sourcePath,
    parsedThreadId: issue.parsedThreadId,
    trackedThreadId: issue.trackedThreadId,
    trackedStatus: issue.trackedStatus,
    relatedSourcePaths: [...issue.relatedSourcePaths].sort(),
    relatedThreadIds: [...issue.relatedThreadIds].sort()
  });
}

function buildSessionDiagnosisSummary(report, counts, snapshotResult) {
  return {
    scannedFiles: counts.scannedFiles,
    trackedFiles: counts.trackedFiles,
    dbThreads: counts.dbThreads,
    duplicateCount: report.duplicates.length,
    newDuplicateCount: snapshotResult?.hasBaseline
      ? snapshotResult.newCounts.duplicates ?? 0
      : 0,
    importGapCount: report.importGaps.length,
    newImportGapCount: snapshotResult?.hasBaseline
      ? snapshotResult.newCounts.importGaps ?? 0
      : 0,
    sourceProblemCount: report.sourceProblems.length,
    newSourceProblemCount: snapshotResult?.hasBaseline
      ? snapshotResult.newCounts.sourceProblems ?? 0
      : 0,
    parseProblemCount: report.parseProblems.length,
    newParseProblemCount: snapshotResult?.hasBaseline
      ? snapshotResult.newCounts.parseProblems ?? 0
      : 0,
    totalIssueCount:
      report.duplicates.length +
      report.importGaps.length +
      report.sourceProblems.length +
      report.parseProblems.length,
    newTotalIssueCount: snapshotResult?.hasBaseline ? snapshotResult.totalNewCount : 0
  };
}

function runSessionDiagnosis(database, options = {}) {
  const codexHome = options.codexHome ?? getDefaultCodexHome();
  const sessionsRoot = getSessionsRoot(codexHome);
  const checkedAt = new Date().toISOString();
  const validationState = createValidationState();
  const sessionIndex = loadSessionIndex(codexHome, validationState);
  const codexStateIndex = loadCodexStateIndex(codexHome, {
    validationState,
    strict: false
  });
  const files = discoverSessionFiles(sessionsRoot);
  const currentSourceFiles = new Map(
    files.map((filePath) => [filePath, createSourceFileSnapshot(filePath)])
  );
  const trackedSourceFiles = listTrackedSourceFiles(database);
  const threadRows = listThreadSourceRecords(database);
  const threadsById = new Map(threadRows.map((thread) => [thread.id, thread]));
  const report = {
    checkedAt,
    codexHome,
    sessionsRoot,
    summary: {
      scannedFiles: files.length,
      trackedFiles: trackedSourceFiles.size,
      dbThreads: threadRows.length,
      duplicateCount: 0,
      importGapCount: 0,
      sourceProblemCount: 0,
      parseProblemCount: 0,
      totalIssueCount: 0
    },
    duplicates: [],
    importGaps: [],
    sourceProblems: [],
    parseProblems: []
  };

  const threadIdsBySourceSessionPath = new Map();

  for (const thread of threadRows) {
    if (!thread.sourceSessionPath) {
      continue;
    }

    const threadIds = threadIdsBySourceSessionPath.get(thread.sourceSessionPath) ?? [];
    threadIds.push(thread.id);
    threadIdsBySourceSessionPath.set(thread.sourceSessionPath, threadIds);
  }

  for (const [sourcePath, threadIds] of threadIdsBySourceSessionPath) {
    if (threadIds.length < 2) {
      continue;
    }

    report.duplicates.push(
      createDiagnosisIssue({
        code: "duplicate_source_session_path",
        category: "duplicate",
        severity: "error",
        title: "Multiple DB threads share one source session path",
        message: `The same stored source session path is attached to ${threadIds.length} threads.`,
        sourcePath,
        relatedThreadIds: threadIds,
        suggestedAction: "inspect_db"
      })
    );
  }

  for (const [filePath, sourceFileSnapshot] of currentSourceFiles) {
    const trackedSourceFile = trackedSourceFiles.get(filePath) ?? null;
    const parsed = parseSessionFile(
      filePath,
      sessionIndex,
      codexHome,
      codexStateIndex,
      sourceFileSnapshot,
      validationState
    );

    if (!parsed.ok) {
      report.parseProblems.push(
        createDiagnosisIssue({
          code: parsed.code ?? "session_file_parse_failed",
          category: "parse_problem",
          severity: "warning",
          title: "Current source file could not be parsed",
          message: parsed.reason,
          sourcePath: filePath,
          trackedThreadId: trackedSourceFile?.threadId ?? null,
          trackedStatus: trackedSourceFile?.status ?? null,
          suggestedAction: "inspect_source",
          lastImportedAt: trackedSourceFile?.lastImportedAt ?? null,
          lastError: trackedSourceFile?.lastError ?? null
        })
      );
      continue;
    }

    const parsedThreadId = parsed.thread.id;

    if (!trackedSourceFile) {
      report.importGaps.push(
        createDiagnosisIssue({
          code: "untracked_source_file",
          category: "import_gap",
          severity: "warning",
          title: "Current source file is not tracked in the DB",
          message: "This session file exists in Codex source but has not been recorded in session_source_files yet.",
          sourcePath: filePath,
          parsedThreadId,
          suggestedAction: "reimport"
        })
      );
      continue;
    }

    if (trackedSourceFile.status === SOURCE_FILE_STATUS_ERROR) {
      report.sourceProblems.push(
        createDiagnosisIssue({
          code: "tracked_source_status_error",
          category: "source_problem",
          severity: "warning",
          title: "Tracked source file is marked as error",
          message: "The most recent import marked this source file as an error.",
          sourcePath: filePath,
          parsedThreadId,
          trackedThreadId: trackedSourceFile.threadId,
          trackedStatus: trackedSourceFile.status,
          suggestedAction: "reimport",
          lastImportedAt: trackedSourceFile.lastImportedAt,
          lastError: trackedSourceFile.lastError
        })
      );
    }

    if (!trackedSourceFile.threadId) {
      report.importGaps.push(
        createDiagnosisIssue({
          code: "tracked_source_missing_thread_id",
          category: "import_gap",
          severity: "error",
          title: "Tracked source file has no linked DB thread",
          message: "The source file is tracked, but no thread_id is stored for it.",
          sourcePath: filePath,
          parsedThreadId,
          trackedStatus: trackedSourceFile.status,
          suggestedAction: "reimport",
          lastImportedAt: trackedSourceFile.lastImportedAt,
          lastError: trackedSourceFile.lastError
        })
      );
      continue;
    }

    if (trackedSourceFile.threadId !== parsedThreadId) {
      report.importGaps.push(
        createDiagnosisIssue({
          code: "tracked_source_thread_id_mismatch",
          category: "import_gap",
          severity: "error",
          title: "Tracked source file points to a different thread than the source content",
          message: "The parsed session id from the current source file does not match the tracked thread_id in the DB.",
          sourcePath: filePath,
          parsedThreadId,
          trackedThreadId: trackedSourceFile.threadId,
          trackedStatus: trackedSourceFile.status,
          suggestedAction: "reimport",
          lastImportedAt: trackedSourceFile.lastImportedAt,
          lastError: trackedSourceFile.lastError
        })
      );
      continue;
    }

    if (!threadsById.has(parsedThreadId)) {
      report.importGaps.push(
        createDiagnosisIssue({
          code: "parsed_source_missing_db_thread",
          category: "import_gap",
          severity: "error",
          title: "Current source file resolves to a thread missing from the DB",
          message: "The source file parses successfully, but the matching DB thread row does not exist.",
          sourcePath: filePath,
          parsedThreadId,
          trackedThreadId: trackedSourceFile.threadId,
          trackedStatus: trackedSourceFile.status,
          suggestedAction: "reimport",
          lastImportedAt: trackedSourceFile.lastImportedAt,
          lastError: trackedSourceFile.lastError
        })
      );
    }
  }

  for (const trackedSourceFile of trackedSourceFiles.values()) {
    if (currentSourceFiles.has(trackedSourceFile.sourcePath)) {
      continue;
    }

    if (trackedSourceFile.status === SOURCE_FILE_STATUS_MISSING) {
      report.sourceProblems.push(
        createDiagnosisIssue({
          code: "tracked_source_missing_on_disk",
          category: "source_problem",
          severity: "warning",
          title: "Tracked source file is missing from the current Codex source",
          message: "The DB still tracks this source file, but it is not present under the current Codex sessions directory.",
          sourcePath: trackedSourceFile.sourcePath,
          trackedThreadId: trackedSourceFile.threadId,
          trackedStatus: trackedSourceFile.status,
          suggestedAction: "restore_source",
          lastImportedAt: trackedSourceFile.lastImportedAt,
          lastError: trackedSourceFile.lastError
        })
      );
      continue;
    }

    report.sourceProblems.push(
      createDiagnosisIssue({
        code: "tracked_source_not_found_in_current_scan",
        category: "source_problem",
        severity: "warning",
        title: "Tracked source file was not found in the current source scan",
        message: "The file is tracked in the DB, but it was not discovered in the current Codex sessions directory scan.",
        sourcePath: trackedSourceFile.sourcePath,
        trackedThreadId: trackedSourceFile.threadId,
        trackedStatus: trackedSourceFile.status,
        suggestedAction: "inspect_source",
        lastImportedAt: trackedSourceFile.lastImportedAt,
        lastError: trackedSourceFile.lastError
      })
    );
  }

  for (const trackedSourceFile of trackedSourceFiles.values()) {
    if (currentSourceFiles.has(trackedSourceFile.sourcePath)) {
      continue;
    }

    if (!trackedSourceFile.threadId) {
      continue;
    }

    if (threadsById.has(trackedSourceFile.threadId)) {
      continue;
    }

    report.importGaps.push(
      createDiagnosisIssue({
        code: "tracked_thread_missing_db_row",
        category: "import_gap",
        severity: "error",
        title: "Tracked source file references a missing DB thread",
        message: "session_source_files.thread_id points to a thread row that is no longer present in the DB.",
        sourcePath: trackedSourceFile.sourcePath,
        trackedThreadId: trackedSourceFile.threadId,
        trackedStatus: trackedSourceFile.status,
        suggestedAction: "reimport",
        lastImportedAt: trackedSourceFile.lastImportedAt,
        lastError: trackedSourceFile.lastError
      })
    );
  }

  const snapshotResult = compareAndStoreSnapshot(
    database,
    SESSION_DIAGNOSIS_SNAPSHOT_KEY,
    {
      duplicates: report.duplicates.map((issue) => createDiagnosisIssueRef(issue)),
      importGaps: report.importGaps.map((issue) => createDiagnosisIssueRef(issue)),
      sourceProblems: report.sourceProblems.map((issue) => createDiagnosisIssueRef(issue)),
      parseProblems: report.parseProblems.map((issue) => createDiagnosisIssueRef(issue))
    }
  );

  report.summary = buildSessionDiagnosisSummary(
    report,
    {
      scannedFiles: files.length,
      trackedFiles: trackedSourceFiles.size,
      dbThreads: threadRows.length
    },
    snapshotResult
  );

  return report;
}

module.exports = {
  getDefaultCodexHome,
  importCodexSessions,
  runSessionDiagnosis,
  listSidebarWorkspaceRoots
};

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const IMPORTER_LAYOUT_VERSION = 3;
const IMPORTER_LAYOUT_VERSION_KEY = "codex_card_feed_importer_layout_version";

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

function loadSessionIndex(codexHome) {
  const indexPath = getSessionIndexPath(codexHome);
  const sessionIndex = new Map();

  if (!fs.existsSync(indexPath)) {
    return sessionIndex;
  }

  const lines = fs.readFileSync(indexPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const parsed = JSON.parse(line);
      sessionIndex.set(parsed.id, {
        title: parsed.thread_name ?? "",
        updatedAt: parsed.updated_at ?? null
      });
    } catch {
      continue;
    }
  }

  return sessionIndex;
}

function loadCodexStateIndex(codexHome) {
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

  try {
    const rawState = fs.readFileSync(globalStatePath, "utf8");
    const parsedState = JSON.parse(rawState);
    const persistedState = parsedState["electron-persisted-atom-state"] ?? {};
    const readStateValue = (key) =>
      parsedState[key] ?? persistedState[key] ?? null;

    const savedWorkspaceRoots = [
      ...(Array.isArray(readStateValue("electron-saved-workspace-roots"))
        ? readStateValue("electron-saved-workspace-roots")
        : []),
      ...(Array.isArray(readStateValue("project-order"))
        ? readStateValue("project-order")
        : [])
    ];

    for (const workspaceRoot of savedWorkspaceRoots) {
      if (typeof workspaceRoot === "string" && workspaceRoot) {
        stateIndex.savedWorkspaceRoots.add(normalizePathForId(workspaceRoot));
      }
    }

    if (
      readStateValue("electron-workspace-root-labels") &&
      typeof readStateValue("electron-workspace-root-labels") === "object"
    ) {
      for (const [workspaceRoot, displayName] of Object.entries(
        readStateValue("electron-workspace-root-labels")
      )) {
        if (
          typeof workspaceRoot === "string" &&
          workspaceRoot &&
          typeof displayName === "string" &&
          displayName.trim()
        ) {
          stateIndex.workspaceRootLabels.set(
            normalizePathForId(workspaceRoot),
            displayName.trim()
          );
        }
      }
    }

    if (Array.isArray(readStateValue("projectless-thread-ids"))) {
      for (const threadId of readStateValue("projectless-thread-ids")) {
        if (typeof threadId === "string" && threadId) {
          stateIndex.projectlessThreadIds.add(threadId);
        }
      }
    }

    if (
      readStateValue("thread-projectless-output-directories") &&
      typeof readStateValue("thread-projectless-output-directories") === "object"
    ) {
      for (const [threadId, outputDirectory] of Object.entries(
        readStateValue("thread-projectless-output-directories")
      )) {
        if (
          typeof threadId === "string" &&
          threadId &&
          typeof outputDirectory === "string" &&
          outputDirectory
        ) {
          stateIndex.projectlessOutputDirectoryByThreadId.set(threadId, outputDirectory);
        }
      }
    }

    if (
      readStateValue("thread-workspace-root-hints") &&
      typeof readStateValue("thread-workspace-root-hints") === "object"
    ) {
      for (const [threadId, workspaceRoot] of Object.entries(
        readStateValue("thread-workspace-root-hints")
      )) {
        if (
          typeof threadId === "string" &&
          threadId &&
          typeof workspaceRoot === "string" &&
          workspaceRoot
        ) {
          stateIndex.threadWorkspaceRootHints.set(threadId, workspaceRoot);
        }
      }
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
  } catch {
    return stateIndex;
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

function parseSessionFile(filePath, sessionIndex, codexHome, codexStateIndex) {
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split(/\r?\n/).filter((line) => line.trim());
  const fileStat = fs.statSync(filePath);
  const lastSeenAt = fileStat.mtime.toISOString();

  let sessionId = null;
  let threadCwd = null;
  let threadCreatedAt = null;
  let threadWorkspaceRoots = [];
  const turns = new Map();
  const turnOrder = [];
  let fallbackPreview = "";
  let activeTurnId = null;

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

  for (const line of lines) {
    let parsed;

    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (parsed.type === "session_meta") {
      sessionId = parsed.payload.session_id ?? parsed.payload.id ?? sessionId;
      threadCwd = parsed.payload.cwd ?? threadCwd;
      threadCreatedAt = parsed.payload.timestamp ?? parsed.timestamp ?? threadCreatedAt;
      if (!threadWorkspaceRoots.length) {
        threadWorkspaceRoots = normalizePathList(parsed.payload.workspace_roots);
      }
      continue;
    }

    if (parsed.type === "turn_context") {
      const turn = ensureTurn(parsed.payload.turn_id);
      turn.startedAt = pickEarlierIso(turn.startedAt, parsed.timestamp);
      if (!threadWorkspaceRoots.length) {
        threadWorkspaceRoots = normalizePathList(parsed.payload.workspace_roots);
      }
      continue;
    }

    if (parsed.type === "event_msg") {
      const payload = parsed.payload ?? {};

      if (payload.type === "user_message" && typeof payload.message === "string") {
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
      continue;
    }

    const payload = parsed.payload ?? {};
    const turnId = resolveResponseItemTurnId(payload, activeTurnId);

    if (!turnId) {
      continue;
    }

    if (payload.type === "message") {
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
    return {
      ok: false,
      reason: "missing_session_meta",
      filePath
    };
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

function getImporterLayoutVersion(database) {
  const row = database
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(IMPORTER_LAYOUT_VERSION_KEY);

  if (!row?.value) {
    return 0;
  }

  return Number.parseInt(row.value, 10) || 0;
}

function setImporterLayoutVersion(database, version) {
  database
    .prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(IMPORTER_LAYOUT_VERSION_KEY, String(version));
}

function resetImportedLibrary(database) {
  database.exec("BEGIN");

  try {
    database.exec(`
      DELETE FROM sync_runs;
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
  const sessionIndex = loadSessionIndex(codexHome);
  const codexStateIndex = loadCodexStateIndex(codexHome);
  const files = discoverSessionFiles(sessionsRoot);

  const result = {
    syncRunId,
    startedAt,
    completedAt: null,
    codexHome,
    sessionsRoot,
    scannedFiles: files.length,
    importedThreads: 0,
    importedTurns: 0,
    importedItems: 0,
    importedProjects: 0,
    skippedFiles: 0,
    rebuiltLibrary: needsFullRebuild,
    errors: []
  };

  try {
    const parsedSessionsByThreadId = new Map();

    for (const filePath of files) {
      const parsed = parseSessionFile(filePath, sessionIndex, codexHome, codexStateIndex);

      if (!parsed.ok) {
        result.skippedFiles += 1;
        result.errors.push({
          filePath,
          reason: parsed.reason
        });
        continue;
      }

      const groupedSessions = parsedSessionsByThreadId.get(parsed.thread.id) ?? [];
      groupedSessions.push(parsed);
      parsedSessionsByThreadId.set(parsed.thread.id, groupedSessions);
    }

    database.exec("BEGIN");
    const importedProjectIds = new Set();

    for (const parsedSessions of parsedSessionsByThreadId.values()) {
      const mergedSession = mergeThreadSnapshots(parsedSessions);
      upsertProject(database, mergedSession.project, startedAt);

      if (!importedProjectIds.has(mergedSession.project.projectId)) {
        importedProjectIds.add(mergedSession.project.projectId);
        result.importedProjects += 1;
      }

      upsertThread(database, mergedSession.thread);
      result.importedThreads += 1;

      for (const turn of mergedSession.turns) {
        upsertTurn(database, turn);
        result.importedTurns += 1;

        for (const item of turn.items) {
          upsertItem(database, item);
          result.importedItems += 1;
        }
      }
    }

    database.exec("COMMIT");
    setImporterLayoutVersion(database, IMPORTER_LAYOUT_VERSION);
    result.completedAt = new Date().toISOString();
    finishSyncRun(database, syncRunId, "completed", result.completedAt, result);
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    result.completedAt = new Date().toISOString();
    result.errors.push({
      filePath: null,
      reason: error instanceof Error ? error.message : String(error)
    });
    finishSyncRun(database, syncRunId, "failed", result.completedAt, result);
    throw error;
  }
}

module.exports = {
  getDefaultCodexHome,
  importCodexSessions,
  listSidebarWorkspaceRoots
};

const fs = require("node:fs");
const path = require("node:path");
const {
  KNOWN_TOP_LEVEL_ENTRY_TYPES,
  KNOWN_EVENT_MSG_TYPES,
  KNOWN_RESPONSE_ITEM_TYPES
} = require("./constants");
const {
  incrementTypeCount,
  addValidationWarning,
  addValidationError
} = require("./validation");
const { createSourceFileSnapshot } = require("./state-index");
const {
  isRecord,
  isNonEmptyString,
  normalizePathForId,
  normalizePathList,
  isPathInsideDirectory,
  toIsoFromUnixSeconds,
  extractTextFromMessage,
  clipSnippet,
  getMessageKind,
  buildReasoningPayload,
  createFallbackPreviewSnippet,
  pickEarlierIso,
  pickLaterIso,
  buildTurnContentHash,
  normalizeTokenUsage,
  summarizeTokenEvents
} = require("./utils");

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

    incrementTypeCount(validationState?.observedTypes?.topLevel, parsed.type);

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

      if (
        parsed.payload.cwd !== undefined &&
        parsed.payload.cwd !== null &&
        typeof parsed.payload.cwd !== "string"
      ) {
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

      incrementTypeCount(validationState?.observedTypes?.eventMsg, payload.type);

      if (!KNOWN_EVENT_MSG_TYPES.has(payload.type)) {
        warnValidation(
          "event_msg_unknown_type",
          `Encountered unknown event_msg payload.type "${payload.type}".`,
          lineNumber,
          payload.type
        );
      }

      if (
        payload.turn_id !== undefined &&
        payload.turn_id !== null &&
        !isNonEmptyString(payload.turn_id)
      ) {
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
      if (
        parsed.type === "compacted" &&
        parsed.payload !== undefined &&
        parsed.payload !== null &&
        !isRecord(parsed.payload)
      ) {
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

    incrementTypeCount(validationState?.observedTypes?.responseItem, payload.type);

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
      if (
        payload.role !== undefined &&
        payload.role !== null &&
        typeof payload.role !== "string"
      ) {
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

module.exports = {
  parseSessionFile
};

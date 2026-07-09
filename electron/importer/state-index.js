const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  isRecord,
  isNonEmptyString,
  normalizePathForId
} = require("./utils");
const {
  addValidationWarning,
  addValidationError
} = require("./validation");

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
      if (
        typeof entryKey === "string" &&
        entryKey &&
        typeof entryValue === "string" &&
        entryValue
      ) {
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

  if (
    persistedStateRaw !== undefined &&
    persistedStateRaw !== null &&
    !isRecord(persistedStateRaw)
  ) {
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

module.exports = {
  getDefaultCodexHome,
  getSessionsRoot,
  getSessionIndexPath,
  getGlobalStatePath,
  listSidebarWorkspaceRoots,
  getOptionalFileSignature,
  createSourceFileSnapshot,
  discoverSessionFiles,
  loadSessionIndex,
  loadCodexStateIndex
};

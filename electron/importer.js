const {
  IMPORTER_LAYOUT_VERSION,
  IMPORTER_REPARSE_VERSION,
  IMPORTER_REPARSE_VERSION_KEY,
  SESSION_INDEX_SIGNATURE_KEY,
  GLOBAL_STATE_SIGNATURE_KEY,
  SOURCE_FILE_STATUS_ACTIVE,
  SOURCE_FILE_STATUS_MISSING,
  SOURCE_FILE_STATUS_ERROR
} = require("./importer/constants");
const {
  createValidationState,
  buildValidationSummary
} = require("./importer/validation");
const {
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
} = require("./importer/state-index");
const { parseSessionFile } = require("./importer/parser");
const { mergeThreadSnapshots } = require("./importer/merge");
const {
  getImporterMetaValue,
  setImporterMetaValue,
  listTrackedSourceFiles,
  listExistingThreadSourceFiles,
  upsertTrackedSourceFile,
  hasTrackedSourceFileChanged,
  reconcileThreadSnapshot,
  pruneEmptyProjects,
  startSyncRun,
  finishSyncRun,
  persistValidationLogs,
  getImporterLayoutVersion,
  setImporterLayoutVersion,
  resetImportedLibrary
} = require("./importer/repository");
const { runSessionDiagnosis } = require("./importer/diagnosis");

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
  const previousGlobalStateSignature = getImporterMetaValue(
    database,
    GLOBAL_STATE_SIGNATURE_KEY
  );
  const previousReparseVersion =
    Number.parseInt(getImporterMetaValue(database, IMPORTER_REPARSE_VERSION_KEY) ?? "", 10) || 0;
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
    const forceReparseForParserUpgrade =
      trackedSourceFiles.size > 0 && previousReparseVersion < IMPORTER_REPARSE_VERSION;
    const forceReparseAllFiles =
      trackedSourceFiles.size > 0 &&
      (sessionIndexSignature !== previousSessionIndexSignature ||
        globalStateSignature !== previousGlobalStateSignature ||
        forceReparseForParserUpgrade);
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
        (sum, turn) => sum + turn.items.length,
        0
      );
    }

    pruneEmptyProjects(database);
    database.exec("COMMIT");
    setImporterLayoutVersion(database, IMPORTER_LAYOUT_VERSION);
    setImporterMetaValue(database, IMPORTER_REPARSE_VERSION_KEY, String(IMPORTER_REPARSE_VERSION));
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

module.exports = {
  getDefaultCodexHome,
  importCodexSessions,
  runSessionDiagnosis,
  listSidebarWorkspaceRoots
};

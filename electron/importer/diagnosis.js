const { compareAndStoreSnapshot, stableStringify } = require("../diagnostic-snapshots");
const { SESSION_DIAGNOSIS_SNAPSHOT_KEY } = require("./constants");
const { createValidationState } = require("./validation");
const {
  getDefaultCodexHome,
  getSessionsRoot,
  discoverSessionFiles,
  loadSessionIndex,
  loadCodexStateIndex,
  createSourceFileSnapshot
} = require("./state-index");
const { parseSessionFile } = require("./parser");
const {
  listTrackedSourceFiles,
  listThreadSourceRecords
} = require("./repository");

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
          code: parsed.code ?? "session_file_invalid_structure",
          category: "parse_problem",
          severity: "error",
          title: "Source session file could not be parsed",
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

    if (
      trackedSourceFile?.threadId &&
      trackedSourceFile.threadId !== parsed.thread.id
    ) {
      report.importGaps.push(
        createDiagnosisIssue({
          code: "tracked_thread_id_mismatch",
          category: "import_gap",
          severity: "warning",
          title: "Tracked source file thread id does not match parsed thread id",
          message: "The DB-tracked thread id for this source file differs from the thread id parsed from the latest file.",
          sourcePath: filePath,
          parsedThreadId: parsed.thread.id,
          trackedThreadId: trackedSourceFile.threadId,
          trackedStatus: trackedSourceFile.status,
          suggestedAction: "reimport",
          lastImportedAt: trackedSourceFile.lastImportedAt,
          lastError: trackedSourceFile.lastError
        })
      );
    }

    const threadRow = threadsById.get(parsed.thread.id) ?? null;

    if (!threadRow) {
      report.importGaps.push(
        createDiagnosisIssue({
          code: "parsed_thread_missing_db_row",
          category: "import_gap",
          severity: "warning",
          title: "Parsed source thread has no DB row",
          message: "A source session file parsed successfully, but its thread is not present in the DB.",
          sourcePath: filePath,
          parsedThreadId: parsed.thread.id,
          suggestedAction: "reimport"
        })
      );
      continue;
    }

    if (threadRow.sourceSessionPath !== filePath) {
      report.importGaps.push(
        createDiagnosisIssue({
          code: "db_thread_source_path_mismatch",
          category: "import_gap",
          severity: "warning",
          title: "DB thread source path does not match current parsed file",
          message: "The DB thread exists, but its stored source path differs from the file that currently parses into this thread.",
          sourcePath: filePath,
          parsedThreadId: parsed.thread.id,
          relatedSourcePaths: threadRow.sourceSessionPath ? [threadRow.sourceSessionPath] : [],
          suggestedAction: "reimport"
        })
      );
    }
  }

  for (const trackedSourceFile of trackedSourceFiles.values()) {
    if (currentSourceFiles.has(trackedSourceFile.sourcePath)) {
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
  runSessionDiagnosis
};

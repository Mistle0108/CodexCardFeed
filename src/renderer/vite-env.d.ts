/// <reference types="vite/client" />

type ShellInfo = {
  productName: string;
  databasePath: string;
  defaultDatabasePath: string;
  schemaVersion: string;
  codexHome: string;
  defaultCodexHome: string;
  overview: {
    schemaVersion: string;
    schemaName: string;
    tables: Array<{
      name: string;
      rowCount: number;
    }>;
    indexNames: string[];
  };
  runtime: {
    node: string;
    chrome: string;
    electron: string;
  };
};

type ImportResult = {
  syncRunId: number;
  startedAt: string;
  completedAt: string;
  codexHome: string;
  sessionsRoot: string;
  scannedFiles: number;
  importedThreads: number;
  importedTurns: number;
  importedItems: number;
  importedProjects: number;
  skippedFiles: number;
  newFiles: number;
  changedFiles: number;
  unchangedFiles: number;
  missingFiles: number;
  errorFiles: number;
  reparsedFiles: number;
  rebuiltLibrary: boolean;
  forcedFileReparse: boolean;
  warnings: Array<{
    scope: string;
    filePath: string | null;
    code: string;
    message: string;
    lineNumber: number | null;
  }>;
  validationSummary: {
    warningCount: number;
    errorCount: number;
    sessionIndex: {
      lineCount: number;
      validEntryCount: number;
      invalidLineCount: number;
    };
    globalState: {
      readCount: number;
    };
    observedTypes: {
      topLevel: Array<{
        type: string;
        count: number;
      }>;
      eventMsg: Array<{
        type: string;
        count: number;
      }>;
      responseItem: Array<{
        type: string;
        count: number;
      }>;
    };
  };
  errors: Array<{
    code?: string;
    filePath: string | null;
    reason: string;
  }>;
  overview: ShellInfo["overview"];
};

type ProjectListItem = {
  id: string;
  displayName: string;
  sourceKind: string;
  sourcePath: string;
  sourceSessionPaths: string[];
  projectStatus: "active" | "historical" | "removed";
  threadCount: number;
  turnCount: number;
  lastActivityAt: string | null;
};

type ThreadListItem = {
  id: string;
  projectId: string;
  projectDisplayName: string | null;
  title: string;
  sourceTitle: string;
  preview: string;
  sourceCwd: string | null;
  sourceSessionPath: string | null;
  updatedAt: string | null;
  lastSeenAt: string | null;
  isPinned: boolean;
  turnCount: number;
  completedTurnCount: number;
};

type LocalOverrideInput = {
  displayTitle?: string | null;
  isPinned?: boolean;
};

type TurnListItem = {
  id: string;
  threadId: string;
  ordinal: number;
  displayTitle: string | null;
  firstUserSnippet: string;
  firstAssistantSnippet: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  lastSeenAt: string | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  tokenEventCount: number;
  isPinned: boolean;
  itemCount: number;
};

type TurnItem = {
  id: string;
  turnId: string;
  ordinal: number;
  role: string;
  kind: string;
  textContent: string;
  rawJson: string;
  createdAt: string | null;
};

type IntegritySampleRef = {
  label: string;
  isNew: boolean;
  threadId: string | null;
  turnId: string | null;
};

type IntegrityCheckResult = {
  key: string;
  label: string;
  description: string;
  severity: "error" | "warning";
  status: "pass" | "fail";
  affectedCount: number;
  newAffectedCount: number;
  sampleRefs: IntegritySampleRef[];
  message: string;
};

type IntegrityReport = {
  checkedAt: string;
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    newIssueCount: number;
    errorCount: number;
    warningCount: number;
  };
  checks: IntegrityCheckResult[];
};

type SessionDiagnosisIssue = {
  code: string;
  category: "duplicate" | "import_gap" | "source_problem" | "parse_problem";
  severity: "error" | "warning";
  title: string;
  message: string;
  sourcePath: string | null;
  parsedThreadId: string | null;
  trackedThreadId: string | null;
  trackedStatus: string | null;
  relatedSourcePaths: string[];
  relatedThreadIds: string[];
  suggestedAction: "reimport" | "restore_source" | "inspect_mapping" | "inspect_db" | "inspect_source" | "inspect";
  lastImportedAt: string | null;
  lastError: string | null;
};

type SessionDiagnosisReport = {
  checkedAt: string;
  codexHome: string;
  sessionsRoot: string;
  summary: {
    scannedFiles: number;
    trackedFiles: number;
    dbThreads: number;
    duplicateCount: number;
    newDuplicateCount: number;
    importGapCount: number;
    newImportGapCount: number;
    sourceProblemCount: number;
    newSourceProblemCount: number;
    parseProblemCount: number;
    newParseProblemCount: number;
    totalIssueCount: number;
    newTotalIssueCount: number;
  };
  duplicates: SessionDiagnosisIssue[];
  importGaps: SessionDiagnosisIssue[];
  sourceProblems: SessionDiagnosisIssue[];
  parseProblems: SessionDiagnosisIssue[];
};

interface Window {
  codexCardFeed: {
    getShellInfo(): Promise<ShellInfo>;
    importCodexSessions(): Promise<ImportResult>;
    openCodexThread(threadId: string): Promise<void>;
    saveThreadOverride(threadId: string, changes: LocalOverrideInput): Promise<void>;
    saveTurnOverride(turnId: string, changes: LocalOverrideInput): Promise<void>;
    updateCodexHome(codexHome: string): Promise<ShellInfo>;
    resetCodexHome(): Promise<ShellInfo>;
    updateDatabasePath(databasePath: string): Promise<ShellInfo>;
    resetDatabasePath(): Promise<ShellInfo>;
    runIntegrityCheck(): Promise<IntegrityReport>;
    runSessionDiagnosis(): Promise<SessionDiagnosisReport>;
    listProjects(): Promise<ProjectListItem[]>;
    listThreads(projectId?: string | null): Promise<ThreadListItem[]>;
    listTurns(threadId: string): Promise<TurnListItem[]>;
    listTurnItems(turnId: string): Promise<TurnItem[]>;
  };
}

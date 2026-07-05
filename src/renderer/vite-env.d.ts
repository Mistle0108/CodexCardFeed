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
  isSidebarProject: boolean;
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

type IntegrityCheckResult = {
  key: string;
  label: string;
  description: string;
  severity: "error" | "warning";
  status: "pass" | "fail";
  affectedCount: number;
  sampleRefs: string[];
  message: string;
};

type IntegrityReport = {
  checkedAt: string;
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    errorCount: number;
    warningCount: number;
  };
  checks: IntegrityCheckResult[];
};

interface Window {
  codexCardFeed: {
    getShellInfo(): Promise<ShellInfo>;
    importCodexSessions(): Promise<ImportResult>;
    openCodexThread(threadId: string): Promise<void>;
    updateCodexHome(codexHome: string): Promise<ShellInfo>;
    resetCodexHome(): Promise<ShellInfo>;
    updateDatabasePath(databasePath: string): Promise<ShellInfo>;
    resetDatabasePath(): Promise<ShellInfo>;
    runIntegrityCheck(): Promise<IntegrityReport>;
    listProjects(): Promise<ProjectListItem[]>;
    listThreads(projectId?: string | null): Promise<ThreadListItem[]>;
    listTurns(threadId: string): Promise<TurnListItem[]>;
    listTurnItems(turnId: string): Promise<TurnItem[]>;
  };
}

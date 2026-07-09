type PathActionState = {
  tone: "success" | "error";
  message: string;
};

type SidebarPathPanelProps = {
  shellInfo: ShellInfo | null;
  isPathPanelOpen: boolean;
  codexHomeDraft: string;
  databasePathDraft: string;
  canSaveCodexHome: boolean;
  canSaveDatabasePath: boolean;
  isSavingPathKey: "codexHome" | "databasePath" | null;
  isExportingBackup: boolean;
  isOpeningBackup: boolean;
  backupActionState: PathActionState | null;
  restoreActionState: PathActionState | null;
  pathActionError: string | null;
  onCodexHomeDraftChange: (value: string) => void;
  onSaveCodexHome: () => void | Promise<void>;
  onResetCodexHome: () => void | Promise<void>;
  onDatabasePathDraftChange: (value: string) => void;
  onSaveDatabasePath: () => void | Promise<void>;
  onResetDatabasePath: () => void | Promise<void>;
  onExportBackupBundle: () => void | Promise<void>;
  onOpenBackupBundle: () => void | Promise<void>;
};

function renderActionState(actionState: PathActionState | null) {
  if (!actionState) {
    return null;
  }

  return (
    <p className={actionState.tone === "error" ? "path-panel-error" : "path-panel-success"}>
      {actionState.message}
    </p>
  );
}

export function SidebarPathPanel({
  shellInfo,
  isPathPanelOpen,
  codexHomeDraft,
  databasePathDraft,
  canSaveCodexHome,
  canSaveDatabasePath,
  isSavingPathKey,
  isExportingBackup,
  isOpeningBackup,
  backupActionState,
  restoreActionState,
  pathActionError,
  onCodexHomeDraftChange,
  onSaveCodexHome,
  onResetCodexHome,
  onDatabasePathDraftChange,
  onSaveDatabasePath,
  onResetDatabasePath,
  onExportBackupBundle,
  onOpenBackupBundle
}: SidebarPathPanelProps) {
  if (!isPathPanelOpen) {
    return null;
  }

  return (
    <div className="path-panel">
      <section className="path-panel-item">
        <div className="path-panel-item-header">
          <strong>Codex source path</strong>
          <span className="mini-meta">Used on next import</span>
        </div>
        <p className="path-panel-value">
          <span>Current</span>
          <span>{shellInfo?.codexHome ?? "Loading..."}</span>
        </p>
        <p className="path-panel-value path-panel-default">
          <span>Default</span>
          <span>{shellInfo?.defaultCodexHome ?? "Loading..."}</span>
        </p>
        <input
          className="path-panel-input"
          onChange={(event) => onCodexHomeDraftChange(event.target.value)}
          placeholder="C:\\Users\\name\\.codex"
          type="text"
          value={codexHomeDraft}
        />
        <div className="path-panel-actions">
          <button
            className="sidebar-collapse-toggle"
            disabled={!canSaveCodexHome || isSavingPathKey !== null}
            onClick={() => void onSaveCodexHome()}
            type="button"
          >
            {isSavingPathKey === "codexHome" ? "Saving..." : "Save"}
          </button>
          <button
            className="sidebar-collapse-toggle"
            disabled={!shellInfo || isSavingPathKey !== null}
            onClick={() => void onResetCodexHome()}
            type="button"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="path-panel-item">
        <div className="path-panel-item-header">
          <strong>Database path</strong>
          <span className="mini-meta">Reopens DB immediately</span>
        </div>
        <p className="path-panel-value">
          <span>Current</span>
          <span>{shellInfo?.databasePath ?? "Loading..."}</span>
        </p>
        <p className="path-panel-value path-panel-default">
          <span>Default</span>
          <span>{shellInfo?.defaultDatabasePath ?? "Loading..."}</span>
        </p>
        <input
          className="path-panel-input"
          onChange={(event) => onDatabasePathDraftChange(event.target.value)}
          placeholder="C:\\path\\to\\codex-card-feed.sqlite"
          type="text"
          value={databasePathDraft}
        />
        <div className="path-panel-actions">
          <button
            className="sidebar-collapse-toggle"
            disabled={!canSaveDatabasePath || isSavingPathKey !== null}
            onClick={() => void onSaveDatabasePath()}
            type="button"
          >
            {isSavingPathKey === "databasePath" ? "Saving..." : "Save"}
          </button>
          <button
            className="sidebar-collapse-toggle"
            disabled={!shellInfo || isSavingPathKey !== null}
            onClick={() => void onResetDatabasePath()}
            type="button"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="path-panel-item">
        <div className="path-panel-item-header">
          <strong>Backup export</strong>
          <span className="mini-meta">SQLite snapshot and settings JSON</span>
        </div>
        <p className="path-panel-value">
          <span>Contents</span>
          <span>Database snapshot, path settings, backup manifest</span>
        </p>
        <div className="path-panel-actions">
          <button
            className="sidebar-collapse-toggle"
            disabled={!shellInfo || isSavingPathKey !== null || isExportingBackup}
            onClick={() => void onExportBackupBundle()}
            type="button"
          >
            {isExportingBackup ? "Exporting..." : "Export Backup"}
          </button>
        </div>
        {renderActionState(backupActionState)}
      </section>

      <section className="path-panel-item">
        <div className="path-panel-item-header">
          <strong>Restore / open backup</strong>
          <span className="mini-meta">Switches the current DB immediately</span>
        </div>
        <p className="path-panel-value">
          <span>Behavior</span>
          <span>Opens a backup folder and reuses its SQLite snapshot as the active library</span>
        </p>
        <div className="path-panel-actions">
          <button
            className="sidebar-collapse-toggle"
            disabled={!shellInfo || isSavingPathKey !== null || isOpeningBackup}
            onClick={() => void onOpenBackupBundle()}
            type="button"
          >
            {isOpeningBackup ? "Opening..." : "Open Backup"}
          </button>
        </div>
        {renderActionState(restoreActionState)}
      </section>

      {pathActionError ? <p className="path-panel-error">{pathActionError}</p> : null}
    </div>
  );
}

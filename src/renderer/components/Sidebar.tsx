import type { ReactNode } from "react";

type PathActionState = {
  tone: "success" | "error";
  message: string;
};

type SidebarProps = {
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
  isImporting: boolean;
  isMetadataFilterActive: boolean;
  metadataTagFilter: string;
  isPinnedFilterActive: boolean;
  isMemoFilterActive: boolean;
  isProjectsCollapsed: boolean;
  isHistoricalCollapsed: boolean;
  isChatsCollapsed: boolean;
  isLibraryLoading: boolean;
  sidebarProjects: ProjectListItem[];
  activeProjects: ProjectListItem[];
  allHistoricalProjects: ProjectListItem[];
  historicalProjects: ProjectListItem[];
  chatThreads: ThreadListItem[];
  matchingChatThreads: ThreadListItem[];
  matchingProjectThreadsByProjectId: Record<string, ThreadListItem[]>;
  threadsByProjectId: Record<string, ThreadListItem[]>;
  expandedProjectIds: Record<string, boolean>;
  selectedThread: ThreadListItem | null;
  selectedThreadId: string | null;
  normalizedSidebarSearchTerms: string[];
  formatDateTime: (value: string | null) => string;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  formatFilteredCountLabel: (
    visibleCount: number,
    totalCount: number,
    singular: string,
    plural?: string
  ) => string;
  renderHighlightedText: (text: string, searchTerms: string[]) => ReactNode;
  getMatchingTagValues: (tags: string[], searchTerms: string[]) => string[];
  onOpenDiagnosticsModal: () => void;
  onTogglePathPanel: () => void;
  onCodexHomeDraftChange: (value: string) => void;
  onSaveCodexHome: () => void | Promise<void>;
  onResetCodexHome: () => void | Promise<void>;
  onDatabasePathDraftChange: (value: string) => void;
  onSaveDatabasePath: () => void | Promise<void>;
  onResetDatabasePath: () => void | Promise<void>;
  onExportBackupBundle: () => void | Promise<void>;
  onOpenBackupBundle: () => void | Promise<void>;
  onImportSessions: () => void | Promise<void>;
  onMetadataTagFilterChange: (value: string) => void;
  onResetMetadataFilters: () => void;
  onTogglePinnedFilter: () => void;
  onToggleMemoFilter: () => void;
  onToggleProjectsCollapsed: () => void;
  onToggleHistoricalCollapsed: () => void;
  onToggleChatsCollapsed: () => void;
  onProjectToggle: (projectId: string) => void;
  onOpenProjectModal: (projectId: string) => void;
  onThreadSelect: (threadId: string) => void;
};

export function Sidebar({
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
  isImporting,
  isMetadataFilterActive,
  metadataTagFilter,
  isPinnedFilterActive,
  isMemoFilterActive,
  isProjectsCollapsed,
  isHistoricalCollapsed,
  isChatsCollapsed,
  isLibraryLoading,
  sidebarProjects,
  activeProjects,
  allHistoricalProjects,
  historicalProjects,
  chatThreads,
  matchingChatThreads,
  matchingProjectThreadsByProjectId,
  threadsByProjectId,
  expandedProjectIds,
  selectedThread,
  selectedThreadId,
  normalizedSidebarSearchTerms,
  formatDateTime,
  formatCountLabel,
  formatFilteredCountLabel,
  renderHighlightedText,
  getMatchingTagValues,
  onOpenDiagnosticsModal,
  onTogglePathPanel,
  onCodexHomeDraftChange,
  onSaveCodexHome,
  onResetCodexHome,
  onDatabasePathDraftChange,
  onSaveDatabasePath,
  onResetDatabasePath,
  onExportBackupBundle,
  onOpenBackupBundle,
  onImportSessions,
  onMetadataTagFilterChange,
  onResetMetadataFilters,
  onTogglePinnedFilter,
  onToggleMemoFilter,
  onToggleProjectsCollapsed,
  onToggleHistoricalCollapsed,
  onToggleChatsCollapsed,
  onProjectToggle,
  onOpenProjectModal,
  onThreadSelect
}: SidebarProps) {
  return (
    <aside className="sidebar-shell">
      <div className="sidebar-brand">
        <p className="sidebar-kicker">Codex conversation browser</p>
        <div className="sidebar-brand-row">
          <h1>CodexCardFeed</h1>
          <div className="sidebar-brand-actions">
            <button
              className="sidebar-utility-button"
              onClick={onOpenDiagnosticsModal}
              type="button"
            >
              Diagnostics
            </button>
            <button
              aria-expanded={isPathPanelOpen}
              className="sidebar-utility-button"
              onClick={onTogglePathPanel}
              type="button"
            >
              Paths
            </button>
          </div>
        </div>

        {isPathPanelOpen ? (
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
              {backupActionState ? (
                <p
                  className={
                    backupActionState.tone === "error"
                      ? "path-panel-error"
                      : "path-panel-success"
                  }
                >
                  {backupActionState.message}
                </p>
              ) : null}
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
              {restoreActionState ? (
                <p
                  className={
                    restoreActionState.tone === "error"
                      ? "path-panel-error"
                      : "path-panel-success"
                  }
                >
                  {restoreActionState.message}
                </p>
              ) : null}
            </section>

            {pathActionError ? <p className="path-panel-error">{pathActionError}</p> : null}
          </div>
        ) : null}
      </div>

      <button
        className="sidebar-action"
        disabled={isImporting}
        onClick={() => void onImportSessions()}
        type="button"
      >
        {isImporting ? "Importing..." : "Import Sessions"}
      </button>

      <div className="sidebar-scroll-area">
        <section className="path-panel sidebar-filter-panel">
          <section className="path-panel-item">
            <div className="path-panel-item-header">
              <strong>Filters</strong>
              {isMetadataFilterActive ? (
                <button
                  className="sidebar-collapse-toggle"
                  onClick={onResetMetadataFilters}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <p className="sidebar-filter-copy">Applies to projects, chats, and thread lists.</p>
            <input
              className="path-panel-input sidebar-filter-input"
              onChange={(event) => onMetadataTagFilterChange(event.target.value)}
              placeholder="Search projects, threads, tags"
              type="text"
              value={metadataTagFilter}
            />
            <div className="sidebar-filter-actions">
              <button
                className={`sidebar-filter-chip ${isPinnedFilterActive ? "is-active" : ""}`}
                onClick={onTogglePinnedFilter}
                type="button"
              >
                Pinned
              </button>
              <button
                className={`sidebar-filter-chip ${isMemoFilterActive ? "is-active" : ""}`}
                onClick={onToggleMemoFilter}
                type="button"
              >
                Has memo
              </button>
            </div>
          </section>
        </section>

        <section
          className={`sidebar-section sidebar-projects ${isProjectsCollapsed ? "is-collapsed" : ""}`}
        >
          <div className="sidebar-section-header">
            <div>
              <h2>Projects</h2>
              <p>{formatFilteredCountLabel(sidebarProjects.length, activeProjects.length, "project")}</p>
            </div>
            <div className="sidebar-section-header-actions">
              {isLibraryLoading ? <span className="sidebar-pill">Loading</span> : null}
              <button
                aria-expanded={!isProjectsCollapsed}
                className="sidebar-collapse-toggle"
                onClick={onToggleProjectsCollapsed}
                type="button"
              >
                {isProjectsCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          </div>

          {!isProjectsCollapsed && sidebarProjects.length ? (
            <div className="sidebar-project-list">
              {sidebarProjects.map((project) => {
                const visibleProjectThreads = isMetadataFilterActive
                  ? (matchingProjectThreadsByProjectId[project.id] ?? [])
                  : (threadsByProjectId[project.id] ?? []);
                const isProjectExpanded = isMetadataFilterActive
                  ? visibleProjectThreads.length > 0
                  : Boolean(expandedProjectIds[project.id]);
                const matchingProjectTags = getMatchingTagValues(
                  project.tags,
                  normalizedSidebarSearchTerms
                );

                return (
                  <article className="sidebar-project-group" key={project.id}>
                    <div className="sidebar-project-card">
                      <button
                        className={`sidebar-project-button ${
                          selectedThread?.projectId === project.id ? "is-active" : ""
                        }`}
                        onClick={() => onProjectToggle(project.id)}
                        type="button"
                      >
                        <div className="sidebar-project-heading">
                          <div className="sidebar-project-title-row">
                            <strong>
                              {renderHighlightedText(
                                project.displayName,
                                normalizedSidebarSearchTerms
                              )}
                            </strong>
                            {project.isPinned ? (
                              <span className="sidebar-pin-badge">Pinned</span>
                            ) : null}
                          </div>
                        </div>
                        {matchingProjectTags.length ? (
                          <div className="sidebar-search-tag-list">
                            {matchingProjectTags.map((tag) => (
                              <span className="sidebar-search-tag" key={tag}>
                                {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="sidebar-item-meta">
                          <span>
                            {formatCountLabel(project.threadCount, "thread")} /{" "}
                            {formatCountLabel(project.turnCount, "turn")}
                          </span>
                          <span>{formatDateTime(project.lastActivityAt)}</span>
                        </div>
                      </button>
                      <div className="sidebar-project-actions">
                        <button
                          aria-label={`Manage ${project.displayName}`}
                          className="sidebar-project-action-button"
                          onClick={() => onOpenProjectModal(project.id)}
                          type="button"
                        >
                          ...
                        </button>
                      </div>
                    </div>

                    {isProjectExpanded ? (
                      <div className="sidebar-project-thread-list">
                        {visibleProjectThreads.map((thread) => {
                          const matchingThreadTags = getMatchingTagValues(
                            thread.tags,
                            normalizedSidebarSearchTerms
                          );

                          return (
                            <button
                              className={`sidebar-project-thread-button ${
                                selectedThreadId === thread.id ? "is-active" : ""
                              }`}
                              key={thread.id}
                              onClick={() => onThreadSelect(thread.id)}
                              type="button"
                            >
                              <span className="sidebar-thread-row">
                                <span className="sidebar-thread-title">
                                  {renderHighlightedText(thread.title, normalizedSidebarSearchTerms)}
                                </span>
                                {thread.isPinned ? (
                                  <span className="sidebar-pin-badge">Pinned</span>
                                ) : null}
                              </span>
                              {matchingThreadTags.length ? (
                                <span className="sidebar-thread-search-tags">
                                  {matchingThreadTags.map((tag) => (
                                    <span className="sidebar-search-tag" key={tag}>
                                      {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : !isProjectsCollapsed ? (
            <p className="sidebar-empty-state">
              {isMetadataFilterActive
                ? "No projects match the current filters."
                : "No current Codex projects were found."}
            </p>
          ) : null}
        </section>

        {allHistoricalProjects.length ? (
          <section
            className={`sidebar-section sidebar-historical ${
              isHistoricalCollapsed ? "is-collapsed" : ""
            }`}
          >
            <div className="sidebar-section-header">
              <div>
                <h2>Historical</h2>
                <p>
                  {formatFilteredCountLabel(
                    historicalProjects.length,
                    allHistoricalProjects.length,
                    "project"
                  )}
                </p>
              </div>
              <div className="sidebar-section-header-actions">
                <button
                  aria-expanded={!isHistoricalCollapsed}
                  className="sidebar-collapse-toggle"
                  onClick={onToggleHistoricalCollapsed}
                  type="button"
                >
                  {isHistoricalCollapsed ? "Show" : "Hide"}
                </button>
              </div>
            </div>

            {!isHistoricalCollapsed ? (
              <div className="sidebar-project-list">
                {historicalProjects.map((project) => {
                  const visibleProjectThreads = isMetadataFilterActive
                    ? (matchingProjectThreadsByProjectId[project.id] ?? [])
                    : (threadsByProjectId[project.id] ?? []);
                  const isProjectExpanded = isMetadataFilterActive
                    ? visibleProjectThreads.length > 0
                    : Boolean(expandedProjectIds[project.id]);
                  const matchingProjectTags = getMatchingTagValues(
                    project.tags,
                    normalizedSidebarSearchTerms
                  );

                  return (
                    <article className="sidebar-project-group" key={project.id}>
                      <div className="sidebar-project-card">
                        <button
                          className={`sidebar-project-button ${
                            selectedThread?.projectId === project.id ? "is-active" : ""
                          }`}
                          onClick={() => onProjectToggle(project.id)}
                          type="button"
                        >
                          <div className="sidebar-project-heading">
                            <div className="sidebar-project-title-row">
                              <strong>
                                {renderHighlightedText(
                                  project.displayName,
                                  normalizedSidebarSearchTerms
                                )}
                              </strong>
                              {project.isPinned ? (
                                <span className="sidebar-pin-badge">Pinned</span>
                              ) : null}
                              <span
                                className={`sidebar-status-badge ${
                                  project.projectStatus === "removed"
                                    ? "is-removed"
                                    : "is-historical"
                                }`}
                              >
                                {project.projectStatus}
                              </span>
                            </div>
                          </div>
                          {matchingProjectTags.length ? (
                            <div className="sidebar-search-tag-list">
                              {matchingProjectTags.map((tag) => (
                                <span className="sidebar-search-tag" key={tag}>
                                  {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="sidebar-item-meta">
                            <span>
                              {formatCountLabel(project.threadCount, "thread")} /{" "}
                              {formatCountLabel(project.turnCount, "turn")}
                            </span>
                            <span>{formatDateTime(project.lastActivityAt)}</span>
                          </div>
                        </button>
                        <div className="sidebar-project-actions">
                          <button
                            aria-label={`Manage ${project.displayName}`}
                            className="sidebar-project-action-button"
                            onClick={() => onOpenProjectModal(project.id)}
                            type="button"
                          >
                            ...
                          </button>
                        </div>
                      </div>

                      {isProjectExpanded ? (
                        <div className="sidebar-project-thread-list">
                          {visibleProjectThreads.map((thread) => {
                            const matchingThreadTags = getMatchingTagValues(
                              thread.tags,
                              normalizedSidebarSearchTerms
                            );

                            return (
                              <button
                                className={`sidebar-project-thread-button ${
                                  selectedThreadId === thread.id ? "is-active" : ""
                                }`}
                                key={thread.id}
                                onClick={() => onThreadSelect(thread.id)}
                                type="button"
                              >
                                <span className="sidebar-thread-row">
                                  <span className="sidebar-thread-title">
                                    {renderHighlightedText(
                                      thread.title,
                                      normalizedSidebarSearchTerms
                                    )}
                                  </span>
                                  {thread.isPinned ? (
                                    <span className="sidebar-pin-badge">Pinned</span>
                                  ) : null}
                                </span>
                                {matchingThreadTags.length ? (
                                  <span className="sidebar-thread-search-tags">
                                    {matchingThreadTags.map((tag) => (
                                      <span className="sidebar-search-tag" key={tag}>
                                        {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                                      </span>
                                    ))}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : historicalProjects.length ? null : (
              <p className="sidebar-empty-state">
                No historical projects match the current filters.
              </p>
            )}
          </section>
        ) : null}

        <section className={`sidebar-section sidebar-chats ${isChatsCollapsed ? "is-collapsed" : ""}`}>
          <div className="sidebar-section-header">
            <div>
              <h2>Chats</h2>
              <p>{formatFilteredCountLabel(matchingChatThreads.length, chatThreads.length, "chat")}</p>
            </div>
            <div className="sidebar-section-header-actions">
              <button
                aria-expanded={!isChatsCollapsed}
                className="sidebar-collapse-toggle"
                onClick={onToggleChatsCollapsed}
                type="button"
              >
                {isChatsCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          </div>

          {!isChatsCollapsed && matchingChatThreads.length ? (
            <div className="sidebar-chat-list">
              {matchingChatThreads.map((thread) => {
                const matchingThreadTags = getMatchingTagValues(
                  thread.tags,
                  normalizedSidebarSearchTerms
                );

                return (
                  <button
                    key={thread.id}
                    className={`sidebar-chat-button ${selectedThreadId === thread.id ? "is-active" : ""}`}
                    onClick={() => onThreadSelect(thread.id)}
                    type="button"
                  >
                    <div className="sidebar-chat-heading">
                      <strong>{renderHighlightedText(thread.title, normalizedSidebarSearchTerms)}</strong>
                      {thread.isPinned ? <span className="sidebar-pin-badge">Pinned</span> : null}
                    </div>
                    {matchingThreadTags.length ? (
                      <div className="sidebar-search-tag-list">
                        {matchingThreadTags.map((tag) => (
                          <span className="sidebar-search-tag" key={tag}>
                            {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="sidebar-item-meta">
                      <span>{formatCountLabel(thread.turnCount, "turn")}</span>
                      <span>{formatDateTime(thread.updatedAt ?? thread.lastSeenAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !isChatsCollapsed ? (
            <p className="sidebar-empty-state">
              {isMetadataFilterActive
                ? "No chats match the current filters."
                : "Import Codex sessions to load chats."}
            </p>
          ) : null}
        </section>
      </div>
    </aside>
  );
}

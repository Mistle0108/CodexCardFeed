import type { ReactNode } from "react";
import { SidebarLibraryContent } from "./sidebar/SidebarLibraryContent";
import { SidebarPathPanel } from "./sidebar/SidebarPathPanel";

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

        <SidebarPathPanel
          backupActionState={backupActionState}
          canSaveCodexHome={canSaveCodexHome}
          canSaveDatabasePath={canSaveDatabasePath}
          codexHomeDraft={codexHomeDraft}
          databasePathDraft={databasePathDraft}
          isExportingBackup={isExportingBackup}
          isOpeningBackup={isOpeningBackup}
          isPathPanelOpen={isPathPanelOpen}
          isSavingPathKey={isSavingPathKey}
          onCodexHomeDraftChange={onCodexHomeDraftChange}
          onDatabasePathDraftChange={onDatabasePathDraftChange}
          onExportBackupBundle={onExportBackupBundle}
          onOpenBackupBundle={onOpenBackupBundle}
          onResetCodexHome={onResetCodexHome}
          onResetDatabasePath={onResetDatabasePath}
          onSaveCodexHome={onSaveCodexHome}
          onSaveDatabasePath={onSaveDatabasePath}
          pathActionError={pathActionError}
          restoreActionState={restoreActionState}
          shellInfo={shellInfo}
        />
      </div>

      <button
        className="sidebar-action"
        disabled={isImporting}
        onClick={() => void onImportSessions()}
        type="button"
      >
        {isImporting ? "Importing..." : "Import Sessions"}
      </button>

      <SidebarLibraryContent
        activeProjects={activeProjects}
        allHistoricalProjects={allHistoricalProjects}
        chatThreads={chatThreads}
        expandedProjectIds={expandedProjectIds}
        formatCountLabel={formatCountLabel}
        formatDateTime={formatDateTime}
        formatFilteredCountLabel={formatFilteredCountLabel}
        getMatchingTagValues={getMatchingTagValues}
        historicalProjects={historicalProjects}
        isChatsCollapsed={isChatsCollapsed}
        isHistoricalCollapsed={isHistoricalCollapsed}
        isLibraryLoading={isLibraryLoading}
        isMemoFilterActive={isMemoFilterActive}
        isMetadataFilterActive={isMetadataFilterActive}
        isPinnedFilterActive={isPinnedFilterActive}
        isProjectsCollapsed={isProjectsCollapsed}
        matchingChatThreads={matchingChatThreads}
        matchingProjectThreadsByProjectId={matchingProjectThreadsByProjectId}
        metadataTagFilter={metadataTagFilter}
        normalizedSidebarSearchTerms={normalizedSidebarSearchTerms}
        onMetadataTagFilterChange={onMetadataTagFilterChange}
        onOpenProjectModal={onOpenProjectModal}
        onProjectToggle={onProjectToggle}
        onResetMetadataFilters={onResetMetadataFilters}
        onThreadSelect={onThreadSelect}
        onToggleChatsCollapsed={onToggleChatsCollapsed}
        onToggleHistoricalCollapsed={onToggleHistoricalCollapsed}
        onToggleMemoFilter={onToggleMemoFilter}
        onTogglePinnedFilter={onTogglePinnedFilter}
        onToggleProjectsCollapsed={onToggleProjectsCollapsed}
        renderHighlightedText={renderHighlightedText}
        selectedThread={selectedThread}
        selectedThreadId={selectedThreadId}
        sidebarProjects={sidebarProjects}
        threadsByProjectId={threadsByProjectId}
      />
    </aside>
  );
}

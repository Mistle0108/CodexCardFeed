import type { ComponentProps } from "react";
import { DiagnosticsModal } from "../components/DiagnosticsModal";
import { ProjectDetailModal } from "../components/ProjectDetailModal";
import { Sidebar } from "../components/Sidebar";
import { TurnDetailModal } from "../components/TurnDetailModal";
import { WorkspacePanel } from "../components/WorkspacePanel";
import {
  formatCountLabel,
  formatDateTime,
  formatFilteredCountLabel,
  formatInteger,
  formatSuggestedActionLabel,
  formatTokenLabel,
  formatTotalAndNewLabel,
  getAdditionalSearchExcerpt,
  getAnswerPreview,
  getMatchingMemoExcerpt,
  getMatchingTagValues,
  getQuestionPreview,
  getRoleClassName,
  getTurnHeading,
  renderHighlightedText
} from "../lib/app-utils";
import { getItemPresentation, isMarkdownDetailItem } from "../lib/turn-item-presentation";

type BrowseViewState = ReturnType<typeof import("../hooks/useBrowseViewState").useBrowseViewState>;
type LibraryState = ReturnType<typeof import("../hooks/useLibraryData").useLibraryData>;
type GlobalSearchState = ReturnType<
  typeof import("../hooks/useGlobalTurnSearch").useGlobalTurnSearch
>;
type MaintenanceState = ReturnType<
  typeof import("../hooks/useMaintenanceActions").useMaintenanceActions
>;
type MetadataManagementState = ReturnType<
  typeof import("../hooks/useMetadataManagement").useMetadataManagement
>;
type SelectionState = ReturnType<typeof import("../hooks/useSelectionState").useSelectionState>;
type SidebarState = ReturnType<typeof import("../hooks/useSidebarState").useSidebarState>;

type AppViewPropsArgs = {
  libraryState: LibraryState;
  globalSearchState: GlobalSearchState;
  sidebarState: SidebarState;
  selectionState: SelectionState;
  metadataManagement: MetadataManagementState;
  maintenanceState: MaintenanceState;
  browseViewState: BrowseViewState;
  handleImportSessions: () => Promise<void>;
  handleOpenGlobalSearchResult: (result: TurnSearchResult) => void;
  handleThreadSelectInWorkspace: (threadId: string) => void;
  handleProjectTagInputKeyDown: ComponentProps<
    typeof ProjectDetailModal
  >["onProjectTagInputKeyDown"];
  handleThreadTagInputKeyDown: ComponentProps<
    typeof WorkspacePanel
  >["onThreadTagInputKeyDown"];
  handleTurnTagInputKeyDown: ComponentProps<
    typeof TurnDetailModal
  >["onTurnTagInputKeyDown"];
  handleOpenIntegritySampleInTurns: ComponentProps<
    typeof DiagnosticsModal
  >["onOpenIntegritySample"];
  detailTextPreviewLength: number;
};

export function useAppViewProps({
  libraryState,
  globalSearchState,
  sidebarState,
  selectionState,
  metadataManagement,
  maintenanceState,
  browseViewState,
  handleImportSessions,
  handleOpenGlobalSearchResult,
  handleThreadSelectInWorkspace,
  handleProjectTagInputKeyDown,
  handleThreadTagInputKeyDown,
  handleTurnTagInputKeyDown,
  handleOpenIntegritySampleInTurns,
  detailTextPreviewLength
}: AppViewPropsArgs) {
  const sidebarProps: ComponentProps<typeof Sidebar> = {
    activeProjects: browseViewState.activeProjects,
    allHistoricalProjects: browseViewState.allHistoricalProjects,
    backupActionState: maintenanceState.backupActionState,
    canSaveCodexHome: maintenanceState.canSaveCodexHome,
    canSaveDatabasePath: maintenanceState.canSaveDatabasePath,
    chatThreads: browseViewState.chatThreads,
    codexHomeDraft: maintenanceState.codexHomeDraft,
    databasePathDraft: maintenanceState.databasePathDraft,
    expandedProjectIds: sidebarState.expandedProjectIds,
    formatCountLabel,
    formatDateTime,
    formatFilteredCountLabel,
    getMatchingTagValues,
    historicalProjects: browseViewState.historicalProjects,
    isChatsCollapsed: sidebarState.isChatsCollapsed,
    isExportingBackup: maintenanceState.isExportingBackup,
    isHistoricalCollapsed: sidebarState.isHistoricalCollapsed,
    isImporting: libraryState.isImporting,
    isLibraryLoading: libraryState.isLibraryLoading,
    isMemoFilterActive: browseViewState.isMemoFilterActive,
    isMetadataFilterActive: browseViewState.isMetadataFilterActive,
    isOpeningBackup: maintenanceState.isOpeningBackup,
    isPathPanelOpen: maintenanceState.isPathPanelOpen,
    isPinnedFilterActive: browseViewState.isPinnedFilterActive,
    isProjectsCollapsed: sidebarState.isProjectsCollapsed,
    isSavingPathKey: maintenanceState.isSavingPathKey,
    matchingChatThreads: browseViewState.matchingChatThreads,
    matchingProjectThreadsByProjectId: browseViewState.matchingProjectThreadsByProjectId,
    metadataTagFilter: browseViewState.metadataTagFilter,
    normalizedSidebarSearchTerms: browseViewState.normalizedSidebarSearchTerms,
    onCodexHomeDraftChange: maintenanceState.setCodexHomeDraft,
    onDatabasePathDraftChange: maintenanceState.setDatabasePathDraft,
    onExportBackupBundle: maintenanceState.handleExportBackupBundle,
    onImportSessions: handleImportSessions,
    onMetadataTagFilterChange: browseViewState.setMetadataTagFilter,
    onOpenBackupBundle: maintenanceState.handleOpenBackupBundle,
    onOpenDiagnosticsModal: selectionState.handleOpenDiagnosticsModal,
    onOpenProjectModal: selectionState.handleOpenProjectModal,
    onProjectToggle: sidebarState.handleProjectToggle,
    onResetCodexHome: maintenanceState.handleResetCodexHome,
    onResetDatabasePath: maintenanceState.handleResetDatabasePath,
    onResetMetadataFilters: browseViewState.handleResetMetadataFilters,
    onSaveCodexHome: maintenanceState.handleSaveCodexHome,
    onSaveDatabasePath: maintenanceState.handleSaveDatabasePath,
    onThreadSelect: handleThreadSelectInWorkspace,
    onToggleChatsCollapsed: sidebarState.handleToggleChatsCollapsed,
    onToggleHistoricalCollapsed: sidebarState.handleToggleHistoricalCollapsed,
    onToggleMemoFilter: browseViewState.handleToggleMemoFilter,
    onTogglePathPanel: maintenanceState.handleTogglePathPanel,
    onTogglePinnedFilter: browseViewState.handleTogglePinnedFilter,
    onToggleProjectsCollapsed: sidebarState.handleToggleProjectsCollapsed,
    pathActionError: maintenanceState.pathActionError,
    renderHighlightedText,
    restoreActionState: maintenanceState.restoreActionState,
    selectedThread: metadataManagement.selectedThread,
    selectedThreadId: selectionState.selectedThreadId,
    shellInfo: libraryState.shellInfo,
    sidebarProjects: browseViewState.sidebarProjects,
    threadsByProjectId: browseViewState.threadsByProjectId
  };

  const workspacePanelProps: ComponentProps<typeof WorkspacePanel> = {
    activeSearchTab: globalSearchState.activeSearchTab,
    activeWorkspaceTabId: globalSearchState.activeWorkspaceTabId,
    canAddThreadTag: metadataManagement.canAddThreadTag,
    canClearThreadMemo: metadataManagement.canClearThreadMemo,
    canResetThreadTitle: metadataManagement.canResetThreadTitle,
    canSaveThreadMemo: metadataManagement.canSaveThreadMemo,
    canSaveThreadTitle: metadataManagement.canSaveThreadTitle,
    formatCountLabel,
    formatDateTime,
    formatFilteredCountLabel,
    formatTokenLabel,
    getAdditionalSearchExcerpt,
    getAnswerPreview,
    getMatchingMemoExcerpt,
    getMatchingTagValues,
    getQuestionPreview,
    getTurnHeading,
    isSavingThreadOverride: metadataManagement.isSavingThreadOverride,
    isThreadMetadataCollapsed: metadataManagement.isThreadMetadataCollapsed,
    isThreadSearchActive: browseViewState.isThreadSearchActive,
    isThreadTitleEditing: metadataManagement.isThreadTitleEditing,
    normalizedThreadSearchTerms: browseViewState.normalizedThreadSearchTerms,
    onAddThreadTag: metadataManagement.handleAddThreadTag,
    onCancelThreadTitleEdit: metadataManagement.handleCancelThreadTitleEdit,
    onClearThreadMemo: metadataManagement.handleClearThreadMemo,
    onClearThreadSearch: browseViewState.handleClearThreadSearch,
    onCloseSearchTab: globalSearchState.handleCloseSearchTab,
    onGlobalSearchInputChange: globalSearchState.setSearchInput,
    onLoadMoreSearchResults: globalSearchState.handleLoadMoreSearchResults,
    onOpenCodexThread: maintenanceState.handleOpenCodexThread,
    onOpenGlobalSearchResult: handleOpenGlobalSearchResult,
    onOpenTurnDetail: selectionState.handleOpenTurnDetail,
    onRemoveThreadTag: metadataManagement.handleRemoveThreadTag,
    onResetThreadMemoDraft: metadataManagement.handleResetThreadMemoDraft,
    onResetThreadTitle: metadataManagement.handleResetThreadTitle,
    onRightPanelModeChange: browseViewState.setRightPanelMode,
    onSearchResultScroll: globalSearchState.handleSearchScroll,
    onSelectSearchTab: globalSearchState.handleSelectSearchTab,
    onSelectThreadTab: globalSearchState.handleSelectThreadTab,
    onSaveThreadMemo: metadataManagement.handleSaveThreadMemo,
    onSaveThreadTitle: metadataManagement.handleSaveThreadTitle,
    onStartThreadTitleEdit: metadataManagement.handleStartThreadTitleEdit,
    onThreadNotesDraftChange: metadataManagement.setThreadNotesDraft,
    onThreadSearchQueryChange: browseViewState.setThreadSearchQuery,
    onThreadTagInputChange: metadataManagement.setThreadTagInputDraft,
    onThreadTagInputKeyDown: handleThreadTagInputKeyDown,
    onThreadTitleDraftChange: metadataManagement.setThreadTitleDraft,
    onToggleThreadMetadataCollapsed: metadataManagement.handleToggleThreadMetadataCollapsed,
    onToggleThreadPin: metadataManagement.handleToggleThreadPin,
    onSubmitGlobalSearch: globalSearchState.handleSubmitSearch,
    questionTurns: browseViewState.questionTurns,
    renderHighlightedText,
    rightPanelMode: browseViewState.rightPanelMode,
    searchInput: globalSearchState.searchInput,
    searchTabs: globalSearchState.searchTabs,
    selectedThread: metadataManagement.selectedThread,
    selectedTurnId: selectionState.selectedTurnId,
    threadNotesDraft: metadataManagement.threadNotesDraft,
    threadSearchQuery: browseViewState.threadSearchQuery,
    threadTagInputDraft: metadataManagement.threadTagInputDraft,
    threadTagsDraft: metadataManagement.threadTagsDraft,
    threadTitleDraft: metadataManagement.threadTitleDraft,
    turns: libraryState.turns,
    visibleTurns: browseViewState.visibleTurns
  };

  const projectDetailModalProps: ComponentProps<typeof ProjectDetailModal> = {
    canAddProjectTag: metadataManagement.canAddProjectTag,
    canClearProjectMemo: metadataManagement.canClearProjectMemo,
    canResetProjectTitle: metadataManagement.canResetProjectTitle,
    canSaveProjectMemo: metadataManagement.canSaveProjectMemo,
    canSaveProjectTitle: metadataManagement.canSaveProjectTitle,
    formatCountLabel,
    formatDateTime,
    isProjectMetadataCollapsed: metadataManagement.isProjectMetadataCollapsed,
    isProjectTitleEditing: metadataManagement.isProjectTitleEditing,
    isSavingProjectOverride: metadataManagement.isSavingProjectOverride,
    onAddProjectTag: metadataManagement.handleAddProjectTag,
    onCancelProjectTitleEdit: metadataManagement.handleCancelProjectTitleEdit,
    onClearProjectMemo: metadataManagement.handleClearProjectMemo,
    onClose: selectionState.handleCloseProjectModal,
    onProjectNotesDraftChange: metadataManagement.setProjectNotesDraft,
    onProjectTagInputChange: metadataManagement.setProjectTagInputDraft,
    onProjectTagInputKeyDown: handleProjectTagInputKeyDown,
    onProjectTitleDraftChange: metadataManagement.setProjectTitleDraft,
    onRemoveProjectTag: metadataManagement.handleRemoveProjectTag,
    onResetProjectMemoDraft: metadataManagement.handleResetProjectMemoDraft,
    onResetProjectTitle: metadataManagement.handleResetProjectTitle,
    onSaveProjectMemo: metadataManagement.handleSaveProjectMemo,
    onSaveProjectTitle: metadataManagement.handleSaveProjectTitle,
    onStartProjectTitleEdit: metadataManagement.handleStartProjectTitleEdit,
    onToggleProjectMetadataCollapsed: metadataManagement.handleToggleProjectMetadataCollapsed,
    onToggleProjectPin: metadataManagement.handleToggleProjectPin,
    projectNotesDraft: metadataManagement.projectNotesDraft,
    projectTagInputDraft: metadataManagement.projectTagInputDraft,
    projectTagsDraft: metadataManagement.projectTagsDraft,
    projectTitleDraft: metadataManagement.projectTitleDraft,
    selectedProject: metadataManagement.selectedProject
  };

  const diagnosticsModalProps: ComponentProps<typeof DiagnosticsModal> = {
    expandedIntegrityReferenceKeys: selectionState.expandedIntegrityReferenceKeys,
    formatCountLabel,
    formatDateTime,
    formatInteger,
    formatSuggestedActionLabel,
    formatTotalAndNewLabel,
    integrityReport: maintenanceState.integrityReport,
    isIntegrityChecking: maintenanceState.isIntegrityChecking,
    isOpen: selectionState.isDiagnosticsModalOpen,
    isSessionDiagnosisRunning: maintenanceState.isSessionDiagnosisRunning,
    onClose: selectionState.handleCloseDiagnosticsModal,
    onIntegrityReferenceToggle: selectionState.handleIntegrityReferenceToggle,
    onOpenIntegritySample: handleOpenIntegritySampleInTurns,
    onRunIntegrityCheck: maintenanceState.handleRunIntegrityCheck,
    onRunSessionDiagnosis: maintenanceState.handleRunSessionDiagnosis,
    sessionDiagnosisReport: maintenanceState.sessionDiagnosisReport
  };

  const turnDetailModalProps: ComponentProps<typeof TurnDetailModal> = {
    additionalTurnItems: browseViewState.additionalTurnItems,
    canAddTurnTag: metadataManagement.canAddTurnTag,
    canClearTurnMemo: metadataManagement.canClearTurnMemo,
    canResetTurnTitle: metadataManagement.canResetTurnTitle,
    canSaveTurnMemo: metadataManagement.canSaveTurnMemo,
    canSaveTurnTitle: metadataManagement.canSaveTurnTitle,
    detailTextPreviewLength,
    expandedDetailItemIds: selectionState.expandedDetailItemIds,
    formatDateTime,
    formatInteger,
    formatTokenLabel,
    getItemPresentation,
    getRoleClassName,
    getTurnHeading,
    isAdditionalItemsVisible: selectionState.isAdditionalItemsVisible,
    isMarkdownDetailItem,
    isOpen: selectionState.isTurnModalOpen,
    isSavingTurnOverride: metadataManagement.isSavingTurnOverride,
    isTurnMetadataCollapsed: metadataManagement.isTurnMetadataCollapsed,
    isTurnTitleEditing: metadataManagement.isTurnTitleEditing,
    onAddTurnTag: metadataManagement.handleAddTurnTag,
    onCancelTurnTitleEdit: metadataManagement.handleCancelTurnTitleEdit,
    onClearTurnMemo: metadataManagement.handleClearTurnMemo,
    onClose: selectionState.handleCloseTurnModal,
    onDetailItemToggle: selectionState.handleDetailItemToggle,
    onRemoveTurnTag: metadataManagement.handleRemoveTurnTag,
    onResetTurnMemoDraft: metadataManagement.handleResetTurnMemoDraft,
    onResetTurnTitle: metadataManagement.handleResetTurnTitle,
    onSaveTurnMemo: metadataManagement.handleSaveTurnMemo,
    onSaveTurnTitle: metadataManagement.handleSaveTurnTitle,
    onStartTurnTitleEdit: metadataManagement.handleStartTurnTitleEdit,
    onToggleAdditionalItemsVisible: selectionState.handleToggleAdditionalItemsVisible,
    onToggleTurnMetadataCollapsed: metadataManagement.handleToggleTurnMetadataCollapsed,
    onToggleTurnPin: metadataManagement.handleToggleTurnPin,
    onTurnNotesDraftChange: metadataManagement.setTurnNotesDraft,
    onTurnTagInputChange: metadataManagement.setTurnTagInputDraft,
    onTurnTagInputKeyDown: handleTurnTagInputKeyDown,
    onTurnTitleDraftChange: metadataManagement.setTurnTitleDraft,
    primaryTurnItems: browseViewState.primaryTurnItems,
    selectedThread: metadataManagement.selectedThread,
    selectedTurn: metadataManagement.selectedTurn,
    turnNotesDraft: metadataManagement.turnNotesDraft,
    turnTagInputDraft: metadataManagement.turnTagInputDraft,
    turnTagsDraft: metadataManagement.turnTagsDraft,
    turnTitleDraft: metadataManagement.turnTitleDraft
  };

  return {
    activeLoadError: metadataManagement.activeLoadError,
    diagnosticsModalProps,
    projectDetailModalProps,
    sidebarProps,
    turnDetailModalProps,
    workspacePanelProps
  };
}

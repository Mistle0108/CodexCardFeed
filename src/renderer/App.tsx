import { DiagnosticsModal } from "./components/DiagnosticsModal";
import { ProjectDetailModal } from "./components/ProjectDetailModal";
import { Sidebar } from "./components/Sidebar";
import { TurnDetailModal } from "./components/TurnDetailModal";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { useAppViewEffects } from "./hooks/useAppViewEffects";
import { useBrowseViewState } from "./hooks/useBrowseViewState";
import { useGlobalTurnSearch } from "./hooks/useGlobalTurnSearch";
import { useLibraryData } from "./hooks/useLibraryData";
import { useMaintenanceActions } from "./hooks/useMaintenanceActions";
import { useMetadataManagement } from "./hooks/useMetadataManagement";
import { useAppViewProps } from "./hooks/useAppViewProps";
import { useSelectionState } from "./hooks/useSelectionState";
import { useSidebarState } from "./hooks/useSidebarState";
import { createEnterKeyDownHandler } from "./lib/input-handlers";
const DETAIL_TEXT_PREVIEW_LENGTH = 2400;

export default function App() {
  const libraryState = useLibraryData();
  const sidebarState = useSidebarState();
  const selectionState = useSelectionState({
    loadTurnItemsState: libraryState.loadTurnItemsState,
    loadTurnsForThread: libraryState.loadTurnsForThread,
    onRevealProjectSelection: sidebarState.revealProjectSelection,
    projects: libraryState.projects,
    threads: libraryState.threads,
    withLibraryLoad: libraryState.withLibraryLoad
  });
  const metadataManagement = useMetadataManagement({
    loadError: libraryState.loadError,
    projectModalProjectId: selectionState.projectModalProjectId,
    projects: libraryState.projects,
    selectedThreadId: selectionState.selectedThreadId,
    selectedTurnId: selectionState.selectedTurnId,
    setLoadError: libraryState.setLoadError,
    setProjects: libraryState.setProjects,
    setThreads: libraryState.setThreads,
    setTurns: libraryState.setTurns,
    threads: libraryState.threads,
    turns: libraryState.turns
  });
  const maintenanceState = useMaintenanceActions({
    applyLibrarySelection: selectionState.applyLibrarySelection,
    onOpenDiagnosticsModal: selectionState.handleOpenDiagnosticsModal,
    refreshLibraryState: libraryState.refreshLibraryState,
    selectedThreadId: selectionState.selectedThreadId,
    selectedTurnId: selectionState.selectedTurnId,
    setLoadError: libraryState.setLoadError,
    setShellInfo: libraryState.setShellInfo,
    shellInfo: libraryState.shellInfo,
    withLibraryLoad: libraryState.withLibraryLoad
  });
  const browseViewState = useBrowseViewState({
    projects: libraryState.projects,
    selectedThreadId: selectionState.selectedThreadId,
    threads: libraryState.threads,
    turnItems: libraryState.turnItems,
    turns: libraryState.turns
  });
  const globalSearchState = useGlobalTurnSearch();

  useAppViewEffects({
    activeWorkspaceTabId: globalSearchState.activeWorkspaceTabId,
    integrityCheckedAt: maintenanceState.integrityReport?.checkedAt,
    isDiagnosticsModalOpen: selectionState.isDiagnosticsModalOpen,
    rightPanelMode: browseViewState.rightPanelMode,
    selectedTurnId: selectionState.selectedTurnId,
    setExpandedIntegrityReferenceKeys: selectionState.setExpandedIntegrityReferenceKeys,
    turnCount: libraryState.turns.length
  });

  async function handleImportSessions() {
    const nextSelection = await libraryState.importSessionsState(
      selectionState.selectedThreadId,
      selectionState.selectedTurnId
    );

    if (nextSelection) {
      selectionState.applyLibrarySelection(nextSelection);
      globalSearchState.refreshActiveSearch();
    }
  }

  function handleThreadSelectInWorkspace(threadId: string) {
    globalSearchState.handleSelectThreadTab();
    selectionState.handleThreadSelect(threadId);
  }

  function handleOpenGlobalSearchResult(result: TurnSearchResult) {
    selectionState.handleOpenSearchResult(result, () => {
      globalSearchState.handleSelectThreadTab();
      browseViewState.setRightPanelMode("turns");
    });
  }

  const handleProjectTagInputKeyDown = createEnterKeyDownHandler(
    metadataManagement.handleAddProjectTag
  );
  const handleThreadTagInputKeyDown = createEnterKeyDownHandler(
    metadataManagement.handleAddThreadTag
  );
  const handleTurnTagInputKeyDown = createEnterKeyDownHandler(
    metadataManagement.handleAddTurnTag
  );
  const handleOpenIntegritySampleInTurns = (sampleRef: IntegritySampleRef) =>
    selectionState.handleOpenIntegritySample(sampleRef, () => {
      browseViewState.setRightPanelMode("turns");
    });

  const {
    activeLoadError,
    diagnosticsModalProps,
    projectDetailModalProps,
    sidebarProps,
    turnDetailModalProps,
    workspacePanelProps
  } = useAppViewProps({
    browseViewState,
    detailTextPreviewLength: DETAIL_TEXT_PREVIEW_LENGTH,
    handleImportSessions,
    handleOpenGlobalSearchResult,
    handleThreadSelectInWorkspace,
    handleOpenIntegritySampleInTurns,
    handleProjectTagInputKeyDown,
    handleThreadTagInputKeyDown,
    handleTurnTagInputKeyDown,
    libraryState,
    globalSearchState,
    maintenanceState,
    metadataManagement,
    selectionState,
    sidebarState
  });

  return (
    <main className="app-shell">
      <Sidebar {...sidebarProps} />

      <section className="workspace-shell">
        {activeLoadError ? (
          <section className="card error-card compact-error">
            <h2>{activeLoadError.title}</h2>
            <p className="muted">{activeLoadError.message}</p>
            {activeLoadError.hint ? <p className="error-card-hint">{activeLoadError.hint}</p> : null}
          </section>
        ) : null}

        <WorkspacePanel {...workspacePanelProps} />
      </section>

      <ProjectDetailModal {...projectDetailModalProps} />

      <DiagnosticsModal {...diagnosticsModalProps} />

      <TurnDetailModal {...turnDetailModalProps} />
    </main>
  );
}

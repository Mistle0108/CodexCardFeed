import { useEffect, useState } from "react";
import type { LibrarySelectionState } from "./useLibraryData";

type UseSelectionStateArgs = {
  projects: ProjectListItem[];
  threads: ThreadListItem[];
  loadTurnItemsState: (turnId: string | null) => Promise<void>;
  loadTurnsForThread: (threadId: string | null, preferredTurnId: string | null) => Promise<string | null>;
  onRevealProjectSelection: (
    projectId: string | null,
    projectStatus: ProjectListItem["projectStatus"] | null
  ) => void;
  withLibraryLoad: (task: () => Promise<void>) => Promise<boolean>;
};

export function useSelectionState({
  projects,
  threads,
  loadTurnItemsState,
  loadTurnsForThread,
  onRevealProjectSelection,
  withLibraryLoad
}: UseSelectionStateArgs) {
  const [projectModalProjectId, setProjectModalProjectId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [isTurnModalOpen, setIsTurnModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isAdditionalItemsVisible, setIsAdditionalItemsVisible] = useState(false);
  const [expandedDetailItemIds, setExpandedDetailItemIds] = useState<Record<string, boolean>>({});
  const [expandedIntegrityReferenceKeys, setExpandedIntegrityReferenceKeys] = useState<
    Record<string, boolean>
  >({});

  function revealThreadSelection(threadId: string) {
    const nextThread = threads.find((thread) => thread.id === threadId) ?? null;
    const nextProject = projects.find((project) => project.id === nextThread?.projectId) ?? null;

    if (!nextThread || !nextProject) {
      return;
    }

    onRevealProjectSelection(nextThread.projectId, nextProject.projectStatus);
  }

  function applyLibrarySelection(selection: LibrarySelectionState) {
    setSelectedThreadId(selection.threadId);
    setSelectedTurnId(selection.turnId);
    onRevealProjectSelection(selection.projectId, selection.projectStatus);
  }

  function handleOpenProjectModal(projectId: string) {
    setProjectModalProjectId(projectId);
  }

  function handleCloseProjectModal() {
    setProjectModalProjectId(null);
  }

  function handleCloseTurnModal() {
    setIsTurnModalOpen(false);
  }

  function handleOpenDiagnosticsModal() {
    setIsDiagnosticsModalOpen(true);
  }

  function handleCloseDiagnosticsModal() {
    setIsDiagnosticsModalOpen(false);
  }

  function handleThreadSelect(threadId: string) {
    revealThreadSelection(threadId);
    setSelectedThreadId(threadId);
    setIsTurnModalOpen(false);

    void withLibraryLoad(async () => {
      const nextTurnId = await loadTurnsForThread(threadId, null);
      setSelectedTurnId(nextTurnId);
    });
  }

  function handleOpenTurnDetail(turnId: string) {
    setSelectedTurnId(turnId);

    void withLibraryLoad(async () => {
      await loadTurnItemsState(turnId);
      setIsTurnModalOpen(true);
    });
  }

  function handleOpenIntegritySample(
    sampleRef: IntegritySampleRef,
    onBeforeLoad?: () => void
  ) {
    if (!sampleRef.threadId) {
      return;
    }

    revealThreadSelection(sampleRef.threadId);
    setSelectedThreadId(sampleRef.threadId);
    onBeforeLoad?.();
    setIsDiagnosticsModalOpen(false);
    setIsTurnModalOpen(false);

    void withLibraryLoad(async () => {
      const nextTurnId = await loadTurnsForThread(sampleRef.threadId, sampleRef.turnId);
      setSelectedTurnId(nextTurnId);
    });
  }

  function handleOpenSearchResult(
    result: TurnSearchResult,
    onBeforeLoad?: () => void
  ) {
    revealThreadSelection(result.threadId);
    setSelectedThreadId(result.threadId);
    onBeforeLoad?.();
    setIsTurnModalOpen(false);

    void withLibraryLoad(async () => {
      const nextTurnId = await loadTurnsForThread(result.threadId, result.turnId);
      setSelectedTurnId(nextTurnId);
    });
  }

  function handleDetailItemToggle(itemId: string) {
    setExpandedDetailItemIds((current) => ({
      ...current,
      [itemId]: !current[itemId]
    }));
  }

  function handleToggleAdditionalItemsVisible() {
    setIsAdditionalItemsVisible((value) => !value);
  }

  function handleIntegrityReferenceToggle(checkKey: string) {
    setExpandedIntegrityReferenceKeys((current) => ({
      ...current,
      [checkKey]: !current[checkKey]
    }));
  }

  useEffect(() => {
    if (!projectModalProjectId && !isTurnModalOpen && !isDiagnosticsModalOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProjectModalProjectId(null);
        setIsTurnModalOpen(false);
        setIsDiagnosticsModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [projectModalProjectId, isTurnModalOpen, isDiagnosticsModalOpen]);

  useEffect(() => {
    const hasSelectedProject = projects.some((project) => project.id === projectModalProjectId);

    if (projectModalProjectId && !hasSelectedProject) {
      setProjectModalProjectId(null);
    }
  }, [projectModalProjectId, projects]);

  useEffect(() => {
    setIsAdditionalItemsVisible(false);
    setExpandedDetailItemIds({});
  }, [selectedTurnId, isTurnModalOpen]);

  return {
    applyLibrarySelection,
    expandedDetailItemIds,
    expandedIntegrityReferenceKeys,
    handleCloseDiagnosticsModal,
    handleCloseProjectModal,
    handleCloseTurnModal,
    handleDetailItemToggle,
    handleIntegrityReferenceToggle,
    handleOpenDiagnosticsModal,
    handleOpenIntegritySample,
    handleOpenProjectModal,
    handleOpenSearchResult,
    handleOpenTurnDetail,
    handleThreadSelect,
    handleToggleAdditionalItemsVisible,
    isAdditionalItemsVisible,
    isDiagnosticsModalOpen,
    isTurnModalOpen,
    projectModalProjectId,
    setExpandedIntegrityReferenceKeys,
    selectedThreadId,
    selectedTurnId,
    setSelectedThreadId,
    setSelectedTurnId,
    setIsTurnModalOpen
  };
}

import { useEffect, useState } from "react";
import { buildLoadErrorState, resolveSelectedId, sortProjectRows } from "../lib/app-utils";
import type { LoadErrorFallback, LoadErrorState } from "../lib/app-utils";

export type LibrarySelectionState = {
  threadId: string | null;
  turnId: string | null;
  projectId: string | null;
  projectStatus: ProjectListItem["projectStatus"] | null;
};

export function useLibraryData() {
  const [shellInfo, setShellInfo] = useState<ShellInfo | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [turns, setTurns] = useState<TurnListItem[]>([]);
  const [turnItems, setTurnItems] = useState<TurnItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | LoadErrorState | null>(null);

  async function withLibraryLoad(
    task: () => Promise<void>,
    fallback: LoadErrorFallback = {
      title: "Library load failed",
      hint: "Check the current paths and try the action again."
    }
  ) {
    setIsLibraryLoading(true);
    setLoadError(null);

    try {
      await task();
      return true;
    } catch (error) {
      setLoadError(buildLoadErrorState(error, fallback));
      return false;
    } finally {
      setIsLibraryLoading(false);
    }
  }

  async function loadShellInfoState() {
    const nextShellInfo = await window.codexCardFeed.getShellInfo();
    setShellInfo(nextShellInfo);
    return nextShellInfo;
  }

  async function loadTurnItemsState(turnId: string | null) {
    if (!turnId) {
      setTurnItems([]);
      return;
    }

    const nextItems = await window.codexCardFeed.listTurnItems(turnId);
    setTurnItems(nextItems);
  }

  async function loadTurnsForThread(threadId: string | null, preferredTurnId: string | null) {
    if (!threadId) {
      setTurns([]);
      setTurnItems([]);
      return null;
    }

    const nextTurns = await window.codexCardFeed.listTurns(threadId);
    setTurns(nextTurns);

    const nextTurnId =
      preferredTurnId && nextTurns.some((turn) => turn.id === preferredTurnId)
        ? preferredTurnId
        : null;
    setTurnItems([]);
    return nextTurnId;
  }

  async function refreshLibraryState(
    preferredThreadId: string | null,
    preferredTurnId: string | null
  ): Promise<LibrarySelectionState> {
    const [nextProjects, nextThreads] = await Promise.all([
      window.codexCardFeed.listProjects(),
      window.codexCardFeed.listThreads(null)
    ]);

    setProjects(sortProjectRows(nextProjects));
    setThreads(nextThreads);

    const nextThreadId = resolveSelectedId(nextThreads, preferredThreadId);
    const nextThread = nextThreads.find((thread) => thread.id === nextThreadId) ?? null;
    const nextProject = nextProjects.find((project) => project.id === nextThread?.projectId) ?? null;
    const nextTurnId = await loadTurnsForThread(nextThreadId, preferredTurnId);

    return {
      threadId: nextThreadId,
      turnId: nextTurnId,
      projectId: nextProject?.id ?? null,
      projectStatus: nextProject?.projectStatus ?? null
    };
  }

  async function importSessionsState(
    preferredThreadId: string | null,
    preferredTurnId: string | null
  ) {
    setIsImporting(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.importCodexSessions();

      let nextSelection: LibrarySelectionState | null = null;
      await withLibraryLoad(
        async () => {
          nextSelection = await refreshLibraryState(preferredThreadId, preferredTurnId);
          await loadShellInfoState();
        },
        {
          title: "Import refresh failed",
          hint: "Import may have completed, but the refreshed library could not be loaded. Check the current paths and run Import Sessions again."
        }
      );

      return nextSelection;
    } catch (error) {
      setLoadError(
        buildLoadErrorState(error, {
          title: "Import failed",
          hint: "Check the current Codex source path and run Import Sessions again."
        })
      );
      return null;
    } finally {
      setIsImporting(false);
    }
  }

  useEffect(() => {
    void withLibraryLoad(async () => {
      await Promise.all([refreshLibraryState(null, null), loadShellInfoState()]);
    });
  }, []);

  return {
    importSessionsState,
    isImporting,
    isLibraryLoading,
    loadError,
    loadTurnItemsState,
    loadTurnsForThread,
    projects,
    refreshLibraryState,
    setLoadError,
    setProjects,
    setShellInfo,
    setThreads,
    setTurns,
    shellInfo,
    threads,
    turnItems,
    turns,
    withLibraryLoad
  };
}

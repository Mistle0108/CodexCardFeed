import { useEffect, useState } from "react";
import { readStoredCollapsedState, readStoredExpandedProjectIds } from "../lib/ui-state-storage";

const PROJECTS_COLLAPSED_STORAGE_KEY = "codex-card-feed.sidebar.projects-collapsed";
const HISTORICAL_COLLAPSED_STORAGE_KEY = "codex-card-feed.sidebar.historical-collapsed";
const CHATS_COLLAPSED_STORAGE_KEY = "codex-card-feed.sidebar.chats-collapsed";
const EXPANDED_PROJECT_IDS_STORAGE_KEY =
  "codex-card-feed.sidebar.expanded-project-ids";

export function useSidebarState() {
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useState(() =>
    readStoredCollapsedState(PROJECTS_COLLAPSED_STORAGE_KEY)
  );
  const [isHistoricalCollapsed, setIsHistoricalCollapsed] = useState(() =>
    readStoredCollapsedState(HISTORICAL_COLLAPSED_STORAGE_KEY, true)
  );
  const [isChatsCollapsed, setIsChatsCollapsed] = useState(() =>
    readStoredCollapsedState(CHATS_COLLAPSED_STORAGE_KEY)
  );
  const [expandedProjectIds, setExpandedProjectIds] = useState(() =>
    readStoredExpandedProjectIds(EXPANDED_PROJECT_IDS_STORAGE_KEY)
  );

  function revealProjectSelection(
    projectId: string | null,
    projectStatus: ProjectListItem["projectStatus"] | null
  ) {
    if (!projectId) {
      return;
    }

    setExpandedProjectIds((current) => ({
      ...current,
      [projectId]: true
    }));

    if (projectStatus && projectStatus !== "active") {
      setIsHistoricalCollapsed(false);
    }
  }

  function handleProjectToggle(projectId: string) {
    setExpandedProjectIds((current) => ({
      ...current,
      [projectId]: !current[projectId]
    }));
  }

  function handleToggleProjectsCollapsed() {
    setIsProjectsCollapsed((value) => !value);
  }

  function handleToggleHistoricalCollapsed() {
    setIsHistoricalCollapsed((value) => !value);
  }

  function handleToggleChatsCollapsed() {
    setIsChatsCollapsed((value) => !value);
  }

  useEffect(() => {
    window.localStorage.setItem(
      PROJECTS_COLLAPSED_STORAGE_KEY,
      isProjectsCollapsed ? "1" : "0"
    );
  }, [isProjectsCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(
      HISTORICAL_COLLAPSED_STORAGE_KEY,
      isHistoricalCollapsed ? "1" : "0"
    );
  }, [isHistoricalCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(
      CHATS_COLLAPSED_STORAGE_KEY,
      isChatsCollapsed ? "1" : "0"
    );
  }, [isChatsCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(
      EXPANDED_PROJECT_IDS_STORAGE_KEY,
      JSON.stringify(expandedProjectIds)
    );
  }, [expandedProjectIds]);

  return {
    expandedProjectIds,
    handleProjectToggle,
    handleToggleChatsCollapsed,
    handleToggleHistoricalCollapsed,
    handleToggleProjectsCollapsed,
    isChatsCollapsed,
    isHistoricalCollapsed,
    isProjectsCollapsed,
    revealProjectSelection
  };
}

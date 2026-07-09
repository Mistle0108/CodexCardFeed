import { useEffect, useState } from "react";
import {
  groupThreadsByProjectId,
  hasActiveMetadataFilters,
  matchesMetadataFilters,
  matchesTurnThreadSearch,
  normalizeSearchTerms
} from "../lib/app-utils";
import { isPrimaryDetailItem } from "../lib/turn-item-presentation";
import type { MetadataFilterState } from "../lib/app-utils";

type UseBrowseViewStateArgs = {
  projects: ProjectListItem[];
  selectedThreadId: string | null;
  threads: ThreadListItem[];
  turnItems: TurnItem[];
  turns: TurnListItem[];
};

export function useBrowseViewState({
  projects,
  selectedThreadId,
  threads,
  turnItems,
  turns
}: UseBrowseViewStateArgs) {
  const [metadataTagFilter, setMetadataTagFilter] = useState("");
  const [isPinnedFilterActive, setIsPinnedFilterActive] = useState(false);
  const [isMemoFilterActive, setIsMemoFilterActive] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [rightPanelMode, setRightPanelMode] = useState<"turns" | "questions">("turns");

  const normalizedSidebarSearchTerms = normalizeSearchTerms(metadataTagFilter);
  const normalizedThreadSearchTerms = normalizeSearchTerms(threadSearchQuery);
  const metadataFilters: MetadataFilterState = {
    searchTerms: normalizedSidebarSearchTerms,
    pinnedOnly: isPinnedFilterActive,
    memoOnly: isMemoFilterActive
  };
  const isMetadataFilterActive = hasActiveMetadataFilters(metadataFilters);
  const isThreadSearchActive = normalizedThreadSearchTerms.length > 0;
  const visibleTurns = isThreadSearchActive
    ? turns.filter((turn) => matchesTurnThreadSearch(turn, normalizedThreadSearchTerms))
    : turns;
  const questionTurns = visibleTurns;
  const primaryTurnItems = turnItems.filter((item) => isPrimaryDetailItem(item));
  const additionalTurnItems = turnItems.filter((item) => !isPrimaryDetailItem(item));
  const activeProjects = projects.filter((project) => project.projectStatus === "active");
  const allProjectIds = new Set(projects.map((project) => project.id));
  const projectThreads = threads.filter((thread) => allProjectIds.has(thread.projectId));
  const chatThreads = threads.filter((thread) => !allProjectIds.has(thread.projectId));
  const matchingProjectThreads = isMetadataFilterActive
    ? projectThreads.filter((thread) =>
        matchesMetadataFilters(thread, metadataFilters, [thread.title, ...thread.tags])
      )
    : projectThreads;
  const matchingChatThreads = isMetadataFilterActive
    ? chatThreads.filter((thread) =>
        matchesMetadataFilters(thread, metadataFilters, [thread.title, ...thread.tags])
      )
    : chatThreads;
  const matchingProjectThreadsByProjectId = groupThreadsByProjectId(matchingProjectThreads);
  const threadsByProjectId = groupThreadsByProjectId(projectThreads);
  const sidebarProjects = activeProjects.filter((project) => {
    if (!isMetadataFilterActive) {
      return true;
    }

    return (
      matchesMetadataFilters(project, metadataFilters, [project.displayName, ...project.tags]) ||
      Boolean(matchingProjectThreadsByProjectId[project.id]?.length)
    );
  });
  const allHistoricalProjects = [...projects.filter((project) => project.projectStatus !== "active")]
    .sort((left, right) => {
      if (left.projectStatus === right.projectStatus) {
        return 0;
      }

      if (left.projectStatus === "historical") {
        return -1;
      }

      if (right.projectStatus === "historical") {
        return 1;
      }

      return 0;
    });
  const historicalProjects = allHistoricalProjects.filter((project) => {
    if (!isMetadataFilterActive) {
      return true;
    }

    return (
      matchesMetadataFilters(project, metadataFilters, [project.displayName, ...project.tags]) ||
      Boolean(matchingProjectThreadsByProjectId[project.id]?.length)
    );
  });

  function handleResetMetadataFilters() {
    setMetadataTagFilter("");
    setIsPinnedFilterActive(false);
    setIsMemoFilterActive(false);
  }

  function handleClearThreadSearch() {
    setThreadSearchQuery("");
  }

  function handleTogglePinnedFilter() {
    setIsPinnedFilterActive((value) => !value);
  }

  function handleToggleMemoFilter() {
    setIsMemoFilterActive((value) => !value);
  }

  useEffect(() => {
    setThreadSearchQuery("");
  }, [selectedThreadId]);

  return {
    activeProjects,
    additionalTurnItems,
    allHistoricalProjects,
    chatThreads,
    handleClearThreadSearch,
    handleResetMetadataFilters,
    handleToggleMemoFilter,
    handleTogglePinnedFilter,
    historicalProjects,
    isMemoFilterActive,
    isMetadataFilterActive,
    isPinnedFilterActive,
    isThreadSearchActive,
    matchingChatThreads,
    matchingProjectThreadsByProjectId,
    metadataTagFilter,
    normalizedSidebarSearchTerms,
    normalizedThreadSearchTerms,
    primaryTurnItems,
    questionTurns,
    rightPanelMode,
    setMetadataTagFilter,
    setRightPanelMode,
    setThreadSearchQuery,
    sidebarProjects,
    threadSearchQuery,
    threadsByProjectId,
    visibleTurns
  };
}

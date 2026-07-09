import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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

  const deferredMetadataTagFilter = useDeferredValue(metadataTagFilter);
  const deferredThreadSearchQuery = useDeferredValue(threadSearchQuery);
  const normalizedSidebarSearchTerms = useMemo(
    () => normalizeSearchTerms(deferredMetadataTagFilter),
    [deferredMetadataTagFilter]
  );
  const normalizedThreadSearchTerms = useMemo(
    () => normalizeSearchTerms(deferredThreadSearchQuery),
    [deferredThreadSearchQuery]
  );

  const {
    activeProjects,
    additionalTurnItems,
    allHistoricalProjects,
    chatThreads,
    historicalProjects,
    isMetadataFilterActive,
    isThreadSearchActive,
    matchingChatThreads,
    matchingProjectThreadsByProjectId,
    primaryTurnItems,
    questionTurns,
    sidebarProjects,
    threadsByProjectId,
    visibleTurns
  } = useMemo(() => {
    const metadataFilters: MetadataFilterState = {
      searchTerms: normalizedSidebarSearchTerms,
      pinnedOnly: isPinnedFilterActive,
      memoOnly: isMemoFilterActive
    };
    const nextIsMetadataFilterActive = hasActiveMetadataFilters(metadataFilters);
    const nextIsThreadSearchActive = normalizedThreadSearchTerms.length > 0;
    const nextVisibleTurns = nextIsThreadSearchActive
      ? turns.filter((turn) => matchesTurnThreadSearch(turn, normalizedThreadSearchTerms))
      : turns;

    const nextPrimaryTurnItems: TurnItem[] = [];
    const nextAdditionalTurnItems: TurnItem[] = [];

    for (const item of turnItems) {
      if (isPrimaryDetailItem(item)) {
        nextPrimaryTurnItems.push(item);
        continue;
      }

      nextAdditionalTurnItems.push(item);
    }

    const nextActiveProjects: ProjectListItem[] = [];
    const nextHistoricalProjectsBase: ProjectListItem[] = [];
    const allProjectIds = new Set<string>();

    for (const project of projects) {
      allProjectIds.add(project.id);

      if (project.projectStatus === "active") {
        nextActiveProjects.push(project);
        continue;
      }

      nextHistoricalProjectsBase.push(project);
    }

    const projectThreads: ThreadListItem[] = [];
    const nextChatThreads: ThreadListItem[] = [];

    for (const thread of threads) {
      if (allProjectIds.has(thread.projectId)) {
        projectThreads.push(thread);
        continue;
      }

      nextChatThreads.push(thread);
    }

    const matchingProjectThreads = nextIsMetadataFilterActive
      ? projectThreads.filter((thread) =>
          matchesMetadataFilters(thread, metadataFilters, [thread.title, ...thread.tags])
        )
      : projectThreads;
    const nextMatchingChatThreads = nextIsMetadataFilterActive
      ? nextChatThreads.filter((thread) =>
          matchesMetadataFilters(thread, metadataFilters, [thread.title, ...thread.tags])
        )
      : nextChatThreads;
    const nextMatchingProjectThreadsByProjectId = groupThreadsByProjectId(matchingProjectThreads);
    const nextThreadsByProjectId = groupThreadsByProjectId(projectThreads);
    const nextSidebarProjects = nextActiveProjects.filter((project) => {
      if (!nextIsMetadataFilterActive) {
        return true;
      }

      return (
        matchesMetadataFilters(project, metadataFilters, [project.displayName, ...project.tags]) ||
        Boolean(nextMatchingProjectThreadsByProjectId[project.id]?.length)
      );
    });
    const nextAllHistoricalProjects = [...nextHistoricalProjectsBase].sort((left, right) => {
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
    const nextHistoricalProjects = nextAllHistoricalProjects.filter((project) => {
      if (!nextIsMetadataFilterActive) {
        return true;
      }

      return (
        matchesMetadataFilters(project, metadataFilters, [project.displayName, ...project.tags]) ||
        Boolean(nextMatchingProjectThreadsByProjectId[project.id]?.length)
      );
    });

    return {
      activeProjects: nextActiveProjects,
      additionalTurnItems: nextAdditionalTurnItems,
      allHistoricalProjects: nextAllHistoricalProjects,
      chatThreads: nextChatThreads,
      historicalProjects: nextHistoricalProjects,
      isMetadataFilterActive: nextIsMetadataFilterActive,
      isThreadSearchActive: nextIsThreadSearchActive,
      matchingChatThreads: nextMatchingChatThreads,
      matchingProjectThreadsByProjectId: nextMatchingProjectThreadsByProjectId,
      primaryTurnItems: nextPrimaryTurnItems,
      questionTurns: nextVisibleTurns,
      sidebarProjects: nextSidebarProjects,
      threadsByProjectId: nextThreadsByProjectId,
      visibleTurns: nextVisibleTurns
    };
  }, [
    isMemoFilterActive,
    isPinnedFilterActive,
    normalizedSidebarSearchTerms,
    normalizedThreadSearchTerms,
    projects,
    threads,
    turnItems,
    turns
  ]);

  const handleResetMetadataFilters = useCallback(() => {
    setMetadataTagFilter("");
    setIsPinnedFilterActive(false);
    setIsMemoFilterActive(false);
  }, []);

  const handleClearThreadSearch = useCallback(() => {
    setThreadSearchQuery("");
  }, []);

  const handleTogglePinnedFilter = useCallback(() => {
    setIsPinnedFilterActive((value) => !value);
  }, []);

  const handleToggleMemoFilter = useCallback(() => {
    setIsMemoFilterActive((value) => !value);
  }, []);

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

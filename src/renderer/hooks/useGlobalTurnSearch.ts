import { useRef, useState } from "react";
import { getErrorMessage } from "../lib/app-utils";

const MAX_SEARCH_TABS = 5;

function normalizeQuery(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function createSearchTab(id: string, query: string): GlobalSearchTab {
  return {
    id,
    query,
    results: [],
    total: 0,
    hasMore: false,
    isLoading: true,
    error: null,
    scrollTop: 0
  };
}

export function useGlobalTurnSearch() {
  const nextTabId = useRef(1);
  const requestVersions = useRef(new Map<string, number>());
  const [searchInput, setSearchInput] = useState("");
  const [searchTabs, setSearchTabs] = useState<GlobalSearchTab[]>([]);
  const [activeWorkspaceTabId, setActiveWorkspaceTabId] = useState("thread");

  async function loadSearchTab(
    tabId: string,
    query: string,
    offset = 0,
    append = false
  ) {
    const requestVersion = (requestVersions.current.get(tabId) ?? 0) + 1;
    requestVersions.current.set(tabId, requestVersion);
    setSearchTabs((current) =>
      current.map((tab) =>
        tab.id === tabId ? { ...tab, isLoading: true, error: null } : tab
      )
    );

    try {
      const response = await window.codexCardFeed.searchTurns(query, {
        limit: 100,
        offset
      });

      if (requestVersions.current.get(tabId) !== requestVersion) {
        return;
      }

      setSearchTabs((current) =>
        current.map((tab) => {
          if (tab.id !== tabId) {
            return tab;
          }

          return {
            ...tab,
            query: response.query,
            results: append ? [...tab.results, ...response.results] : response.results,
            total: response.total,
            hasMore: response.hasMore,
            isLoading: false,
            error: null,
            scrollTop: append ? tab.scrollTop : 0
          };
        })
      );
    } catch (error) {
      if (requestVersions.current.get(tabId) !== requestVersion) {
        return;
      }

      setSearchTabs((current) =>
        current.map((tab) =>
          tab.id === tabId
            ? { ...tab, isLoading: false, error: getErrorMessage(error) }
            : tab
        )
      );
    }
  }

  function handleSubmitSearch() {
    const query = normalizeQuery(searchInput);

    if (!query) {
      return;
    }

    const existingTab = searchTabs.find(
      (tab) => tab.query.toLocaleLowerCase() === query.toLocaleLowerCase()
    );

    if (existingTab) {
      setActiveWorkspaceTabId(existingTab.id);
      void loadSearchTab(existingTab.id, existingTab.query);
      return;
    }

    const tabId = `search-${nextTabId.current}`;
    nextTabId.current += 1;
    setSearchTabs((current) => [...current.slice(-(MAX_SEARCH_TABS - 1)), createSearchTab(tabId, query)]);
    setActiveWorkspaceTabId(tabId);
    void loadSearchTab(tabId, query);
  }

  function handleSelectThreadTab() {
    setActiveWorkspaceTabId("thread");
  }

  function handleSelectSearchTab(tabId: string) {
    const tab = searchTabs.find((item) => item.id === tabId);

    if (!tab) {
      return;
    }

    setSearchInput(tab.query);
    setActiveWorkspaceTabId(tabId);
    void loadSearchTab(tab.id, tab.query);
  }

  function handleCloseSearchTab(tabId: string) {
    requestVersions.current.delete(tabId);
    setSearchTabs((current) => current.filter((tab) => tab.id !== tabId));
    setActiveWorkspaceTabId((current) => (current === tabId ? "thread" : current));
  }

  function handleLoadMoreSearchResults(tabId: string) {
    const tab = searchTabs.find((item) => item.id === tabId);

    if (!tab || tab.isLoading || !tab.hasMore) {
      return;
    }

    void loadSearchTab(tab.id, tab.query, tab.results.length, true);
  }

  function handleSearchScroll(tabId: string, scrollTop: number) {
    setSearchTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, scrollTop } : tab))
    );
  }

  function refreshActiveSearch() {
    const activeTab = searchTabs.find((tab) => tab.id === activeWorkspaceTabId);

    if (activeTab) {
      void loadSearchTab(activeTab.id, activeTab.query);
    }
  }

  const activeSearchTab =
    searchTabs.find((tab) => tab.id === activeWorkspaceTabId) ?? null;

  return {
    activeSearchTab,
    activeWorkspaceTabId,
    handleCloseSearchTab,
    handleLoadMoreSearchResults,
    handleSearchScroll,
    handleSelectSearchTab,
    handleSelectThreadTab,
    handleSubmitSearch,
    refreshActiveSearch,
    searchInput,
    searchTabs,
    setSearchInput
  };
}

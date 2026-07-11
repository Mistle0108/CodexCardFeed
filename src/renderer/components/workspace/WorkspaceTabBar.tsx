import type { FormEvent } from "react";

type WorkspaceTabBarProps = {
  activeWorkspaceTabId: string;
  searchInput: string;
  searchTabs: GlobalSearchTab[];
  selectedThreadTitle: string | null;
  onCloseSearchTab: (tabId: string) => void;
  onSearchInputChange: (value: string) => void;
  onSelectSearchTab: (tabId: string) => void;
  onSelectThreadTab: () => void;
  onSubmitSearch: () => void;
};

export function WorkspaceTabBar({
  activeWorkspaceTabId,
  searchInput,
  searchTabs,
  selectedThreadTitle,
  onCloseSearchTab,
  onSearchInputChange,
  onSelectSearchTab,
  onSelectThreadTab,
  onSubmitSearch
}: WorkspaceTabBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmitSearch();
  }

  return (
    <div className="workspace-tab-bar">
      <div className="workspace-tabs" role="tablist" aria-label="Workspace tabs">
        <button
          aria-selected={activeWorkspaceTabId === "thread"}
          className={`workspace-tab ${activeWorkspaceTabId === "thread" ? "is-active" : ""}`}
          onClick={onSelectThreadTab}
          role="tab"
          title={selectedThreadTitle ?? "Thread"}
          type="button"
        >
          Thread
        </button>
        {searchTabs.map((tab) => (
          <div
            className={`workspace-search-tab ${
              activeWorkspaceTabId === tab.id ? "is-active" : ""
            }`}
            key={tab.id}
          >
            <button
              aria-selected={activeWorkspaceTabId === tab.id}
              className="workspace-search-tab-select"
              onClick={() => onSelectSearchTab(tab.id)}
              role="tab"
              title={tab.query}
              type="button"
            >
              {tab.query}
            </button>
            <button
              aria-label={`Close search ${tab.query}`}
              className="workspace-search-tab-close"
              onClick={() => onCloseSearchTab(tab.id)}
              title="Close search"
              type="button"
            >
              x
            </button>
          </div>
        ))}
      </div>
      <form className="global-search-form" onSubmit={handleSubmit}>
        <input
          aria-label="Search all turns"
          className="path-panel-input global-search-input"
          maxLength={500}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="Search all turns"
          type="search"
          value={searchInput}
        />
        <button
          className="secondary-button global-search-submit"
          disabled={!searchInput.trim()}
          type="submit"
        >
          Search
        </button>
      </form>
    </div>
  );
}

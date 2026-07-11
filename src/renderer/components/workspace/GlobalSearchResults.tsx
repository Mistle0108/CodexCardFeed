import { useEffect, useRef, type ReactNode, type UIEvent } from "react";

type GlobalSearchResultsProps = {
  searchTab: GlobalSearchTab;
  formatDateTime: (value: string | null) => string;
  renderHighlightedText: (text: string, searchTerms: string[]) => ReactNode;
  onLoadMore: (tabId: string) => void;
  onOpenResult: (result: TurnSearchResult) => void;
  onScroll: (tabId: string, scrollTop: number) => void;
};

export function GlobalSearchResults({
  searchTab,
  formatDateTime,
  renderHighlightedText,
  onLoadMore,
  onOpenResult,
  onScroll
}: GlobalSearchResultsProps) {
  const panelRef = useRef<HTMLElement>(null);
  const searchTerms = [searchTab.query];

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = searchTab.scrollTop;
    }
  }, [searchTab.id, searchTab.isLoading]);

  function handleScroll(event: UIEvent<HTMLElement>) {
    onScroll(searchTab.id, event.currentTarget.scrollTop);
  }

  return (
    <section
      className="turn-list-panel global-search-results-panel"
      onScroll={handleScroll}
      ref={panelRef}
    >
      {searchTab.error ? (
        <section className="card error-card compact-error">
          <h2>Search failed</h2>
          <p className="muted">{searchTab.error}</p>
        </section>
      ) : null}

      {searchTab.results.length ? (
        <div className="selection-list global-search-result-list">
          {searchTab.results.map((result) => (
            <button
              className="selection-button global-search-result-card"
              key={result.turnId}
              onClick={() => onOpenResult(result)}
              type="button"
            >
              <div className="selection-copy">
                <div className="selection-topline">
                  <strong>
                    {renderHighlightedText(
                      result.turnTitle ?? `Turn ${result.turnOrdinal}`,
                      searchTerms
                    )}
                  </strong>
                  <span className="muted">
                    {formatDateTime(result.completedAt ?? result.startedAt)}
                  </span>
                </div>
                <p className="global-search-context">
                  <span>{result.projectName ?? "Chat"}</span>
                  <span>/</span>
                  <span>{result.threadTitle}</span>
                </p>
                <div className="global-search-matches">
                  {result.matches.map((match) => (
                    <p className="turn-preview turn-search-row" key={match.field}>
                      <span className="preview-label">{match.label}</span>
                      <span>{renderHighlightedText(match.snippet, searchTerms)}</span>
                    </p>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {searchTab.isLoading ? <p className="empty-state">Searching...</p> : null}

      {!searchTab.isLoading && !searchTab.error && !searchTab.results.length ? (
        <p className="empty-state">No turns match this search.</p>
      ) : null}

      {searchTab.hasMore ? (
        <div className="global-search-load-more">
          <button
            className="secondary-button"
            disabled={searchTab.isLoading}
            onClick={() => onLoadMore(searchTab.id)}
            type="button"
          >
            {searchTab.isLoading ? "Loading..." : "Show more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

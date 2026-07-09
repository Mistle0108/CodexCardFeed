import type { ReactNode } from "react";

type WorkspaceTurnListProps = {
  selectedThread: ThreadListItem | null;
  visibleTurns: TurnListItem[];
  questionTurns: TurnListItem[];
  selectedTurnId: string | null;
  rightPanelMode: "turns" | "questions";
  isThreadSearchActive: boolean;
  normalizedThreadSearchTerms: string[];
  formatDateTime: (value: string | null) => string;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  formatTokenLabel: (value: number) => string;
  renderHighlightedText: (text: string, searchTerms: string[]) => ReactNode;
  getMatchingTagValues: (tags: string[], searchTerms: string[]) => string[];
  getMatchingMemoExcerpt: (
    notes: string,
    searchTerms: string[],
    maxLength?: number
  ) => string | null;
  getAdditionalSearchExcerpt: (
    fullText: string,
    visibleText: string,
    searchTerms: string[],
    maxLength?: number
  ) => string | null;
  getTurnHeading: (turn: TurnListItem) => string;
  getQuestionPreview: (turn: TurnListItem) => string;
  getAnswerPreview: (turn: TurnListItem) => string;
  onOpenTurnDetail: (turnId: string) => void;
};

export function WorkspaceTurnList({
  selectedThread,
  visibleTurns,
  questionTurns,
  selectedTurnId,
  rightPanelMode,
  isThreadSearchActive,
  normalizedThreadSearchTerms,
  formatDateTime,
  formatCountLabel,
  formatTokenLabel,
  renderHighlightedText,
  getMatchingTagValues,
  getMatchingMemoExcerpt,
  getAdditionalSearchExcerpt,
  getTurnHeading,
  getQuestionPreview,
  getAnswerPreview,
  onOpenTurnDetail
}: WorkspaceTurnListProps) {
  return (
    <section className="turn-list-panel">
      {visibleTurns.length ? (
        rightPanelMode === "turns" ? (
          <div className="selection-list">
            {visibleTurns.map((turn) => {
              const turnHeading = getTurnHeading(turn);
              const questionPreview = getQuestionPreview(turn);
              const answerPreview = getAnswerPreview(turn);
              const matchingTurnTags = getMatchingTagValues(turn.tags, normalizedThreadSearchTerms);
              const matchingMemoExcerpt = getMatchingMemoExcerpt(
                turn.notes,
                normalizedThreadSearchTerms
              );
              const questionMatchExcerpt = getAdditionalSearchExcerpt(
                turn.searchUserText,
                questionPreview,
                normalizedThreadSearchTerms
              );
              const answerMatchExcerpt = getAdditionalSearchExcerpt(
                turn.searchFinalAnswerText,
                answerPreview,
                normalizedThreadSearchTerms
              );

              return (
                <button
                  data-turn-card-id={turn.id}
                  key={turn.id}
                  className={`selection-button ${selectedTurnId === turn.id ? "is-active" : ""}`}
                  onClick={() => onOpenTurnDetail(turn.id)}
                  type="button"
                >
                  <div className="selection-copy">
                    <div className="selection-topline">
                      <strong>{renderHighlightedText(turnHeading, normalizedThreadSearchTerms)}</strong>
                      <div className="selection-pills">
                        {turn.isPinned ? <span className="pin-pill">Pinned</span> : null}
                        <span
                          className={`status-pill ${
                            turn.status === "completed" ? "is-complete" : "is-open"
                          }`}
                        >
                          {turn.status}
                        </span>
                      </div>
                    </div>
                    <p className="turn-preview">
                      <span className="preview-label">Q</span>
                      <span>{renderHighlightedText(questionPreview, normalizedThreadSearchTerms)}</span>
                    </p>
                    {questionMatchExcerpt ? (
                      <p className="turn-preview turn-search-row">
                        <span className="preview-label">Q+</span>
                        <span>
                          {renderHighlightedText(questionMatchExcerpt, normalizedThreadSearchTerms)}
                        </span>
                      </p>
                    ) : null}
                    <p className="turn-preview">
                      <span className="preview-label">A</span>
                      <span>{renderHighlightedText(answerPreview, normalizedThreadSearchTerms)}</span>
                    </p>
                    {answerMatchExcerpt ? (
                      <p className="turn-preview turn-search-row">
                        <span className="preview-label">A+</span>
                        <span>
                          {renderHighlightedText(answerMatchExcerpt, normalizedThreadSearchTerms)}
                        </span>
                      </p>
                    ) : null}
                    {matchingTurnTags.length ? (
                      <p className="turn-preview turn-search-row">
                        <span className="preview-label">Tag</span>
                        <span className="turn-search-tag-list">
                          {matchingTurnTags.map((tag) => (
                            <span className="turn-search-tag" key={tag}>
                              {renderHighlightedText(tag, normalizedThreadSearchTerms)}
                            </span>
                          ))}
                        </span>
                      </p>
                    ) : null}
                    {matchingMemoExcerpt ? (
                      <p className="turn-preview turn-search-row">
                        <span className="preview-label">Memo</span>
                        <span>
                          {renderHighlightedText(matchingMemoExcerpt, normalizedThreadSearchTerms)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="turn-card-actions">
                    <div className="selection-trailing">
                      <span className="mini-meta">{formatCountLabel(turn.itemCount, "item")}</span>
                      <span className="mini-meta token-meta">{formatTokenLabel(turn.totalTokens)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="question-list">
            {questionTurns.map((turn) => {
              const turnHeading = getTurnHeading(turn);
              const questionPreview = getQuestionPreview(turn);
              const matchingTurnTags = getMatchingTagValues(turn.tags, normalizedThreadSearchTerms);
              const matchingMemoExcerpt = getMatchingMemoExcerpt(
                turn.notes,
                normalizedThreadSearchTerms
              );
              const questionMatchExcerpt = getAdditionalSearchExcerpt(
                turn.searchUserText,
                questionPreview,
                normalizedThreadSearchTerms
              );
              const answerMatchExcerpt = getAdditionalSearchExcerpt(
                turn.searchFinalAnswerText,
                "",
                normalizedThreadSearchTerms
              );

              return (
                <button
                  key={turn.id}
                  className={`selection-button question-card ${
                    selectedTurnId === turn.id ? "is-active" : ""
                  }`}
                  onClick={() => onOpenTurnDetail(turn.id)}
                  type="button"
                >
                  <div className="question-card-header">
                    <div className="question-card-heading">
                      <strong>{renderHighlightedText(turnHeading, normalizedThreadSearchTerms)}</strong>
                      {turn.isPinned ? <span className="pin-pill">Pinned</span> : null}
                    </div>
                    <span className="mini-meta">
                      {formatDateTime(turn.completedAt ?? turn.startedAt ?? turn.lastSeenAt)}
                    </span>
                  </div>
                  <p className="question-card-question">
                    {renderHighlightedText(questionPreview, normalizedThreadSearchTerms)}
                  </p>
                  {questionMatchExcerpt ? (
                    <p className="question-card-match">
                      <span className="preview-label">Q+</span>
                      <span>
                        {renderHighlightedText(questionMatchExcerpt, normalizedThreadSearchTerms)}
                      </span>
                    </p>
                  ) : null}
                  {answerMatchExcerpt ? (
                    <p className="question-card-match">
                      <span className="preview-label">A</span>
                      <span>{renderHighlightedText(answerMatchExcerpt, normalizedThreadSearchTerms)}</span>
                    </p>
                  ) : null}
                  {matchingTurnTags.length ? (
                    <p className="question-card-match">
                      <span className="preview-label">Tag</span>
                      <span className="turn-search-tag-list">
                        {matchingTurnTags.map((tag) => (
                          <span className="turn-search-tag" key={tag}>
                            {renderHighlightedText(tag, normalizedThreadSearchTerms)}
                          </span>
                        ))}
                      </span>
                    </p>
                  ) : null}
                  {matchingMemoExcerpt ? (
                    <p className="question-card-match">
                      <span className="preview-label">Memo</span>
                      <span>{renderHighlightedText(matchingMemoExcerpt, normalizedThreadSearchTerms)}</span>
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        )
      ) : (
        <p className="empty-state">
          {selectedThread
            ? rightPanelMode === "turns"
              ? isThreadSearchActive
                ? "No turns match the current search."
                : "No turns were found for this thread."
              : isThreadSearchActive
                ? "No questions match the current search."
                : "No questions were found for this thread."
            : "Choose a thread from the sidebar to load turn cards."}
        </p>
      )}
    </section>
  );
}

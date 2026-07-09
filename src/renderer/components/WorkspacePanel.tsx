import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

type WorkspacePanelProps = {
  selectedThread: ThreadListItem | null;
  turns: TurnListItem[];
  visibleTurns: TurnListItem[];
  questionTurns: TurnListItem[];
  selectedTurnId: string | null;
  rightPanelMode: "turns" | "questions";
  threadTitleDraft: string;
  isThreadTitleEditing: boolean;
  isSavingThreadOverride: boolean;
  canSaveThreadTitle: boolean;
  canResetThreadTitle: boolean;
  isThreadMetadataCollapsed: boolean;
  threadTagInputDraft: string;
  threadTagsDraft: string[];
  threadNotesDraft: string;
  canAddThreadTag: boolean;
  canSaveThreadMemo: boolean;
  canClearThreadMemo: boolean;
  threadSearchQuery: string;
  isThreadSearchActive: boolean;
  normalizedThreadSearchTerms: string[];
  formatDateTime: (value: string | null) => string;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  formatFilteredCountLabel: (
    visibleCount: number,
    totalCount: number,
    singular: string,
    plural?: string
  ) => string;
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
  onThreadTitleDraftChange: (value: string) => void;
  onToggleThreadPin: () => void | Promise<void>;
  onSaveThreadTitle: () => void | Promise<void>;
  onCancelThreadTitleEdit: () => void;
  onStartThreadTitleEdit: () => void;
  onResetThreadTitle: () => void | Promise<void>;
  onOpenCodexThread: (threadId: string) => void | Promise<void>;
  onToggleThreadMetadataCollapsed: () => void;
  onThreadTagInputChange: (value: string) => void;
  onThreadTagInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onAddThreadTag: () => void | Promise<void>;
  onRemoveThreadTag: (tag: string) => void | Promise<void>;
  onThreadNotesDraftChange: (value: string) => void;
  onSaveThreadMemo: () => void | Promise<void>;
  onResetThreadMemoDraft: () => void;
  onClearThreadMemo: () => void | Promise<void>;
  onRightPanelModeChange: (mode: "turns" | "questions") => void;
  onThreadSearchQueryChange: (value: string) => void;
  onClearThreadSearch: () => void;
  onOpenTurnDetail: (turnId: string) => void;
};

export function WorkspacePanel({
  selectedThread,
  turns,
  visibleTurns,
  questionTurns,
  selectedTurnId,
  rightPanelMode,
  threadTitleDraft,
  isThreadTitleEditing,
  isSavingThreadOverride,
  canSaveThreadTitle,
  canResetThreadTitle,
  isThreadMetadataCollapsed,
  threadTagInputDraft,
  threadTagsDraft,
  threadNotesDraft,
  canAddThreadTag,
  canSaveThreadMemo,
  canClearThreadMemo,
  threadSearchQuery,
  isThreadSearchActive,
  normalizedThreadSearchTerms,
  formatDateTime,
  formatCountLabel,
  formatFilteredCountLabel,
  formatTokenLabel,
  renderHighlightedText,
  getMatchingTagValues,
  getMatchingMemoExcerpt,
  getAdditionalSearchExcerpt,
  getTurnHeading,
  getQuestionPreview,
  getAnswerPreview,
  onThreadTitleDraftChange,
  onToggleThreadPin,
  onSaveThreadTitle,
  onCancelThreadTitleEdit,
  onStartThreadTitleEdit,
  onResetThreadTitle,
  onOpenCodexThread,
  onToggleThreadMetadataCollapsed,
  onThreadTagInputChange,
  onThreadTagInputKeyDown,
  onAddThreadTag,
  onRemoveThreadTag,
  onThreadNotesDraftChange,
  onSaveThreadMemo,
  onResetThreadMemoDraft,
  onClearThreadMemo,
  onRightPanelModeChange,
  onThreadSearchQueryChange,
  onClearThreadSearch,
  onOpenTurnDetail
}: WorkspacePanelProps) {
  return (
    <>
      <div className="workspace-header">
        <div className="thread-header">
          <div className="thread-header-copy">
            <p className="workspace-kicker">Thread</p>
            <div className="management-heading-row">
              {selectedThread && isThreadTitleEditing ? (
                <input
                  className="management-title-input"
                  onChange={(event) => onThreadTitleDraftChange(event.target.value)}
                  placeholder={selectedThread.sourceTitle}
                  type="text"
                  value={threadTitleDraft}
                />
              ) : (
                <h2>{selectedThread?.title ?? "Selected thread"}</h2>
              )}
              {selectedThread?.isPinned ? <span className="pin-pill">Pinned</span> : null}
            </div>
            {selectedThread && selectedThread.title !== selectedThread.sourceTitle ? (
              <p className="management-subcopy muted">{`Original: ${selectedThread.sourceTitle}`}</p>
            ) : null}
          </div>
          {selectedThread ? (
            <div className="thread-header-actions">
              <button
                className={`secondary-button ${selectedThread.isPinned ? "is-active" : ""}`}
                disabled={isSavingThreadOverride}
                onClick={() => void onToggleThreadPin()}
                type="button"
              >
                {selectedThread.isPinned ? "Unpin" : "Pin"}
              </button>
              {isThreadTitleEditing ? (
                <>
                  <button
                    className="secondary-button"
                    disabled={isSavingThreadOverride || !canSaveThreadTitle}
                    onClick={() => void onSaveThreadTitle()}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isSavingThreadOverride}
                    onClick={onCancelThreadTitleEdit}
                    type="button"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="secondary-button"
                  disabled={isSavingThreadOverride}
                  onClick={onStartThreadTitleEdit}
                  type="button"
                >
                  Edit title
                </button>
              )}
              {canResetThreadTitle ? (
                <button
                  className="secondary-button"
                  disabled={isSavingThreadOverride}
                  onClick={() => void onResetThreadTitle()}
                  type="button"
                >
                  Use original
                </button>
              ) : null}
              <button
                className="secondary-button"
                onClick={() => void onOpenCodexThread(selectedThread.id)}
                type="button"
              >
                Open in Codex
              </button>
            </div>
          ) : null}
        </div>

        {selectedThread ? (
          <section className="local-metadata-panel">
            <div className="local-metadata-shell-header">
              <div>
                <p className="management-kicker">Local metadata</p>
                <p className="muted">Tags and memo are stored only in CodexCardFeed.</p>
              </div>
              <button
                aria-expanded={!isThreadMetadataCollapsed}
                className="secondary-button"
                onClick={onToggleThreadMetadataCollapsed}
                type="button"
              >
                {isThreadMetadataCollapsed ? "Show" : "Hide"}
              </button>
            </div>

            {!isThreadMetadataCollapsed ? (
              <>
                <div className="metadata-field">
                  <div className="metadata-section-header">
                    <label className="metadata-label" htmlFor="thread-tags-input">
                      Tags
                    </label>
                    <div className="metadata-section-actions">
                      <button
                        className="secondary-button"
                        disabled={isSavingThreadOverride || !canAddThreadTag}
                        onClick={() => void onAddThreadTag()}
                        type="button"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div className="metadata-input-row">
                    <input
                      id="thread-tags-input"
                      className="metadata-input"
                      onChange={(event) => onThreadTagInputChange(event.target.value)}
                      onKeyDown={onThreadTagInputKeyDown}
                      placeholder="Add one tag and press Enter"
                      type="text"
                      value={threadTagInputDraft}
                    />
                  </div>
                  {threadTagsDraft.length ? (
                    <div className="tag-chip-list">
                      {threadTagsDraft.map((tag) => (
                        <span className="tag-chip" key={tag}>
                          <span>{tag}</span>
                          <button
                            aria-label={`Remove ${tag} tag`}
                            className="tag-chip-remove"
                            onClick={() => void onRemoveThreadTag(tag)}
                            type="button"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No local tags.</p>
                  )}
                </div>

                <div className="metadata-field">
                  <div className="metadata-section-header">
                    <label className="metadata-label" htmlFor="thread-notes-input">
                      Memo
                    </label>
                    <div className="metadata-section-actions">
                      <button
                        className="secondary-button"
                        disabled={isSavingThreadOverride || !canSaveThreadMemo}
                        onClick={() => void onSaveThreadMemo()}
                        type="button"
                      >
                        Save memo
                      </button>
                      <button
                        className="secondary-button"
                        disabled={isSavingThreadOverride || !canSaveThreadMemo}
                        onClick={onResetThreadMemoDraft}
                        type="button"
                      >
                        Revert memo
                      </button>
                      {canClearThreadMemo ? (
                        <button
                          className="secondary-button"
                          disabled={isSavingThreadOverride}
                          onClick={() => void onClearThreadMemo()}
                          type="button"
                        >
                          Clear memo
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <textarea
                    id="thread-notes-input"
                    className="metadata-textarea"
                    onChange={(event) => onThreadNotesDraftChange(event.target.value)}
                    placeholder="Write a local memo for this thread."
                    rows={4}
                    value={threadNotesDraft}
                  />
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        <div className="panel-toolbar">
          <div className="panel-view-toggle" role="tablist" aria-label="Right panel view">
            <button
              aria-selected={rightPanelMode === "turns"}
              className={`panel-view-button ${rightPanelMode === "turns" ? "is-active" : ""}`}
              onClick={() => onRightPanelModeChange("turns")}
              role="tab"
              type="button"
            >
              Turns
            </button>
            <button
              aria-selected={rightPanelMode === "questions"}
              className={`panel-view-button ${rightPanelMode === "questions" ? "is-active" : ""}`}
              onClick={() => onRightPanelModeChange("questions")}
              role="tab"
              type="button"
            >
              Questions
            </button>
          </div>
          <p className="panel-toolbar-meta muted">
            {selectedThread
              ? rightPanelMode === "turns"
                ? formatFilteredCountLabel(visibleTurns.length, turns.length, "turn")
                : formatFilteredCountLabel(questionTurns.length, turns.length, "question")
              : "No thread selected"}
          </p>
        </div>
        <div className="panel-search-row">
          <input
            className="path-panel-input panel-search-input"
            disabled={!selectedThread}
            onChange={(event) => onThreadSearchQueryChange(event.target.value)}
            placeholder="Search this thread content, tags, memo"
            type="text"
            value={threadSearchQuery}
          />
          {isThreadSearchActive ? (
            <button className="sidebar-collapse-toggle" onClick={onClearThreadSearch} type="button">
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <section className="turn-list-panel">
        {visibleTurns.length ? (
          rightPanelMode === "turns" ? (
            <div className="selection-list">
              {visibleTurns.map((turn) => {
                const turnHeading = getTurnHeading(turn);
                const questionPreview = getQuestionPreview(turn);
                const answerPreview = getAnswerPreview(turn);
                const matchingTurnTags = getMatchingTagValues(
                  turn.tags,
                  normalizedThreadSearchTerms
                );
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
    </>
  );
}

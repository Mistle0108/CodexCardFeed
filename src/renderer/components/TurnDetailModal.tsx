import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ItemPresentation } from "../lib/turn-item-presentation";

type TurnDetailModalProps = {
  isOpen: boolean;
  selectedTurn: TurnListItem | null;
  selectedThread: ThreadListItem | null;
  primaryTurnItems: TurnItem[];
  additionalTurnItems: TurnItem[];
  isAdditionalItemsVisible: boolean;
  expandedDetailItemIds: Record<string, boolean>;
  isTurnTitleEditing: boolean;
  turnTitleDraft: string;
  isSavingTurnOverride: boolean;
  canSaveTurnTitle: boolean;
  canResetTurnTitle: boolean;
  isTurnMetadataCollapsed: boolean;
  turnTagInputDraft: string;
  turnTagsDraft: string[];
  turnNotesDraft: string;
  canAddTurnTag: boolean;
  canSaveTurnMemo: boolean;
  canClearTurnMemo: boolean;
  detailTextPreviewLength: number;
  formatDateTime: (value: string | null) => string;
  formatInteger: (value: number) => string;
  formatTokenLabel: (value: number) => string;
  getTurnHeading: (turn: TurnListItem) => string;
  getRoleClassName: (role: string) => string;
  getItemPresentation: (
    items: TurnItem[],
    itemIndex: number,
    turnReasoningTokens: number | null
  ) => ItemPresentation;
  isMarkdownDetailItem: (item: TurnItem) => boolean;
  onClose: () => void;
  onTurnTitleDraftChange: (value: string) => void;
  onToggleTurnPin: () => void | Promise<void>;
  onSaveTurnTitle: () => void | Promise<void>;
  onCancelTurnTitleEdit: () => void;
  onStartTurnTitleEdit: () => void;
  onResetTurnTitle: () => void | Promise<void>;
  onToggleTurnMetadataCollapsed: () => void;
  onTurnTagInputChange: (value: string) => void;
  onTurnTagInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onAddTurnTag: () => void | Promise<void>;
  onRemoveTurnTag: (tag: string) => void | Promise<void>;
  onTurnNotesDraftChange: (value: string) => void;
  onSaveTurnMemo: () => void | Promise<void>;
  onResetTurnMemoDraft: () => void;
  onClearTurnMemo: () => void | Promise<void>;
  onDetailItemToggle: (itemId: string) => void;
  onToggleAdditionalItemsVisible: () => void;
};

export function TurnDetailModal({
  isOpen,
  selectedTurn,
  selectedThread,
  primaryTurnItems,
  additionalTurnItems,
  isAdditionalItemsVisible,
  expandedDetailItemIds,
  isTurnTitleEditing,
  turnTitleDraft,
  isSavingTurnOverride,
  canSaveTurnTitle,
  canResetTurnTitle,
  isTurnMetadataCollapsed,
  turnTagInputDraft,
  turnTagsDraft,
  turnNotesDraft,
  canAddTurnTag,
  canSaveTurnMemo,
  canClearTurnMemo,
  detailTextPreviewLength,
  formatDateTime,
  formatInteger,
  formatTokenLabel,
  getTurnHeading,
  getRoleClassName,
  getItemPresentation,
  isMarkdownDetailItem,
  onClose,
  onTurnTitleDraftChange,
  onToggleTurnPin,
  onSaveTurnTitle,
  onCancelTurnTitleEdit,
  onStartTurnTitleEdit,
  onResetTurnTitle,
  onToggleTurnMetadataCollapsed,
  onTurnTagInputChange,
  onTurnTagInputKeyDown,
  onAddTurnTag,
  onRemoveTurnTag,
  onTurnNotesDraftChange,
  onSaveTurnMemo,
  onResetTurnMemoDraft,
  onClearTurnMemo,
  onDetailItemToggle,
  onToggleAdditionalItemsVisible
}: TurnDetailModalProps) {
  if (!isOpen || !selectedTurn) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <section className="card modal-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="workspace-kicker">Turn detail</p>
            <h2>{selectedThread?.title ?? "Selected thread"}</h2>
            <p className="muted">
              Original stored turn items and source metadata for {getTurnHeading(selectedTurn)}
            </p>
          </div>
          <div className="modal-header-actions">
            <button className="modal-close" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="modal-scroll">
          <div className="detail-body">
            <section className="detail-meta-panel">
              <div className="detail-management-bar">
                <div className="detail-management-copy">
                  <p className="management-kicker">Local turn title</p>
                  {isTurnTitleEditing ? (
                    <input
                      className="management-title-input"
                      onChange={(event) => onTurnTitleDraftChange(event.target.value)}
                      placeholder="Leave blank to use the default turn heading"
                      type="text"
                      value={turnTitleDraft}
                    />
                  ) : (
                    <strong className="detail-management-title">
                      {selectedTurn.displayTitle ?? "Default turn heading"}
                    </strong>
                  )}
                  <p className="management-subcopy muted">
                    {selectedTurn.displayTitle
                      ? `Original heading: Turn ${selectedTurn.ordinal}`
                      : "No custom turn title stored."}
                  </p>
                </div>
                <div className="detail-management-actions">
                  <button
                    className={`secondary-button ${selectedTurn.isPinned ? "is-active" : ""}`}
                    disabled={isSavingTurnOverride}
                    onClick={() => void onToggleTurnPin()}
                    type="button"
                  >
                    {selectedTurn.isPinned ? "Unpin" : "Pin"}
                  </button>
                  {isTurnTitleEditing ? (
                    <>
                      <button
                        className="secondary-button"
                        disabled={isSavingTurnOverride || !canSaveTurnTitle}
                        onClick={() => void onSaveTurnTitle()}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="secondary-button"
                        disabled={isSavingTurnOverride}
                        onClick={onCancelTurnTitleEdit}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button"
                      disabled={isSavingTurnOverride}
                      onClick={onStartTurnTitleEdit}
                      type="button"
                    >
                      Edit title
                    </button>
                  )}
                  {canResetTurnTitle ? (
                    <button
                      className="secondary-button"
                      disabled={isSavingTurnOverride}
                      onClick={() => void onResetTurnTitle()}
                      type="button"
                    >
                      Use default
                    </button>
                  ) : null}
                </div>
              </div>

              <section className="local-metadata-panel local-metadata-panel-detail">
                <div className="local-metadata-shell-header">
                  <div>
                    <p className="management-kicker">Local metadata</p>
                    <p className="muted">Tags and memo are stored only in CodexCardFeed.</p>
                  </div>
                  <button
                    aria-expanded={!isTurnMetadataCollapsed}
                    className="secondary-button"
                    onClick={onToggleTurnMetadataCollapsed}
                    type="button"
                  >
                    {isTurnMetadataCollapsed ? "Show" : "Hide"}
                  </button>
                </div>

                {!isTurnMetadataCollapsed ? (
                  <>
                    <div className="metadata-field">
                      <div className="metadata-section-header">
                        <label className="metadata-label" htmlFor="turn-tags-input">
                          Tags
                        </label>
                        <div className="metadata-section-actions">
                          <button
                            className="secondary-button"
                            disabled={isSavingTurnOverride || !canAddTurnTag}
                            onClick={() => void onAddTurnTag()}
                            type="button"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <div className="metadata-input-row">
                        <input
                          id="turn-tags-input"
                          className="metadata-input"
                          onChange={(event) => onTurnTagInputChange(event.target.value)}
                          onKeyDown={onTurnTagInputKeyDown}
                          placeholder="Add one tag and press Enter"
                          type="text"
                          value={turnTagInputDraft}
                        />
                      </div>
                      {turnTagsDraft.length ? (
                        <div className="tag-chip-list">
                          {turnTagsDraft.map((tag) => (
                            <span className="tag-chip" key={tag}>
                              <span>{tag}</span>
                              <button
                                aria-label={`Remove ${tag} tag`}
                                className="tag-chip-remove"
                                onClick={() => void onRemoveTurnTag(tag)}
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
                        <label className="metadata-label" htmlFor="turn-notes-input">
                          Memo
                        </label>
                        <div className="metadata-section-actions">
                          <button
                            className="secondary-button"
                            disabled={isSavingTurnOverride || !canSaveTurnMemo}
                            onClick={() => void onSaveTurnMemo()}
                            type="button"
                          >
                            Save memo
                          </button>
                          <button
                            className="secondary-button"
                            disabled={isSavingTurnOverride || !canSaveTurnMemo}
                            onClick={onResetTurnMemoDraft}
                            type="button"
                          >
                            Revert memo
                          </button>
                          {canClearTurnMemo ? (
                            <button
                              className="secondary-button"
                              disabled={isSavingTurnOverride}
                              onClick={() => void onClearTurnMemo()}
                              type="button"
                            >
                              Clear memo
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <textarea
                        id="turn-notes-input"
                        className="metadata-textarea"
                        onChange={(event) => onTurnNotesDraftChange(event.target.value)}
                        placeholder="Write a local memo for this turn."
                        rows={4}
                        value={turnNotesDraft}
                      />
                    </div>
                  </>
                ) : null}
              </section>

              <div className="detail-meta-header">
                <strong>{getTurnHeading(selectedTurn)}</strong>
                <div className="detail-meta-pills">
                  {selectedTurn.isPinned ? <span className="pin-pill">Pinned</span> : null}
                  <span
                    className={`status-pill ${
                      selectedTurn.status === "completed" ? "is-complete" : "is-open"
                    }`}
                  >
                    {selectedTurn.status}
                  </span>
                  <span className="count-pill">{formatTokenLabel(selectedTurn.totalTokens)}</span>
                </div>
              </div>

              <dl className="detail-meta">
                <div>
                  <dt>Started</dt>
                  <dd>{formatDateTime(selectedTurn.startedAt)}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{formatDateTime(selectedTurn.completedAt)}</dd>
                </div>
                <div>
                  <dt>Turn ID</dt>
                  <dd>{selectedTurn.id}</dd>
                </div>
                <div>
                  <dt>Session</dt>
                  <dd>{selectedThread?.sourceSessionPath ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Workspace</dt>
                  <dd>{selectedThread?.sourceCwd ?? "Projectless"}</dd>
                </div>
              </dl>

              <dl className="token-grid">
                <div>
                  <dt>Total</dt>
                  <dd>{formatInteger(selectedTurn.totalTokens)}</dd>
                </div>
                <div>
                  <dt>Input</dt>
                  <dd>{formatInteger(selectedTurn.inputTokens)}</dd>
                </div>
                <div>
                  <dt>Cached</dt>
                  <dd>{formatInteger(selectedTurn.cachedInputTokens)}</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>{formatInteger(selectedTurn.outputTokens)}</dd>
                </div>
                <div>
                  <dt>Reasoning</dt>
                  <dd>{formatInteger(selectedTurn.reasoningOutputTokens)}</dd>
                </div>
                <div>
                  <dt>Events</dt>
                  <dd>{formatInteger(selectedTurn.tokenEventCount)}</dd>
                </div>
              </dl>
            </section>

            <div className="detail-items">
              {primaryTurnItems.length ? (
                primaryTurnItems.map((item, itemIndex) => {
                  const presentation = getItemPresentation(
                    primaryTurnItems,
                    itemIndex,
                    selectedTurn.reasoningOutputTokens
                  );
                  const isExpandableText = Boolean(
                    presentation.textContent &&
                      presentation.textContent.length > detailTextPreviewLength
                  );
                  const isDetailItemExpanded = expandedDetailItemIds[item.id] === true;
                  const isMarkdownItem = isMarkdownDetailItem(item);

                  return (
                    <article className="detail-item" key={item.id}>
                      <div className="detail-item-header">
                        <div className="detail-item-badges">
                          <span className={`role-badge ${getRoleClassName(item.role)}`}>
                            {item.role}
                          </span>
                          <span className={`item-type-badge ${presentation.categoryClassName}`}>
                            {presentation.categoryLabel}
                          </span>
                          <span className="kind-badge">{item.kind}</span>
                        </div>
                        <time className="mini-meta">{formatDateTime(item.createdAt)}</time>
                      </div>

                      <div className="detail-item-content">
                        <p className="detail-item-summary">{presentation.summary}</p>
                        {presentation.meta.length ? (
                          <dl className="detail-item-meta">
                            {presentation.meta.map((entry) => (
                              <div
                                className={Array.isArray(entry.value) ? "is-stacked" : undefined}
                                key={`${item.id}:${entry.label}`}
                              >
                                <dt>{entry.label}</dt>
                                <dd>
                                  {Array.isArray(entry.value) ? (
                                    <ul className="detail-query-list">
                                      {entry.value.map((value) => (
                                        <li key={value}>{value}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    entry.value
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                        {presentation.textContent ? (
                          isMarkdownItem ? (
                            <div
                              className={`detail-markdown ${
                                isExpandableText && !isDetailItemExpanded ? "is-collapsed" : ""
                              }`}
                            >
                              <ReactMarkdown
                                components={{
                                  a: ({ href, children }) => (
                                    <a
                                      className="detail-markdown-link"
                                      href={href}
                                      onClick={(event) => event.preventDefault()}
                                      title={href ?? undefined}
                                    >
                                      {children}
                                    </a>
                                  )
                                }}
                                remarkPlugins={[remarkGfm]}
                              >
                                {presentation.textContent}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <pre className="detail-text">{presentation.textContent}</pre>
                          )
                        ) : null}
                        {isExpandableText ? (
                          <button
                            className="detail-expand-toggle"
                            onClick={() => onDetailItemToggle(item.id)}
                            type="button"
                          >
                            {isDetailItemExpanded ? "Show less" : "Show more"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="empty-state detail-empty">
                  This turn has no stored user question or final answer yet.
                </p>
              )}
            </div>

            {additionalTurnItems.length ? (
              <section className="detail-hidden-section">
                <button
                  aria-expanded={isAdditionalItemsVisible}
                  className="detail-hidden-toggle"
                  onClick={onToggleAdditionalItemsVisible}
                  type="button"
                >
                  {isAdditionalItemsVisible
                    ? `Hide other activity (${additionalTurnItems.length})`
                    : `Show other activity (${additionalTurnItems.length})`}
                </button>

                {isAdditionalItemsVisible ? (
                  <div className="detail-items detail-items-hidden">
                    {additionalTurnItems.map((item, itemIndex) => {
                      const presentation = getItemPresentation(
                        additionalTurnItems,
                        itemIndex,
                        selectedTurn.reasoningOutputTokens
                      );

                      return (
                        <article className="detail-item" key={item.id}>
                          <div className="detail-item-header">
                            <div className="detail-item-badges">
                              <span className={`role-badge ${getRoleClassName(item.role)}`}>
                                {item.role}
                              </span>
                              <span className={`item-type-badge ${presentation.categoryClassName}`}>
                                {presentation.categoryLabel}
                              </span>
                              <span className="kind-badge">{item.kind}</span>
                            </div>
                            <time className="mini-meta">{formatDateTime(item.createdAt)}</time>
                          </div>

                          <div className="detail-item-content">
                            <p className="detail-item-summary">{presentation.summary}</p>
                            {presentation.meta.length ? (
                              <dl className="detail-item-meta">
                                {presentation.meta.map((entry) => (
                                  <div
                                    className={Array.isArray(entry.value) ? "is-stacked" : undefined}
                                    key={`${item.id}:${entry.label}`}
                                  >
                                    <dt>{entry.label}</dt>
                                    <dd>
                                      {Array.isArray(entry.value) ? (
                                        <ul className="detail-query-list">
                                          {entry.value.map((value) => (
                                            <li key={value}>{value}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        entry.value
                                      )}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : null}
                            {presentation.textContent ? (
                              <pre className="detail-text">{presentation.textContent}</pre>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

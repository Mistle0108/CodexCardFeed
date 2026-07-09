import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { LocalMetadataEditor } from "../LocalMetadataEditor";

type TurnDetailMetaPanelProps = {
  selectedTurn: TurnListItem;
  selectedThread: ThreadListItem | null;
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
  formatDateTime: (value: string | null) => string;
  formatInteger: (value: number) => string;
  formatTokenLabel: (value: number) => string;
  getTurnHeading: (turn: TurnListItem) => string;
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
};

export function TurnDetailMetaPanel({
  selectedTurn,
  selectedThread,
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
  formatDateTime,
  formatInteger,
  formatTokenLabel,
  getTurnHeading,
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
  onClearTurnMemo
}: TurnDetailMetaPanelProps) {
  return (
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

      <LocalMetadataEditor
        canAddTag={canAddTurnTag}
        canClearMemo={canClearTurnMemo}
        canSaveMemo={canSaveTurnMemo}
        className="local-metadata-panel-detail"
        isCollapsed={isTurnMetadataCollapsed}
        isSaving={isSavingTurnOverride}
        notesInputId="turn-notes-input"
        notesPlaceholder="Write a local memo for this turn."
        notesValue={turnNotesDraft}
        onAddTag={onAddTurnTag}
        onClearMemo={onClearTurnMemo}
        onNotesChange={onTurnNotesDraftChange}
        onRemoveTag={onRemoveTurnTag}
        onResetMemoDraft={onResetTurnMemoDraft}
        onSaveMemo={onSaveTurnMemo}
        onTagInputChange={onTurnTagInputChange}
        onTagInputKeyDown={onTurnTagInputKeyDown}
        onToggleCollapsed={onToggleTurnMetadataCollapsed}
        tagInputId="turn-tags-input"
        tagInputPlaceholder="Add one tag and press Enter"
        tagInputValue={turnTagInputDraft}
        tags={turnTagsDraft}
      />

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
  );
}

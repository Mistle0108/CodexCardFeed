import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ItemPresentation } from "../lib/turn-item-presentation";
import { TurnDetailItemList } from "./detail/TurnDetailItemList";
import { TurnDetailMetaPanel } from "./detail/TurnDetailMetaPanel";

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
            <TurnDetailMetaPanel
              canAddTurnTag={canAddTurnTag}
              canClearTurnMemo={canClearTurnMemo}
              canResetTurnTitle={canResetTurnTitle}
              canSaveTurnMemo={canSaveTurnMemo}
              canSaveTurnTitle={canSaveTurnTitle}
              formatDateTime={formatDateTime}
              formatInteger={formatInteger}
              formatTokenLabel={formatTokenLabel}
              getTurnHeading={getTurnHeading}
              isSavingTurnOverride={isSavingTurnOverride}
              isTurnMetadataCollapsed={isTurnMetadataCollapsed}
              isTurnTitleEditing={isTurnTitleEditing}
              onAddTurnTag={onAddTurnTag}
              onCancelTurnTitleEdit={onCancelTurnTitleEdit}
              onClearTurnMemo={onClearTurnMemo}
              onRemoveTurnTag={onRemoveTurnTag}
              onResetTurnMemoDraft={onResetTurnMemoDraft}
              onResetTurnTitle={onResetTurnTitle}
              onSaveTurnMemo={onSaveTurnMemo}
              onSaveTurnTitle={onSaveTurnTitle}
              onStartTurnTitleEdit={onStartTurnTitleEdit}
              onToggleTurnMetadataCollapsed={onToggleTurnMetadataCollapsed}
              onToggleTurnPin={onToggleTurnPin}
              onTurnNotesDraftChange={onTurnNotesDraftChange}
              onTurnTagInputChange={onTurnTagInputChange}
              onTurnTagInputKeyDown={onTurnTagInputKeyDown}
              onTurnTitleDraftChange={onTurnTitleDraftChange}
              selectedThread={selectedThread}
              selectedTurn={selectedTurn}
              turnNotesDraft={turnNotesDraft}
              turnTagInputDraft={turnTagInputDraft}
              turnTagsDraft={turnTagsDraft}
              turnTitleDraft={turnTitleDraft}
            />

            {primaryTurnItems.length ? (
              <TurnDetailItemList
                detailTextPreviewLength={detailTextPreviewLength}
                expandedDetailItemIds={expandedDetailItemIds}
                formatDateTime={formatDateTime}
                getItemPresentation={getItemPresentation}
                getRoleClassName={getRoleClassName}
                isMarkdownDetailItem={isMarkdownDetailItem}
                items={primaryTurnItems}
                onDetailItemToggle={onDetailItemToggle}
                turnReasoningTokens={selectedTurn.reasoningOutputTokens}
                variant="primary"
              />
            ) : (
              <p className="empty-state detail-empty">
                This turn has no stored user question or final answer yet.
              </p>
            )}

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
                  <TurnDetailItemList
                    detailTextPreviewLength={detailTextPreviewLength}
                    expandedDetailItemIds={expandedDetailItemIds}
                    formatDateTime={formatDateTime}
                    getItemPresentation={getItemPresentation}
                    getRoleClassName={getRoleClassName}
                    isMarkdownDetailItem={isMarkdownDetailItem}
                    items={additionalTurnItems}
                    onDetailItemToggle={onDetailItemToggle}
                    turnReasoningTokens={selectedTurn.reasoningOutputTokens}
                    variant="additional"
                  />
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

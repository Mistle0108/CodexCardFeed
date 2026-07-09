import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { LocalMetadataEditor } from "../LocalMetadataEditor";

type WorkspaceThreadPanelProps = {
  selectedThread: ThreadListItem | null;
  turns: TurnListItem[];
  visibleTurns: TurnListItem[];
  questionTurns: TurnListItem[];
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
  formatFilteredCountLabel: (
    visibleCount: number,
    totalCount: number,
    singular: string,
    plural?: string
  ) => string;
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
};

export function WorkspaceThreadPanel({
  selectedThread,
  turns,
  visibleTurns,
  questionTurns,
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
  formatFilteredCountLabel,
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
  onClearThreadSearch
}: WorkspaceThreadPanelProps) {
  return (
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
        <LocalMetadataEditor
          canAddTag={canAddThreadTag}
          canClearMemo={canClearThreadMemo}
          canSaveMemo={canSaveThreadMemo}
          isCollapsed={isThreadMetadataCollapsed}
          isSaving={isSavingThreadOverride}
          notesInputId="thread-notes-input"
          notesPlaceholder="Write a local memo for this thread."
          notesValue={threadNotesDraft}
          onAddTag={onAddThreadTag}
          onClearMemo={onClearThreadMemo}
          onNotesChange={onThreadNotesDraftChange}
          onRemoveTag={onRemoveThreadTag}
          onResetMemoDraft={onResetThreadMemoDraft}
          onSaveMemo={onSaveThreadMemo}
          onTagInputChange={onThreadTagInputChange}
          onTagInputKeyDown={onThreadTagInputKeyDown}
          onToggleCollapsed={onToggleThreadMetadataCollapsed}
          tagInputId="thread-tags-input"
          tagInputPlaceholder="Add one tag and press Enter"
          tagInputValue={threadTagInputDraft}
          tags={threadTagsDraft}
        />
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
  );
}

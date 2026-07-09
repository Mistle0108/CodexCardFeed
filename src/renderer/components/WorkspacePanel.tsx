import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { WorkspaceThreadPanel } from "./workspace/WorkspaceThreadPanel";
import { WorkspaceTurnList } from "./workspace/WorkspaceTurnList";

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
      <WorkspaceThreadPanel
        canAddThreadTag={canAddThreadTag}
        canClearThreadMemo={canClearThreadMemo}
        canResetThreadTitle={canResetThreadTitle}
        canSaveThreadMemo={canSaveThreadMemo}
        canSaveThreadTitle={canSaveThreadTitle}
        formatFilteredCountLabel={formatFilteredCountLabel}
        isSavingThreadOverride={isSavingThreadOverride}
        isThreadMetadataCollapsed={isThreadMetadataCollapsed}
        isThreadSearchActive={isThreadSearchActive}
        isThreadTitleEditing={isThreadTitleEditing}
        onAddThreadTag={onAddThreadTag}
        onCancelThreadTitleEdit={onCancelThreadTitleEdit}
        onClearThreadMemo={onClearThreadMemo}
        onClearThreadSearch={onClearThreadSearch}
        onOpenCodexThread={onOpenCodexThread}
        onResetThreadMemoDraft={onResetThreadMemoDraft}
        onResetThreadTitle={onResetThreadTitle}
        onRightPanelModeChange={onRightPanelModeChange}
        onRemoveThreadTag={onRemoveThreadTag}
        onSaveThreadMemo={onSaveThreadMemo}
        onSaveThreadTitle={onSaveThreadTitle}
        onStartThreadTitleEdit={onStartThreadTitleEdit}
        onThreadNotesDraftChange={onThreadNotesDraftChange}
        onThreadSearchQueryChange={onThreadSearchQueryChange}
        onThreadTagInputChange={onThreadTagInputChange}
        onThreadTagInputKeyDown={onThreadTagInputKeyDown}
        onThreadTitleDraftChange={onThreadTitleDraftChange}
        onToggleThreadMetadataCollapsed={onToggleThreadMetadataCollapsed}
        onToggleThreadPin={onToggleThreadPin}
        questionTurns={questionTurns}
        rightPanelMode={rightPanelMode}
        selectedThread={selectedThread}
        threadNotesDraft={threadNotesDraft}
        threadSearchQuery={threadSearchQuery}
        threadTagInputDraft={threadTagInputDraft}
        threadTagsDraft={threadTagsDraft}
        threadTitleDraft={threadTitleDraft}
        turns={turns}
        visibleTurns={visibleTurns}
      />

      <WorkspaceTurnList
        formatCountLabel={formatCountLabel}
        formatDateTime={formatDateTime}
        formatTokenLabel={formatTokenLabel}
        getAdditionalSearchExcerpt={getAdditionalSearchExcerpt}
        getAnswerPreview={getAnswerPreview}
        getMatchingMemoExcerpt={getMatchingMemoExcerpt}
        getMatchingTagValues={getMatchingTagValues}
        getQuestionPreview={getQuestionPreview}
        getTurnHeading={getTurnHeading}
        isThreadSearchActive={isThreadSearchActive}
        normalizedThreadSearchTerms={normalizedThreadSearchTerms}
        onOpenTurnDetail={onOpenTurnDetail}
        questionTurns={questionTurns}
        renderHighlightedText={renderHighlightedText}
        rightPanelMode={rightPanelMode}
        selectedThread={selectedThread}
        selectedTurnId={selectedTurnId}
        visibleTurns={visibleTurns}
      />
    </>
  );
}

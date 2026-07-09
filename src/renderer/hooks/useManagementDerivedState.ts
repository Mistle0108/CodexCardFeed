import { normalizeNoteDraft, resolveLoadErrorState } from "../lib/app-utils";
import type { LoadErrorState } from "../lib/app-utils";

type UseManagementDerivedStateArgs = {
  loadError: string | LoadErrorState | null;
  projectNotesDraft: string;
  projectTagInputDraft: string;
  projectTagsDraft: string[];
  projectTitleDraft: string;
  selectedProject: ProjectListItem | null;
  selectedThread: ThreadListItem | null;
  selectedTurn: TurnListItem | null;
  threadNotesDraft: string;
  threadTagInputDraft: string;
  threadTagsDraft: string[];
  threadTitleDraft: string;
  turnNotesDraft: string;
  turnTagInputDraft: string;
  turnTagsDraft: string[];
  turnTitleDraft: string;
};

export function useManagementDerivedState({
  loadError,
  projectNotesDraft,
  projectTagInputDraft,
  projectTagsDraft,
  projectTitleDraft,
  selectedProject,
  selectedThread,
  selectedTurn,
  threadNotesDraft,
  threadTagInputDraft,
  threadTagsDraft,
  threadTitleDraft,
  turnNotesDraft,
  turnTagInputDraft,
  turnTagsDraft,
  turnTitleDraft
}: UseManagementDerivedStateArgs) {
  const normalizedProjectNotesDraft = normalizeNoteDraft(projectNotesDraft);
  const normalizedThreadNotesDraft = normalizeNoteDraft(threadNotesDraft);
  const normalizedTurnNotesDraft = normalizeNoteDraft(turnNotesDraft);

  const canSaveThreadTitle = Boolean(
    selectedThread && threadTitleDraft.trim() !== selectedThread.title.trim()
  );
  const canResetThreadTitle = Boolean(
    selectedThread && selectedThread.title !== selectedThread.sourceTitle
  );
  const canSaveTurnTitle = Boolean(
    selectedTurn && turnTitleDraft.trim() !== (selectedTurn.displayTitle ?? "")
  );
  const canResetTurnTitle = Boolean(selectedTurn?.displayTitle);
  const canSaveProjectTitle = Boolean(
    selectedProject && projectTitleDraft.trim() !== selectedProject.displayName.trim()
  );
  const canResetProjectTitle = Boolean(
    selectedProject && selectedProject.displayName !== selectedProject.sourceDisplayName
  );
  const canAddProjectTag = Boolean(
    projectTagInputDraft.trim() && !projectTagsDraft.includes(projectTagInputDraft.trim())
  );
  const canSaveProjectMemo = Boolean(
    selectedProject && normalizedProjectNotesDraft !== selectedProject.notes
  );
  const canClearProjectMemo = Boolean(selectedProject?.notes);
  const canAddThreadTag = Boolean(
    threadTagInputDraft.trim() && !threadTagsDraft.includes(threadTagInputDraft.trim())
  );
  const canSaveThreadMemo = Boolean(
    selectedThread && normalizedThreadNotesDraft !== selectedThread.notes
  );
  const canClearThreadMemo = Boolean(selectedThread?.notes);
  const canAddTurnTag = Boolean(
    turnTagInputDraft.trim() && !turnTagsDraft.includes(turnTagInputDraft.trim())
  );
  const canSaveTurnMemo = Boolean(
    selectedTurn && normalizedTurnNotesDraft !== selectedTurn.notes
  );
  const canClearTurnMemo = Boolean(selectedTurn?.notes);
  const activeLoadError = resolveLoadErrorState(loadError);

  return {
    activeLoadError,
    canAddProjectTag,
    canAddThreadTag,
    canAddTurnTag,
    canClearProjectMemo,
    canClearThreadMemo,
    canClearTurnMemo,
    canResetProjectTitle,
    canResetThreadTitle,
    canResetTurnTitle,
    canSaveProjectMemo,
    canSaveProjectTitle,
    canSaveThreadMemo,
    canSaveThreadTitle,
    canSaveTurnMemo,
    canSaveTurnTitle,
    normalizedProjectNotesDraft,
    normalizedThreadNotesDraft,
    normalizedTurnNotesDraft
  };
}

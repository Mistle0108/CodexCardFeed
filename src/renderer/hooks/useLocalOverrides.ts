import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  appendTagDraft,
  areStringListsEqual,
  getErrorMessage,
  resolveProjectDisplayNameOverride,
  resolveThreadDisplayTitleOverride,
  resolveTurnDisplayTitleOverride,
  sortProjectRows,
  sortThreadRows,
  sortTurnRows
} from "../lib/app-utils";
import type { LoadErrorState } from "../lib/app-utils";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type ProjectOverrideController = {
  selectedProject: ProjectListItem | null;
  projectTitleDraft: string;
  projectTagInputDraft: string;
  projectTagsDraft: string[];
  normalizedProjectNotesDraft: string;
  setIsProjectTitleEditing: StateSetter<boolean>;
  setProjectNotesDraft: StateSetter<string>;
  setProjectTagInputDraft: StateSetter<string>;
  setProjectTagsDraft: StateSetter<string[]>;
};

type ThreadOverrideController = {
  selectedThread: ThreadListItem | null;
  threadTitleDraft: string;
  threadTagInputDraft: string;
  threadTagsDraft: string[];
  normalizedThreadNotesDraft: string;
  setIsThreadTitleEditing: StateSetter<boolean>;
  setThreadNotesDraft: StateSetter<string>;
  setThreadTagInputDraft: StateSetter<string>;
  setThreadTagsDraft: StateSetter<string[]>;
};

type TurnOverrideController = {
  selectedTurn: TurnListItem | null;
  turnTitleDraft: string;
  turnTagInputDraft: string;
  turnTagsDraft: string[];
  normalizedTurnNotesDraft: string;
  setIsTurnTitleEditing: StateSetter<boolean>;
  setTurnNotesDraft: StateSetter<string>;
  setTurnTagInputDraft: StateSetter<string>;
  setTurnTagsDraft: StateSetter<string[]>;
};

type UseLocalOverridesArgs = {
  project: ProjectOverrideController;
  thread: ThreadOverrideController;
  turn: TurnOverrideController;
  setLoadError: StateSetter<string | LoadErrorState | null>;
  setProjects: StateSetter<ProjectListItem[]>;
  setThreads: StateSetter<ThreadListItem[]>;
  setTurns: StateSetter<TurnListItem[]>;
};

export function useLocalOverrides({
  project,
  thread,
  turn,
  setLoadError,
  setProjects,
  setThreads,
  setTurns
}: UseLocalOverridesArgs) {
  const [isSavingProjectOverride, setIsSavingProjectOverride] = useState(false);
  const [isSavingThreadOverride, setIsSavingThreadOverride] = useState(false);
  const [isSavingTurnOverride, setIsSavingTurnOverride] = useState(false);

  function applyProjectOverrideToState(projectId: string, changes: ProjectOverrideInput) {
    setProjects((current) =>
      sortProjectRows(
        current.map((item) => {
          if (item.id !== projectId) {
            return item;
          }

          return {
            ...item,
            displayName:
              changes.displayName !== undefined
                ? changes.displayName ?? item.sourceDisplayName
                : item.displayName,
            isPinned: changes.isPinned ?? item.isPinned,
            tags: changes.tags !== undefined ? changes.tags ?? [] : item.tags,
            notes: changes.notes !== undefined ? changes.notes ?? "" : item.notes
          };
        })
      )
    );
  }

  function applyThreadOverrideToState(threadId: string, changes: LocalOverrideInput) {
    setThreads((current) =>
      sortThreadRows(
        current.map((item) => {
          if (item.id !== threadId) {
            return item;
          }

          return {
            ...item,
            title:
              changes.displayTitle !== undefined
                ? changes.displayTitle ?? item.sourceTitle
                : item.title,
            isPinned: changes.isPinned ?? item.isPinned,
            tags: changes.tags !== undefined ? changes.tags ?? [] : item.tags,
            notes: changes.notes !== undefined ? changes.notes ?? "" : item.notes
          };
        })
      )
    );
  }

  function applyTurnOverrideToState(turnId: string, changes: LocalOverrideInput) {
    setTurns((current) =>
      sortTurnRows(
        current.map((item) => {
          if (item.id !== turnId) {
            return item;
          }

          return {
            ...item,
            displayTitle:
              changes.displayTitle !== undefined ? changes.displayTitle : item.displayTitle,
            isPinned: changes.isPinned ?? item.isPinned,
            tags: changes.tags !== undefined ? changes.tags ?? [] : item.tags,
            notes: changes.notes !== undefined ? changes.notes ?? "" : item.notes
          };
        })
      )
    );
  }

  async function persistProjectOverride(
    changes: ProjectOverrideInput,
    onSuccess?: () => void
  ) {
    if (!project.selectedProject) {
      return;
    }

    setIsSavingProjectOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveProjectOverride(project.selectedProject.id, changes);
      applyProjectOverrideToState(project.selectedProject.id, changes);
      onSuccess?.();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  async function persistThreadOverride(changes: LocalOverrideInput, onSuccess?: () => void) {
    if (!thread.selectedThread) {
      return;
    }

    setIsSavingThreadOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveThreadOverride(thread.selectedThread.id, changes);
      applyThreadOverrideToState(thread.selectedThread.id, changes);
      onSuccess?.();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  async function persistTurnOverride(changes: LocalOverrideInput, onSuccess?: () => void) {
    if (!turn.selectedTurn) {
      return;
    }

    setIsSavingTurnOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveTurnOverride(turn.selectedTurn.id, changes);
      applyTurnOverrideToState(turn.selectedTurn.id, changes);
      onSuccess?.();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  async function handleAddProjectTag() {
    if (!project.selectedProject || !project.projectTagInputDraft.trim()) {
      return;
    }

    const nextTags = appendTagDraft(project.projectTagsDraft, project.projectTagInputDraft);

    if (areStringListsEqual(nextTags, project.projectTagsDraft)) {
      project.setProjectTagInputDraft("");
      return;
    }

    await persistProjectOverride({ tags: nextTags }, () => {
      project.setProjectTagInputDraft("");
      project.setProjectTagsDraft(nextTags);
    });
  }

  async function handleRemoveProjectTag(tagToRemove: string) {
    if (!project.selectedProject) {
      return;
    }

    const nextTags = project.projectTagsDraft.filter((tag) => tag !== tagToRemove);
    await persistProjectOverride({ tags: nextTags }, () => {
      project.setProjectTagsDraft(nextTags);
    });
  }

  async function handleSaveProjectTitle() {
    if (!project.selectedProject) {
      return;
    }

    const nextDisplayName = resolveProjectDisplayNameOverride(
      project.projectTitleDraft,
      project.selectedProject.sourceDisplayName
    );

    await persistProjectOverride({ displayName: nextDisplayName }, () => {
      project.setIsProjectTitleEditing(false);
    });
  }

  async function handleResetProjectTitle() {
    await persistProjectOverride({ displayName: null }, () => {
      project.setIsProjectTitleEditing(false);
    });
  }

  async function handleSaveProjectMemo() {
    await persistProjectOverride({ notes: project.normalizedProjectNotesDraft });
  }

  async function handleClearProjectMemo() {
    await persistProjectOverride({ notes: "" }, () => {
      project.setProjectNotesDraft("");
    });
  }

  async function handleToggleProjectPin() {
    if (!project.selectedProject) {
      return;
    }

    await persistProjectOverride({
      isPinned: !project.selectedProject.isPinned
    });
  }

  async function handleAddThreadTag() {
    if (!thread.selectedThread || !thread.threadTagInputDraft.trim()) {
      return;
    }

    const nextTags = appendTagDraft(thread.threadTagsDraft, thread.threadTagInputDraft);

    if (areStringListsEqual(nextTags, thread.threadTagsDraft)) {
      thread.setThreadTagInputDraft("");
      return;
    }

    await persistThreadOverride({ tags: nextTags }, () => {
      thread.setThreadTagInputDraft("");
      thread.setThreadTagsDraft(nextTags);
    });
  }

  async function handleRemoveThreadTag(tagToRemove: string) {
    if (!thread.selectedThread) {
      return;
    }

    const nextTags = thread.threadTagsDraft.filter((tag) => tag !== tagToRemove);
    await persistThreadOverride({ tags: nextTags }, () => {
      thread.setThreadTagsDraft(nextTags);
    });
  }

  async function handleSaveThreadTitle() {
    if (!thread.selectedThread) {
      return;
    }

    const nextDisplayTitle = resolveThreadDisplayTitleOverride(
      thread.threadTitleDraft,
      thread.selectedThread.sourceTitle
    );

    await persistThreadOverride({ displayTitle: nextDisplayTitle }, () => {
      thread.setIsThreadTitleEditing(false);
    });
  }

  async function handleResetThreadTitle() {
    await persistThreadOverride({ displayTitle: null }, () => {
      thread.setIsThreadTitleEditing(false);
    });
  }

  async function handleSaveThreadMemo() {
    await persistThreadOverride({ notes: thread.normalizedThreadNotesDraft });
  }

  async function handleClearThreadMemo() {
    await persistThreadOverride({ notes: "" }, () => {
      thread.setThreadNotesDraft("");
    });
  }

  async function handleToggleThreadPin() {
    if (!thread.selectedThread) {
      return;
    }

    await persistThreadOverride({
      isPinned: !thread.selectedThread.isPinned
    });
  }

  async function handleAddTurnTag() {
    if (!turn.selectedTurn || !turn.turnTagInputDraft.trim()) {
      return;
    }

    const nextTags = appendTagDraft(turn.turnTagsDraft, turn.turnTagInputDraft);

    if (areStringListsEqual(nextTags, turn.turnTagsDraft)) {
      turn.setTurnTagInputDraft("");
      return;
    }

    await persistTurnOverride({ tags: nextTags }, () => {
      turn.setTurnTagInputDraft("");
      turn.setTurnTagsDraft(nextTags);
    });
  }

  async function handleRemoveTurnTag(tagToRemove: string) {
    if (!turn.selectedTurn) {
      return;
    }

    const nextTags = turn.turnTagsDraft.filter((tag) => tag !== tagToRemove);
    await persistTurnOverride({ tags: nextTags }, () => {
      turn.setTurnTagsDraft(nextTags);
    });
  }

  async function handleSaveTurnTitle() {
    if (!turn.selectedTurn) {
      return;
    }

    const nextDisplayTitle = resolveTurnDisplayTitleOverride(turn.turnTitleDraft);
    await persistTurnOverride({ displayTitle: nextDisplayTitle }, () => {
      turn.setIsTurnTitleEditing(false);
    });
  }

  async function handleResetTurnTitle() {
    await persistTurnOverride({ displayTitle: null }, () => {
      turn.setIsTurnTitleEditing(false);
    });
  }

  async function handleSaveTurnMemo() {
    await persistTurnOverride({ notes: turn.normalizedTurnNotesDraft });
  }

  async function handleClearTurnMemo() {
    await persistTurnOverride({ notes: "" }, () => {
      turn.setTurnNotesDraft("");
    });
  }

  async function handleToggleTurnPin() {
    if (!turn.selectedTurn) {
      return;
    }

    await persistTurnOverride({
      isPinned: !turn.selectedTurn.isPinned
    });
  }

  return {
    handleAddProjectTag,
    handleAddThreadTag,
    handleAddTurnTag,
    handleClearProjectMemo,
    handleClearThreadMemo,
    handleClearTurnMemo,
    handleRemoveProjectTag,
    handleRemoveThreadTag,
    handleRemoveTurnTag,
    handleResetProjectTitle,
    handleResetThreadTitle,
    handleResetTurnTitle,
    handleSaveProjectMemo,
    handleSaveProjectTitle,
    handleSaveThreadMemo,
    handleSaveThreadTitle,
    handleSaveTurnMemo,
    handleSaveTurnTitle,
    handleToggleProjectPin,
    handleToggleThreadPin,
    handleToggleTurnPin,
    isSavingProjectOverride,
    isSavingThreadOverride,
    isSavingTurnOverride
  };
}

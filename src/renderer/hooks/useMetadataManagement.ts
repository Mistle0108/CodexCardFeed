import type { Dispatch, SetStateAction } from "react";
import type { LoadErrorState } from "../lib/app-utils";
import { useLocalOverrides } from "./useLocalOverrides";
import { useManagementDerivedState } from "./useManagementDerivedState";
import { useMetadataDraftState } from "./useMetadataDraftState";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type UseMetadataManagementArgs = {
  loadError: string | LoadErrorState | null;
  projectModalProjectId: string | null;
  projects: ProjectListItem[];
  selectedThreadId: string | null;
  selectedTurnId: string | null;
  setLoadError: StateSetter<string | LoadErrorState | null>;
  setProjects: StateSetter<ProjectListItem[]>;
  setThreads: StateSetter<ThreadListItem[]>;
  setTurns: StateSetter<TurnListItem[]>;
  threads: ThreadListItem[];
  turns: TurnListItem[];
};

export function useMetadataManagement({
  loadError,
  projectModalProjectId,
  projects,
  selectedThreadId,
  selectedTurnId,
  setLoadError,
  setProjects,
  setThreads,
  setTurns,
  threads,
  turns
}: UseMetadataManagementArgs) {
  const selectedProject =
    projects.find((project) => project.id === projectModalProjectId) ?? null;
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const selectedTurn = turns.find((turn) => turn.id === selectedTurnId) ?? null;

  const metadataDraftState = useMetadataDraftState({
    selectedProject,
    selectedThread,
    selectedTurn
  });

  const managementDerivedState = useManagementDerivedState({
    loadError,
    projectNotesDraft: metadataDraftState.projectNotesDraft,
    projectTagInputDraft: metadataDraftState.projectTagInputDraft,
    projectTagsDraft: metadataDraftState.projectTagsDraft,
    projectTitleDraft: metadataDraftState.projectTitleDraft,
    selectedProject,
    selectedThread,
    selectedTurn,
    threadNotesDraft: metadataDraftState.threadNotesDraft,
    threadTagInputDraft: metadataDraftState.threadTagInputDraft,
    threadTagsDraft: metadataDraftState.threadTagsDraft,
    threadTitleDraft: metadataDraftState.threadTitleDraft,
    turnNotesDraft: metadataDraftState.turnNotesDraft,
    turnTagInputDraft: metadataDraftState.turnTagInputDraft,
    turnTagsDraft: metadataDraftState.turnTagsDraft,
    turnTitleDraft: metadataDraftState.turnTitleDraft
  });

  const localOverridesState = useLocalOverrides({
    project: {
      normalizedProjectNotesDraft: managementDerivedState.normalizedProjectNotesDraft,
      projectTagInputDraft: metadataDraftState.projectTagInputDraft,
      projectTagsDraft: metadataDraftState.projectTagsDraft,
      projectTitleDraft: metadataDraftState.projectTitleDraft,
      selectedProject,
      setIsProjectTitleEditing: metadataDraftState.setIsProjectTitleEditing,
      setProjectNotesDraft: metadataDraftState.setProjectNotesDraft,
      setProjectTagInputDraft: metadataDraftState.setProjectTagInputDraft,
      setProjectTagsDraft: metadataDraftState.setProjectTagsDraft
    },
    thread: {
      normalizedThreadNotesDraft: managementDerivedState.normalizedThreadNotesDraft,
      selectedThread,
      setIsThreadTitleEditing: metadataDraftState.setIsThreadTitleEditing,
      setThreadNotesDraft: metadataDraftState.setThreadNotesDraft,
      setThreadTagInputDraft: metadataDraftState.setThreadTagInputDraft,
      setThreadTagsDraft: metadataDraftState.setThreadTagsDraft,
      threadTagInputDraft: metadataDraftState.threadTagInputDraft,
      threadTagsDraft: metadataDraftState.threadTagsDraft,
      threadTitleDraft: metadataDraftState.threadTitleDraft
    },
    turn: {
      normalizedTurnNotesDraft: managementDerivedState.normalizedTurnNotesDraft,
      selectedTurn,
      setIsTurnTitleEditing: metadataDraftState.setIsTurnTitleEditing,
      setTurnNotesDraft: metadataDraftState.setTurnNotesDraft,
      setTurnTagInputDraft: metadataDraftState.setTurnTagInputDraft,
      setTurnTagsDraft: metadataDraftState.setTurnTagsDraft,
      turnTagInputDraft: metadataDraftState.turnTagInputDraft,
      turnTagsDraft: metadataDraftState.turnTagsDraft,
      turnTitleDraft: metadataDraftState.turnTitleDraft
    },
    setLoadError,
    setProjects,
    setThreads,
    setTurns
  });

  return {
    ...localOverridesState,
    ...managementDerivedState,
    ...metadataDraftState,
    selectedProject,
    selectedThread,
    selectedTurn
  };
}

import { useEffect, useState } from "react";

type UseMetadataDraftStateArgs = {
  selectedProject: ProjectListItem | null;
  selectedThread: ThreadListItem | null;
  selectedTurn: TurnListItem | null;
};

export function useMetadataDraftState({
  selectedProject,
  selectedThread,
  selectedTurn
}: UseMetadataDraftStateArgs) {
  const [isProjectTitleEditing, setIsProjectTitleEditing] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [isProjectMetadataCollapsed, setIsProjectMetadataCollapsed] = useState(false);
  const [projectTagInputDraft, setProjectTagInputDraft] = useState("");
  const [projectTagsDraft, setProjectTagsDraft] = useState<string[]>([]);
  const [projectNotesDraft, setProjectNotesDraft] = useState("");

  const [isThreadTitleEditing, setIsThreadTitleEditing] = useState(false);
  const [threadTitleDraft, setThreadTitleDraft] = useState("");
  const [isThreadMetadataCollapsed, setIsThreadMetadataCollapsed] = useState(true);
  const [threadTagInputDraft, setThreadTagInputDraft] = useState("");
  const [threadTagsDraft, setThreadTagsDraft] = useState<string[]>([]);
  const [threadNotesDraft, setThreadNotesDraft] = useState("");

  const [isTurnTitleEditing, setIsTurnTitleEditing] = useState(false);
  const [turnTitleDraft, setTurnTitleDraft] = useState("");
  const [isTurnMetadataCollapsed, setIsTurnMetadataCollapsed] = useState(false);
  const [turnTagInputDraft, setTurnTagInputDraft] = useState("");
  const [turnTagsDraft, setTurnTagsDraft] = useState<string[]>([]);
  const [turnNotesDraft, setTurnNotesDraft] = useState("");

  useEffect(() => {
    setIsProjectTitleEditing(false);
    setProjectTitleDraft(selectedProject?.displayName ?? "");
    setProjectTagInputDraft("");
    setProjectTagsDraft(selectedProject?.tags ?? []);
    setProjectNotesDraft(selectedProject?.notes ?? "");
  }, [
    selectedProject?.displayName,
    selectedProject?.id,
    selectedProject?.notes,
    selectedProject?.tags
  ]);

  useEffect(() => {
    setIsThreadTitleEditing(false);
    setThreadTitleDraft(selectedThread?.title ?? "");
    setThreadTagInputDraft("");
    setThreadTagsDraft(selectedThread?.tags ?? []);
    setThreadNotesDraft(selectedThread?.notes ?? "");
  }, [selectedThread?.id, selectedThread?.title, selectedThread?.notes, selectedThread?.tags]);

  useEffect(() => {
    setIsThreadMetadataCollapsed(true);
  }, [selectedThread?.id]);

  useEffect(() => {
    setIsTurnTitleEditing(false);
    setTurnTitleDraft(selectedTurn?.displayTitle ?? "");
    setTurnTagInputDraft("");
    setTurnTagsDraft(selectedTurn?.tags ?? []);
    setTurnNotesDraft(selectedTurn?.notes ?? "");
  }, [selectedTurn?.id, selectedTurn?.displayTitle, selectedTurn?.notes, selectedTurn?.tags]);

  function handleCancelProjectTitleEdit() {
    setProjectTitleDraft(selectedProject?.displayName ?? "");
    setIsProjectTitleEditing(false);
  }

  function handleResetProjectMemoDraft() {
    setProjectNotesDraft(selectedProject?.notes ?? "");
  }

  function handleStartProjectTitleEdit() {
    setIsProjectTitleEditing(true);
  }

  function handleToggleProjectMetadataCollapsed() {
    setIsProjectMetadataCollapsed((value) => !value);
  }

  function handleCancelThreadTitleEdit() {
    setThreadTitleDraft(selectedThread?.title ?? "");
    setIsThreadTitleEditing(false);
  }

  function handleResetThreadMemoDraft() {
    setThreadNotesDraft(selectedThread?.notes ?? "");
  }

  function handleStartThreadTitleEdit() {
    setIsThreadTitleEditing(true);
  }

  function handleToggleThreadMetadataCollapsed() {
    setIsThreadMetadataCollapsed((value) => !value);
  }

  function handleCancelTurnTitleEdit() {
    setTurnTitleDraft(selectedTurn?.displayTitle ?? "");
    setIsTurnTitleEditing(false);
  }

  function handleResetTurnMemoDraft() {
    setTurnNotesDraft(selectedTurn?.notes ?? "");
  }

  function handleStartTurnTitleEdit() {
    setIsTurnTitleEditing(true);
  }

  function handleToggleTurnMetadataCollapsed() {
    setIsTurnMetadataCollapsed((value) => !value);
  }

  return {
    handleCancelProjectTitleEdit,
    handleCancelThreadTitleEdit,
    handleCancelTurnTitleEdit,
    handleResetProjectMemoDraft,
    handleResetThreadMemoDraft,
    handleResetTurnMemoDraft,
    handleStartProjectTitleEdit,
    handleStartThreadTitleEdit,
    handleStartTurnTitleEdit,
    handleToggleProjectMetadataCollapsed,
    handleToggleThreadMetadataCollapsed,
    handleToggleTurnMetadataCollapsed,
    isProjectMetadataCollapsed,
    isProjectTitleEditing,
    isThreadMetadataCollapsed,
    isThreadTitleEditing,
    isTurnMetadataCollapsed,
    isTurnTitleEditing,
    projectNotesDraft,
    projectTagInputDraft,
    projectTagsDraft,
    projectTitleDraft,
    setIsProjectMetadataCollapsed,
    setIsProjectTitleEditing,
    setIsThreadMetadataCollapsed,
    setIsThreadTitleEditing,
    setIsTurnMetadataCollapsed,
    setIsTurnTitleEditing,
    setProjectNotesDraft,
    setProjectTagInputDraft,
    setProjectTagsDraft,
    setProjectTitleDraft,
    setThreadNotesDraft,
    setThreadTagInputDraft,
    setThreadTagsDraft,
    setThreadTitleDraft,
    setTurnNotesDraft,
    setTurnTagInputDraft,
    setTurnTagsDraft,
    setTurnTitleDraft,
    threadNotesDraft,
    threadTagInputDraft,
    threadTagsDraft,
    threadTitleDraft,
    turnNotesDraft,
    turnTagInputDraft,
    turnTagsDraft,
    turnTitleDraft
  };
}

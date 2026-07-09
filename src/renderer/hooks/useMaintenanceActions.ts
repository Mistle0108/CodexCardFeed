import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  formatBackupReloadError,
  formatPathReloadError,
  getErrorMessage,
  getFriendlyErrorMessage
} from "../lib/app-utils";
import type { ActionState, LoadErrorState } from "../lib/app-utils";
import type { LibrarySelectionState } from "./useLibraryData";

type StateSetter<T> = Dispatch<SetStateAction<T>>;

type LoadFallback = {
  title: string;
  hint?: string;
};

type UseMaintenanceActionsArgs = {
  applyLibrarySelection: (selection: LibrarySelectionState) => void;
  refreshLibraryState: (
    preferredThreadId: string | null,
    preferredTurnId: string | null
  ) => Promise<LibrarySelectionState>;
  selectedThreadId: string | null;
  selectedTurnId: string | null;
  setLoadError: StateSetter<string | LoadErrorState | null>;
  setShellInfo: StateSetter<ShellInfo | null>;
  shellInfo: ShellInfo | null;
  withLibraryLoad: (task: () => Promise<void>, fallback?: LoadFallback) => Promise<boolean>;
  onOpenDiagnosticsModal: () => void;
};

export function useMaintenanceActions({
  applyLibrarySelection,
  refreshLibraryState,
  selectedThreadId,
  selectedTurnId,
  setLoadError,
  setShellInfo,
  shellInfo,
  withLibraryLoad,
  onOpenDiagnosticsModal
}: UseMaintenanceActionsArgs) {
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [sessionDiagnosisReport, setSessionDiagnosisReport] =
    useState<SessionDiagnosisReport | null>(null);
  const [isIntegrityChecking, setIsIntegrityChecking] = useState(false);
  const [isSessionDiagnosisRunning, setIsSessionDiagnosisRunning] = useState(false);
  const [isPathPanelOpen, setIsPathPanelOpen] = useState(false);
  const [codexHomeDraft, setCodexHomeDraft] = useState("");
  const [databasePathDraft, setDatabasePathDraft] = useState("");
  const [pathActionError, setPathActionError] = useState<string | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [backupActionState, setBackupActionState] = useState<ActionState | null>(null);
  const [isOpeningBackup, setIsOpeningBackup] = useState(false);
  const [restoreActionState, setRestoreActionState] = useState<ActionState | null>(null);
  const [isSavingPathKey, setIsSavingPathKey] = useState<"codexHome" | "databasePath" | null>(
    null
  );

  const canSaveCodexHome = Boolean(
    shellInfo && codexHomeDraft.trim() && codexHomeDraft.trim() !== shellInfo.codexHome
  );
  const canSaveDatabasePath = Boolean(
    shellInfo &&
      databasePathDraft.trim() &&
      databasePathDraft.trim() !== shellInfo.databasePath
  );

  useEffect(() => {
    if (!shellInfo) {
      return;
    }

    setCodexHomeDraft(shellInfo.codexHome);
    setDatabasePathDraft(shellInfo.databasePath);
  }, [shellInfo]);

  async function reloadLibrary(
    fallback: LoadFallback
  ): Promise<LibrarySelectionState | null> {
    let nextSelection: LibrarySelectionState | null = null;

    const didReload = await withLibraryLoad(async () => {
      nextSelection = await refreshLibraryState(selectedThreadId, selectedTurnId);
    }, fallback);

    if (!didReload) {
      return null;
    }

    if (nextSelection) {
      applyLibrarySelection(nextSelection);
    }

    return nextSelection;
  }

  async function handleOpenCodexThread(threadId: string) {
    setLoadError(null);

    try {
      await window.codexCardFeed.openCodexThread(threadId);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }

  async function handleRunIntegrityCheck() {
    setIsIntegrityChecking(true);
    setLoadError(null);

    try {
      const nextReport = await window.codexCardFeed.runIntegrityCheck();
      setIntegrityReport(nextReport);
      onOpenDiagnosticsModal();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsIntegrityChecking(false);
    }
  }

  async function handleRunSessionDiagnosis() {
    setIsSessionDiagnosisRunning(true);
    setLoadError(null);

    try {
      const nextReport = await window.codexCardFeed.runSessionDiagnosis();
      setSessionDiagnosisReport(nextReport);
      onOpenDiagnosticsModal();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSessionDiagnosisRunning(false);
    }
  }

  async function handleSaveCodexHome() {
    setIsSavingPathKey("codexHome");
    setPathActionError(null);

    try {
      const nextShellInfo = await window.codexCardFeed.updateCodexHome(codexHomeDraft);
      setShellInfo(nextShellInfo);

      const nextSelection = await reloadLibrary({
        title: "Library reload failed",
        hint: "The updated Codex source path was saved, but the library could not be reloaded."
      });

      if (!nextSelection) {
        setPathActionError(formatPathReloadError("codexHome"));
      }
    } catch (error) {
      setPathActionError(getFriendlyErrorMessage(error));
    } finally {
      setIsSavingPathKey(null);
    }
  }

  async function handleResetCodexHome() {
    setIsSavingPathKey("codexHome");
    setPathActionError(null);

    try {
      const nextShellInfo = await window.codexCardFeed.resetCodexHome();
      setShellInfo(nextShellInfo);

      const nextSelection = await reloadLibrary({
        title: "Library reload failed",
        hint: "The updated Codex source path was saved, but the library could not be reloaded."
      });

      if (!nextSelection) {
        setPathActionError(formatPathReloadError("codexHome"));
      }
    } catch (error) {
      setPathActionError(getFriendlyErrorMessage(error));
    } finally {
      setIsSavingPathKey(null);
    }
  }

  async function handleSaveDatabasePath() {
    setIsSavingPathKey("databasePath");
    setPathActionError(null);

    try {
      const nextShellInfo = await window.codexCardFeed.updateDatabasePath(databasePathDraft);
      setShellInfo(nextShellInfo);

      const nextSelection = await reloadLibrary({
        title: "Library reload failed",
        hint: "The updated database path was saved, but the library could not be reloaded."
      });

      if (!nextSelection) {
        setPathActionError(formatPathReloadError("databasePath"));
      }
    } catch (error) {
      setPathActionError(getFriendlyErrorMessage(error));
    } finally {
      setIsSavingPathKey(null);
    }
  }

  async function handleResetDatabasePath() {
    setIsSavingPathKey("databasePath");
    setPathActionError(null);

    try {
      const nextShellInfo = await window.codexCardFeed.resetDatabasePath();
      setShellInfo(nextShellInfo);

      const nextSelection = await reloadLibrary({
        title: "Library reload failed",
        hint: "The updated database path was saved, but the library could not be reloaded."
      });

      if (!nextSelection) {
        setPathActionError(formatPathReloadError("databasePath"));
      }
    } catch (error) {
      setPathActionError(getFriendlyErrorMessage(error));
    } finally {
      setIsSavingPathKey(null);
    }
  }

  async function handleExportBackupBundle() {
    setIsExportingBackup(true);
    setBackupActionState(null);

    try {
      const result = await window.codexCardFeed.exportBackupBundle();

      if (result.canceled) {
        return;
      }

      if (!result.backupDirectory) {
        throw new Error("Backup finished without an output directory.");
      }

      setBackupActionState({
        tone: "success",
        message: `Backup saved to ${result.backupDirectory}`
      });
    } catch (error) {
      setBackupActionState({
        tone: "error",
        message: getFriendlyErrorMessage(error)
      });
    } finally {
      setIsExportingBackup(false);
    }
  }

  async function handleOpenBackupBundle() {
    setIsOpeningBackup(true);
    setRestoreActionState(null);

    try {
      const result = await window.codexCardFeed.openBackupBundle();

      if (result.canceled) {
        return;
      }

      if (!result.shellInfo || !result.backupDirectory || !result.databaseBackupPath) {
        throw new Error("Backup opened without the required metadata.");
      }

      setShellInfo(result.shellInfo);

      const hasSuggestedCodexHome =
        Boolean(result.suggestedCodexHome) &&
        result.suggestedCodexHome !== result.shellInfo.codexHome;

      if (result.suggestedCodexHome && hasSuggestedCodexHome) {
        setCodexHomeDraft(result.suggestedCodexHome);
      }

      const nextSelection = await reloadLibrary({
        title: "Backup reload failed",
        hint: "The backup database was selected, but the library could not be reloaded from it."
      });

      if (!nextSelection) {
        setRestoreActionState({
          tone: "error",
          message: formatBackupReloadError(hasSuggestedCodexHome)
        });
        return;
      }

      if (hasSuggestedCodexHome) {
        setRestoreActionState({
          tone: "success",
          message: `Opened backup from ${result.backupDirectory}. Review the detected Codex source path before saving.`
        });
        return;
      }

      setRestoreActionState({
        tone: "success",
        message: `Opened backup from ${result.backupDirectory}`
      });
    } catch (error) {
      setRestoreActionState({
        tone: "error",
        message: getFriendlyErrorMessage(error)
      });
    } finally {
      setIsOpeningBackup(false);
    }
  }

  function handleTogglePathPanel() {
    setIsPathPanelOpen((value) => !value);
  }

  return {
    backupActionState,
    canSaveCodexHome,
    canSaveDatabasePath,
    codexHomeDraft,
    databasePathDraft,
    handleExportBackupBundle,
    handleOpenBackupBundle,
    handleOpenCodexThread,
    handleResetCodexHome,
    handleResetDatabasePath,
    handleRunIntegrityCheck,
    handleRunSessionDiagnosis,
    handleSaveCodexHome,
    handleSaveDatabasePath,
    handleTogglePathPanel,
    integrityReport,
    isExportingBackup,
    isIntegrityChecking,
    isOpeningBackup,
    isPathPanelOpen,
    isSavingPathKey,
    isSessionDiagnosisRunning,
    pathActionError,
    restoreActionState,
    sessionDiagnosisReport,
    setCodexHomeDraft,
    setDatabasePathDraft
  };
}

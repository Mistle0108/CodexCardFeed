import { useEffect } from "react";

type UseAppViewEffectsArgs = {
  activeWorkspaceTabId: string;
  integrityCheckedAt: string | null | undefined;
  isDiagnosticsModalOpen: boolean;
  rightPanelMode: "turns" | "questions";
  selectedTurnId: string | null;
  setExpandedIntegrityReferenceKeys: (value: Record<string, boolean>) => void;
  turnCount: number;
};

export function useAppViewEffects({
  activeWorkspaceTabId,
  integrityCheckedAt,
  isDiagnosticsModalOpen,
  rightPanelMode,
  selectedTurnId,
  setExpandedIntegrityReferenceKeys,
  turnCount
}: UseAppViewEffectsArgs) {
  useEffect(() => {
    setExpandedIntegrityReferenceKeys({});
  }, [integrityCheckedAt, setExpandedIntegrityReferenceKeys]);

  useEffect(() => {
    if (
      activeWorkspaceTabId !== "thread" ||
      isDiagnosticsModalOpen ||
      rightPanelMode !== "turns" ||
      !selectedTurnId
    ) {
      return;
    }

    let frameId = 0;
    let attemptCount = 0;

    function revealSelectedTurn() {
      const element = document.querySelector<HTMLElement>(
        `[data-turn-card-id="${selectedTurnId}"]`
      );

      if (element) {
        element.scrollIntoView({ block: "nearest" });
        const panel = element.closest<HTMLElement>(".turn-list-panel");
        const elementBounds = element.getBoundingClientRect();
        const panelBounds = panel?.getBoundingClientRect();

        if (
          panelBounds &&
          elementBounds.top >= panelBounds.top - 1 &&
          elementBounds.bottom <= panelBounds.bottom + 1
        ) {
          return;
        }
      }

      attemptCount += 1;

      if (attemptCount < 8) {
        frameId = window.requestAnimationFrame(revealSelectedTurn);
      }
    }

    frameId = window.requestAnimationFrame(revealSelectedTurn);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [activeWorkspaceTabId, isDiagnosticsModalOpen, rightPanelMode, selectedTurnId, turnCount]);
}

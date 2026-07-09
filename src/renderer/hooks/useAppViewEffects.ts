import { useEffect } from "react";

type UseAppViewEffectsArgs = {
  integrityCheckedAt: string | null | undefined;
  isDiagnosticsModalOpen: boolean;
  rightPanelMode: "turns" | "questions";
  selectedTurnId: string | null;
  setExpandedIntegrityReferenceKeys: (value: Record<string, boolean>) => void;
  turnCount: number;
};

export function useAppViewEffects({
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
    if (isDiagnosticsModalOpen || rightPanelMode !== "turns" || !selectedTurnId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-turn-card-id="${selectedTurnId}"]`
      );
      element?.scrollIntoView({ block: "nearest" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isDiagnosticsModalOpen, rightPanelMode, selectedTurnId, turnCount]);
}

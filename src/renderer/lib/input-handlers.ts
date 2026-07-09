import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export function createEnterKeyDownHandler(
  action: () => void | Promise<void>
) {
  return (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void action();
  };
}

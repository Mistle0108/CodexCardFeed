export function readStoredCollapsedState(storageKey: string, defaultValue = false) {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  const value = window.localStorage.getItem(storageKey);

  if (value === null) {
    return defaultValue;
  }

  return value === "1";
}

export function readStoredExpandedProjectIds(storageKey: string) {
  if (typeof window === "undefined") {
    return {} as Record<string, boolean>;
  }

  const value = window.localStorage.getItem(storageKey);

  if (!value) {
    return {} as Record<string, boolean>;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => entry[1] === true)
    );
  } catch {
    return {} as Record<string, boolean>;
  }
}

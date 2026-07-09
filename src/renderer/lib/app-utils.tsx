const integerFormatter = new Intl.NumberFormat();

export type MetadataFilterState = {
  searchTerms: string[];
  pinnedOnly: boolean;
  memoOnly: boolean;
};

type MetadataFilterable = {
  tags: string[];
  notes: string;
  isPinned: boolean;
};

export type ActionState = {
  tone: "success" | "error";
  message: string;
};

export type LoadErrorState = {
  title: string;
  message: string;
  hint?: string;
};

export type LoadErrorFallback = {
  title: string;
  hint?: string;
};

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatFilteredCountLabel(
  visibleCount: number,
  totalCount: number,
  singular: string,
  plural = `${singular}s`
) {
  if (visibleCount === totalCount) {
    return formatCountLabel(visibleCount, singular, plural);
  }

  return `${visibleCount} / ${totalCount} ${totalCount === 1 ? singular : plural}`;
}

export function formatInteger(value: number) {
  return integerFormatter.format(value);
}

function compareNullableIsoDesc(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left > right ? -1 : 1;
}

export function sortProjectRows(rows: ProjectListItem[]) {
  return [...rows].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    const activityOrder = compareNullableIsoDesc(left.lastActivityAt, right.lastActivityAt);

    if (activityOrder !== 0) {
      return activityOrder;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

export function sortThreadRows(rows: ThreadListItem[]) {
  return [...rows].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    const activityOrder = compareNullableIsoDesc(
      left.updatedAt ?? left.lastSeenAt,
      right.updatedAt ?? right.lastSeenAt
    );

    if (activityOrder !== 0) {
      return activityOrder;
    }

    return right.id.localeCompare(left.id);
  });
}

export function sortTurnRows(rows: TurnListItem[]) {
  return [...rows].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    if (left.ordinal !== right.ordinal) {
      return right.ordinal - left.ordinal;
    }

    return right.id.localeCompare(left.id);
  });
}

export function formatTotalAndNewLabel(totalCount: number, newCount: number, singular: string) {
  return `${formatCountLabel(totalCount, singular)} / ${formatCountLabel(newCount, `new ${singular}`)}`;
}

export function formatTokenLabel(value: number) {
  return `${formatInteger(value)} tok`;
}

export function formatSuggestedActionLabel(value: SessionDiagnosisIssue["suggestedAction"]) {
  if (value === "reimport") {
    return "Reimport";
  }

  if (value === "restore_source") {
    return "Restore source";
  }

  if (value === "inspect_mapping") {
    return "Inspect mapping";
  }

  if (value === "inspect_db") {
    return "Inspect DB";
  }

  if (value === "inspect_source") {
    return "Inspect source";
  }

  return "Inspect";
}

export function resolveSelectedId<T extends { id: string }>(rows: T[], preferredId: string | null) {
  if (preferredId && rows.some((row) => row.id === preferredId)) {
    return preferredId;
  }

  return rows[0]?.id ?? null;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function describeKnownErrorMessage(message: string): LoadErrorState | null {
  if (message === "Codex source path cannot be empty.") {
    return {
      title: "Codex source path is required",
      message: "Enter a Codex source path before saving.",
      hint: "Use a folder that contains your local Codex session data."
    };
  }

  if (message === "Codex source path must point to an existing directory.") {
    return {
      title: "Codex source path is invalid",
      message: "The Codex source path must point to an existing folder.",
      hint: "Check the folder path in Paths and save again."
    };
  }

  if (message === "Database path cannot be empty.") {
    return {
      title: "Database path is required",
      message: "Enter a database path before saving.",
      hint: "Use a SQLite file path for the active CodexCardFeed library."
    };
  }

  if (message === "Database path must point to a file, not a directory.") {
    return {
      title: "Database path is invalid",
      message: "The database path must point to a file, not a folder.",
      hint: "Choose a `.sqlite` file path in Paths."
    };
  }

  if (message === "Selected backup folder does not exist.") {
    return {
      title: "Backup folder not found",
      message: "The selected backup folder could not be found.",
      hint: "Choose an existing backup folder created by Export Backup."
    };
  }

  if (message === "Failed to parse backup manifest.") {
    return {
      title: "Backup manifest is invalid",
      message: "The selected backup folder contains a manifest file that could not be read.",
      hint: "Choose a complete CodexCardFeed backup folder or export a new backup."
    };
  }

  if (message === "Selected backup folder does not contain codex-card-feed.sqlite.") {
    return {
      title: "Backup database is missing",
      message: "The selected backup folder does not contain `codex-card-feed.sqlite`.",
      hint: "Choose a complete backup folder created by Export Backup."
    };
  }

  if (message === "Backup finished without an output directory.") {
    return {
      title: "Backup export failed",
      message: "Backup export did not return a destination folder.",
      hint: "Run Export Backup again and choose a writable folder."
    };
  }

  if (message === "Backup opened without the required metadata.") {
    return {
      title: "Backup open failed",
      message: "The selected backup did not return the required metadata.",
      hint: "Try another backup folder or export a new backup first."
    };
  }

  return null;
}

export function buildLoadErrorState(
  error: unknown,
  fallback: LoadErrorFallback = {
    title: "Load error"
  }
): LoadErrorState {
  const rawMessage = getErrorMessage(error);
  const knownError = describeKnownErrorMessage(rawMessage);

  if (knownError) {
    return knownError;
  }

  return {
    title: fallback.title,
    message: rawMessage,
    hint: fallback.hint
  };
}

export function getFriendlyErrorMessage(error: unknown) {
  return buildLoadErrorState(error, { title: "Error" }).message;
}

export function resolveLoadErrorState(loadError: string | LoadErrorState | null) {
  if (!loadError) {
    return null;
  }

  if (typeof loadError === "string") {
    return buildLoadErrorState(loadError);
  }

  return loadError;
}

export function formatPathReloadError(target: "codexHome" | "databasePath") {
  if (target === "codexHome") {
    return "Updated the Codex source path, but the library could not be reloaded. Check the load error panel.";
  }

  return "Updated the database path, but the library could not be reloaded. Check the load error panel.";
}

export function formatBackupReloadError(hasSuggestedCodexHome: boolean) {
  if (hasSuggestedCodexHome) {
    return "Opened the backup database, but the library could not be reloaded. Review the detected Codex source path and check the load error panel.";
  }

  return "Opened the backup database, but the library could not be reloaded. Check the load error panel.";
}

export function getRoleClassName(role: string) {
  if (role === "user") {
    return "role-user";
  }

  if (role === "tool") {
    return "role-tool";
  }

  if (role === "developer") {
    return "role-developer";
  }

  return "role-assistant";
}

export function getTurnHeading(turn: TurnListItem) {
  return turn.displayTitle ? `Turn ${turn.ordinal} / ${turn.displayTitle}` : `Turn ${turn.ordinal}`;
}

export function normalizeSearchTerms(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSearchSourceText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function hasActiveMetadataFilters(filters: MetadataFilterState) {
  return Boolean(filters.searchTerms.length || filters.pinnedOnly || filters.memoOnly);
}

function containsAnySearchTerm(text: string, searchTerms: string[]) {
  const normalized = normalizeSearchSourceText(text).toLowerCase();

  if (!normalized || !searchTerms.length) {
    return false;
  }

  return searchTerms.some((term) => normalized.includes(term));
}

function matchesSearchTerms(values: string[], searchTerms: string[]) {
  if (!searchTerms.length) {
    return true;
  }

  const haystack = values
    .map((value) => normalizeSearchSourceText(value).toLowerCase())
    .filter(Boolean)
    .join("\n\n");

  if (!haystack) {
    return false;
  }

  return searchTerms.every((term) => haystack.includes(term));
}

function getHighlightedSegments(text: string, searchTerms: string[]) {
  if (!text || !searchTerms.length) {
    return [{ text, isMatch: false }];
  }

  const uniqueTerms = [...new Set(searchTerms)].sort((left, right) => right.length - left.length);

  if (!uniqueTerms.length) {
    return [{ text, isMatch: false }];
  }

  const pattern = new RegExp(uniqueTerms.map((term) => escapeRegExp(term)).join("|"), "gi");
  const segments: Array<{ text: string; isMatch: boolean }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchText = match[0] ?? "";
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, matchIndex),
        isMatch: false
      });
    }

    segments.push({
      text: matchText,
      isMatch: true
    });

    lastIndex = matchIndex + matchText.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isMatch: false
    });
  }

  return segments.length ? segments : [{ text, isMatch: false }];
}

function getMatchingExcerpt(text: string, searchTerms: string[], maxLength = 140) {
  const normalized = normalizeSearchSourceText(text);

  if (!normalized || !searchTerms.length) {
    return null;
  }

  const lowerText = normalized.toLowerCase();
  let firstMatchIndex = -1;

  for (const term of searchTerms) {
    const nextIndex = lowerText.indexOf(term);

    if (nextIndex !== -1 && (firstMatchIndex === -1 || nextIndex < firstMatchIndex)) {
      firstMatchIndex = nextIndex;
    }
  }

  if (firstMatchIndex === -1) {
    return null;
  }

  const start = Math.max(0, firstMatchIndex - Math.floor((maxLength - 1) / 2));
  const end = Math.min(normalized.length, start + maxLength);
  const excerpt = normalized.slice(start, end).trim();

  return `${start > 0 ? "..." : ""}${excerpt}${end < normalized.length ? "..." : ""}`;
}

export function renderHighlightedText(text: string, searchTerms: string[]) {
  return getHighlightedSegments(text, searchTerms).map((segment, index) =>
    segment.isMatch ? (
      <mark className="search-highlight" key={`${segment.text}-${index}`}>
        {segment.text}
      </mark>
    ) : (
      <span key={`${segment.text}-${index}`}>{segment.text}</span>
    )
  );
}

export function matchesMetadataFilters(
  item: MetadataFilterable,
  filters: MetadataFilterState,
  searchValues: string[]
) {
  if (filters.pinnedOnly && !item.isPinned) {
    return false;
  }

  if (filters.memoOnly && !item.notes.trim()) {
    return false;
  }

  if (filters.searchTerms.length) {
    return matchesSearchTerms(searchValues, filters.searchTerms);
  }

  return true;
}

export function groupThreadsByProjectId(rows: ThreadListItem[]) {
  return rows.reduce<Record<string, ThreadListItem[]>>((groups, thread) => {
    if (!groups[thread.projectId]) {
      groups[thread.projectId] = [];
    }

    groups[thread.projectId].push(thread);
    return groups;
  }, {});
}

export function matchesTurnThreadSearch(turn: TurnListItem, searchTerms: string[]) {
  return matchesSearchTerms(
    [
      turn.displayTitle ?? "",
      turn.searchUserText,
      turn.searchFinalAnswerText,
      ...turn.tags,
      turn.notes
    ],
    searchTerms
  );
}

export function resolveProjectDisplayNameOverride(draftValue: string, sourceDisplayName: string) {
  const normalizedDraft = draftValue.trim();
  return normalizedDraft && normalizedDraft !== sourceDisplayName.trim() ? normalizedDraft : null;
}

export function resolveThreadDisplayTitleOverride(draftValue: string, sourceTitle: string) {
  const normalizedDraft = draftValue.trim();
  return normalizedDraft && normalizedDraft !== sourceTitle.trim() ? normalizedDraft : null;
}

export function resolveTurnDisplayTitleOverride(draftValue: string) {
  const normalizedDraft = draftValue.trim();
  return normalizedDraft || null;
}

export function normalizeTagList(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function normalizeNoteDraft(value: string) {
  return value.trim();
}

export function areStringListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function appendTagDraft(currentTags: string[], draftValue: string) {
  return normalizeTagList([...currentTags, ...draftValue.split(/[,\n]/g)]);
}

export function getQuestionPreview(turn: TurnListItem) {
  return turn.firstUserSnippet.trim() || "No stored user message yet.";
}

export function getAnswerPreview(turn: TurnListItem) {
  return turn.firstAssistantSnippet.trim() || "No stored assistant message yet.";
}

export function getMatchingTagValues(tags: string[], searchTerms: string[]) {
  if (!searchTerms.length) {
    return [];
  }

  return tags.filter((tag) => containsAnySearchTerm(tag, searchTerms));
}

export function getMatchingMemoExcerpt(notes: string, searchTerms: string[], maxLength = 120) {
  if (!searchTerms.length || !containsAnySearchTerm(notes, searchTerms)) {
    return null;
  }

  return getMatchingExcerpt(notes, searchTerms, maxLength) ?? normalizeSearchSourceText(notes);
}

export function getAdditionalSearchExcerpt(
  fullText: string,
  visibleText: string,
  searchTerms: string[],
  maxLength = 120
) {
  if (!searchTerms.length || containsAnySearchTerm(visibleText, searchTerms)) {
    return null;
  }

  return getMatchingExcerpt(fullText, searchTerms, maxLength);
}

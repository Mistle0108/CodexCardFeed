import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const integerFormatter = new Intl.NumberFormat();
const PROJECTS_COLLAPSED_STORAGE_KEY = "codex-card-feed.sidebar.projects-collapsed";
const HISTORICAL_COLLAPSED_STORAGE_KEY = "codex-card-feed.sidebar.historical-collapsed";
const CHATS_COLLAPSED_STORAGE_KEY = "codex-card-feed.sidebar.chats-collapsed";
const EXPANDED_PROJECT_IDS_STORAGE_KEY =
  "codex-card-feed.sidebar.expanded-project-ids";
const DETAIL_TEXT_PREVIEW_LENGTH = 2400;

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatFilteredCountLabel(
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

function formatInteger(value: number) {
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

function sortProjectRows(rows: ProjectListItem[]) {
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

function sortThreadRows(rows: ThreadListItem[]) {
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

function sortTurnRows(rows: TurnListItem[]) {
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

function formatTotalAndNewLabel(totalCount: number, newCount: number, singular: string) {
  return `${formatCountLabel(totalCount, singular)} / ${formatCountLabel(newCount, `new ${singular}`)}`;
}

function formatTokenLabel(value: number) {
  return `${formatInteger(value)} tok`;
}

function formatSuggestedActionLabel(value: SessionDiagnosisIssue["suggestedAction"]) {
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

type DetailMetaEntry = {
  label: string;
  value: string | string[];
};

type ItemPresentation = {
  categoryClassName: string;
  categoryLabel: string;
  summary: string;
  meta: DetailMetaEntry[];
  textContent: string | null;
};

type MetadataFilterState = {
  searchTerms: string[];
  pinnedOnly: boolean;
  memoOnly: boolean;
};

type MetadataFilterable = {
  tags: string[];
  notes: string;
  isPinned: boolean;
};

function resolveSelectedId<T extends { id: string }>(
  rows: T[],
  preferredId: string | null
) {
  if (preferredId && rows.some((row) => row.id === preferredId)) {
    return preferredId;
  }

  return rows[0]?.id ?? null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function clipLargeText(text: string, maxLength = 1600) {
  const normalized = text.trim();

  if (!normalized) {
    return "(no text content)";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function getDetailTextContent(text: string) {
  const normalized = text.trim();
  return normalized || "(no text content)";
}

function getRoleClassName(role: string) {
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

function getTurnHeading(turn: TurnListItem) {
  return turn.displayTitle
    ? `Turn ${turn.ordinal} / ${turn.displayTitle}`
    : `Turn ${turn.ordinal}`;
}

function normalizeSearchTerms(value: string) {
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

function hasActiveMetadataFilters(filters: MetadataFilterState) {
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

function renderHighlightedText(text: string, searchTerms: string[]) {
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

function matchesMetadataFilters(
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

function groupThreadsByProjectId(rows: ThreadListItem[]) {
  return rows.reduce<Record<string, ThreadListItem[]>>((groups, thread) => {
    if (!groups[thread.projectId]) {
      groups[thread.projectId] = [];
    }

    groups[thread.projectId].push(thread);
    return groups;
  }, {});
}

function matchesTurnThreadSearch(turn: TurnListItem, searchTerms: string[]) {
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

function resolveProjectDisplayNameOverride(draftValue: string, sourceDisplayName: string) {
  const normalizedDraft = draftValue.trim();
  return normalizedDraft && normalizedDraft !== sourceDisplayName.trim() ? normalizedDraft : null;
}

function resolveThreadDisplayTitleOverride(draftValue: string, sourceTitle: string) {
  const normalizedDraft = draftValue.trim();
  return normalizedDraft && normalizedDraft !== sourceTitle.trim() ? normalizedDraft : null;
}

function resolveTurnDisplayTitleOverride(draftValue: string) {
  const normalizedDraft = draftValue.trim();
  return normalizedDraft || null;
}

function normalizeTagList(values: string[]) {
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

function normalizeNoteDraft(value: string) {
  return value.trim();
}

function areStringListsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function appendTagDraft(currentTags: string[], draftValue: string) {
  return normalizeTagList([...currentTags, ...draftValue.split(/[,\n]/g)]);
}

function getQuestionPreview(turn: TurnListItem) {
  return turn.firstUserSnippet.trim() || "No stored user message yet.";
}

function getAnswerPreview(turn: TurnListItem) {
  return turn.firstAssistantSnippet.trim() || "No stored assistant message yet.";
}

function parseJsonObject(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getWebSearchSummary(items: TurnItem[], itemIndex: number) {
  const item = items[itemIndex];

  if (item.kind !== "web_search_call") {
    return null;
  }

  const payload = parseJsonObject(item.rawJson);
  const action =
    payload?.action && typeof payload.action === "object"
      ? (payload.action as Record<string, unknown>)
      : null;
  const status = readString(payload?.status);
  const actionType = readString(action?.type);
  const query = readString(action?.query);
  const queries = readStringList(action?.queries);
  const url = readString(action?.url);
  const pattern = readString(action?.pattern);

  let sourceQuery: string | null = null;

  if (actionType === "open_page" || actionType === "find_in_page") {
    for (let index = itemIndex - 1; index >= 0; index -= 1) {
      const previousItem = items[index];

      if (previousItem.kind !== "web_search_call") {
        continue;
      }

      const previousPayload = parseJsonObject(previousItem.rawJson);
      const previousAction =
        previousPayload?.action && typeof previousPayload.action === "object"
          ? (previousPayload.action as Record<string, unknown>)
          : null;

      if (readString(previousAction?.type) !== "search") {
        continue;
      }

      sourceQuery = readString(previousAction?.query);

      if (sourceQuery) {
        break;
      }
    }
  }

  let summary = item.textContent.trim();

  if (!summary) {
    if (actionType === "search" && query) {
      summary = `Searched web for: ${query}`;
    } else if (actionType === "open_page" && sourceQuery) {
      summary = `Opened page from search: ${sourceQuery}`;
    } else if (actionType === "open_page" && url) {
      summary = `Opened page: ${url}`;
    } else if (actionType === "find_in_page" && pattern && url) {
      summary = `Searched page for "${pattern}" in: ${url}`;
    } else if (actionType === "find_in_page" && pattern) {
      summary = `Searched page for "${pattern}"`;
    } else if (actionType) {
      summary = `Web search action: ${actionType}`;
    } else {
      summary = "Web search call";
    }
  }

  return {
    summary,
    status,
    actionType,
    query,
    queries,
    url,
    pattern,
    sourceQuery
  };
}

function getItemPresentation(
  items: TurnItem[],
  itemIndex: number,
  turnReasoningTokens: number | null = null
): ItemPresentation {
  const item = items[itemIndex];
  const payload = parseJsonObject(item.rawJson);

  if (item.role === "developer") {
    return {
      categoryClassName: "type-context",
      categoryLabel: "Developer context",
      summary: "Injected runtime instructions and environment context.",
      meta: [],
      textContent: clipLargeText(item.textContent)
    };
  }

  if (item.role === "user" && item.kind === "message") {
    return {
      categoryClassName: "type-input",
      categoryLabel: "User input",
      summary: "Stored user message.",
      meta: [],
      textContent: getDetailTextContent(item.textContent)
    };
  }

  if (item.kind === "message:bootstrap_context") {
    return {
      categoryClassName: "type-context",
      categoryLabel: "Bootstrap context",
      summary: "Injected AGENTS.md and environment bootstrap message.",
      meta: [],
      textContent: clipLargeText(item.textContent)
    };
  }

  if (item.kind === "message:final_answer") {
    return {
      categoryClassName: "type-final",
      categoryLabel: "Final answer",
      summary: "Stored assistant final answer.",
      meta: [],
      textContent: getDetailTextContent(item.textContent)
    };
  }

  if (item.kind === "message:commentary") {
    return {
      categoryClassName: "type-progress",
      categoryLabel: "Progress",
      summary: "Assistant progress update during the turn.",
      meta: [],
      textContent: clipLargeText(item.textContent)
    };
  }

  if (item.kind === "reasoning") {
    const encryptedLength = readNumber(payload?.encryptedLength);
    const summaryCount = readNumber(payload?.summaryCount);

    return {
      categoryClassName: "type-reasoning",
      categoryLabel: "Reasoning",
      summary: "Stored encrypted reasoning trace.",
      meta: [
        ...(encryptedLength !== null
          ? [{ label: "Encrypted", value: `${formatInteger(encryptedLength)} chars` }]
          : []),
        ...(turnReasoningTokens !== null
          ? [{ label: "Tokens", value: formatInteger(turnReasoningTokens) }]
          : []),
        ...(summaryCount !== null && summaryCount > 0
          ? [{ label: "Summary", value: formatCountLabel(summaryCount, "entry", "entries") }]
          : [])
      ],
      textContent: null
    };
  }

  if (item.kind === "web_search_call") {
    const webSearchSummary = getWebSearchSummary(items, itemIndex);

    return {
      categoryClassName: "type-search",
      categoryLabel: "Web search",
      summary: webSearchSummary?.summary ?? "Web search activity.",
      meta: [
        ...(webSearchSummary?.actionType
          ? [{ label: "Action", value: webSearchSummary.actionType }]
          : []),
        ...(webSearchSummary?.status
          ? [{ label: "Status", value: webSearchSummary.status }]
          : []),
        ...(webSearchSummary?.sourceQuery
          ? [{ label: "Search", value: webSearchSummary.sourceQuery }]
          : []),
        ...(webSearchSummary?.query ? [{ label: "Query", value: webSearchSummary.query }] : []),
        ...(webSearchSummary?.pattern
          ? [{ label: "Pattern", value: webSearchSummary.pattern }]
          : []),
        ...(webSearchSummary?.url ? [{ label: "URL", value: webSearchSummary.url }] : []),
        ...(webSearchSummary?.queries.length
          ? [{ label: "Queries", value: webSearchSummary.queries }]
          : [])
      ],
      textContent: null
    };
  }

  if (item.kind === "function_call") {
    const name = readString(payload?.name) ?? "tool";
    const argumentsText = readString(payload?.arguments);
    const callId = readString(payload?.call_id);

    return {
      categoryClassName: "type-command",
      categoryLabel: "Command",
      summary: `Called ${name}.`,
      meta: [
        { label: "Tool", value: name },
        ...(callId ? [{ label: "Call", value: callId }] : [])
      ],
      textContent: argumentsText ? clipLargeText(argumentsText) : clipLargeText(item.textContent)
    };
  }

  if (item.kind === "function_call_output") {
    const callId = readString(payload?.call_id);

    return {
      categoryClassName: "type-command-result",
      categoryLabel: "Command result",
      summary: "Stored output from a tool call.",
      meta: [...(callId ? [{ label: "Call", value: callId }] : [])],
      textContent: clipLargeText(item.textContent)
    };
  }

  if (item.kind === "custom_tool_call") {
    const name = readString(payload?.name) ?? "custom tool";
    const status = readString(payload?.status);
    const input = readString(payload?.input);
    const callId = readString(payload?.call_id);

    return {
      categoryClassName: "type-edit",
      categoryLabel: "File change",
      summary: `Ran ${name}.`,
      meta: [
        { label: "Tool", value: name },
        ...(status ? [{ label: "Status", value: status }] : []),
        ...(callId ? [{ label: "Call", value: callId }] : [])
      ],
      textContent: input ? clipLargeText(input) : clipLargeText(item.textContent)
    };
  }

  if (item.kind === "custom_tool_call_output") {
    const callId = readString(payload?.call_id);

    return {
      categoryClassName: "type-edit-result",
      categoryLabel: "File change result",
      summary: "Stored result from a file change tool.",
      meta: [...(callId ? [{ label: "Call", value: callId }] : [])],
      textContent: clipLargeText(item.textContent)
    };
  }

  if (item.kind === "tool_search_call") {
    const argumentsObject =
      payload?.arguments && typeof payload.arguments === "object"
        ? (payload.arguments as Record<string, unknown>)
        : null;
    const query = readString(argumentsObject?.query);
    const limit = readNumber(argumentsObject?.limit);
    const status = readString(payload?.status);

    return {
      categoryClassName: "type-tool-search",
      categoryLabel: "Tool search",
      summary: query ? `Searched tools for: ${query}` : "Searched available tools.",
      meta: [
        ...(status ? [{ label: "Status", value: status }] : []),
        ...(query ? [{ label: "Query", value: query }] : []),
        ...(limit !== null ? [{ label: "Limit", value: String(limit) }] : [])
      ],
      textContent: null
    };
  }

  if (item.kind === "tool_search_output") {
    const tools = Array.isArray(payload?.tools)
      ? payload.tools
          .map((entry) =>
            entry && typeof entry === "object"
              ? readString((entry as Record<string, unknown>).name)
              : null
          )
          .filter((entry): entry is string => Boolean(entry))
      : [];
    const status = readString(payload?.status);

    return {
      categoryClassName: "type-tool-search-result",
      categoryLabel: "Tool search result",
      summary: tools.length
        ? `Returned ${tools.length} tool group${tools.length === 1 ? "" : "s"}.`
        : "Returned tool search results.",
      meta: [
        ...(status ? [{ label: "Status", value: status }] : []),
        ...(tools.length ? [{ label: "Tools", value: tools }] : [])
      ],
      textContent: null
    };
  }

  if (item.kind === "image_generation_call") {
    const status = readString(payload?.status);
    const revisedPrompt = readString(payload?.revised_prompt);

    return {
      categoryClassName: "type-image",
      categoryLabel: "Image generation",
      summary: status ? `Image generation status: ${status}.` : "Image generation activity.",
      meta: [...(status ? [{ label: "Status", value: status }] : [])],
      textContent: revisedPrompt ? clipLargeText(revisedPrompt) : null
    };
  }

  if (item.role === "assistant" && item.kind === "message") {
    return {
      categoryClassName: "type-message",
      categoryLabel: "Assistant message",
      summary: "Stored assistant message.",
      meta: [],
      textContent: clipLargeText(item.textContent)
    };
  }

  return {
    categoryClassName: "type-generic",
    categoryLabel: "Activity",
    summary: "Stored turn activity.",
    meta: [],
    textContent: item.textContent.trim() ? clipLargeText(item.textContent) : null
  };
}

function isPrimaryDetailItem(item: TurnItem) {
  return (
    (item.role === "user" && item.kind !== "message:bootstrap_context") ||
    item.kind === "message:final_answer"
  );
}

function isMarkdownDetailItem(item: TurnItem) {
  return (
    (item.role === "user" && item.kind === "message") ||
    item.kind === "message:final_answer"
  );
}

function readStoredCollapsedState(storageKey: string, defaultValue = false) {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  const value = window.localStorage.getItem(storageKey);

  if (value === null) {
    return defaultValue;
  }

  return value === "1";
}

function readStoredExpandedProjectIds() {
  if (typeof window === "undefined") {
    return {} as Record<string, boolean>;
  }

  const value = window.localStorage.getItem(EXPANDED_PROJECT_IDS_STORAGE_KEY);

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

export default function App() {
  const [shellInfo, setShellInfo] = useState<ShellInfo | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [turns, setTurns] = useState<TurnListItem[]>([]);
  const [turnItems, setTurnItems] = useState<TurnItem[]>([]);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [sessionDiagnosisReport, setSessionDiagnosisReport] =
    useState<SessionDiagnosisReport | null>(null);
  const [projectModalProjectId, setProjectModalProjectId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [isProjectTitleEditing, setIsProjectTitleEditing] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [isProjectMetadataCollapsed, setIsProjectMetadataCollapsed] = useState(false);
  const [projectTagInputDraft, setProjectTagInputDraft] = useState("");
  const [projectTagsDraft, setProjectTagsDraft] = useState<string[]>([]);
  const [projectNotesDraft, setProjectNotesDraft] = useState("");
  const [isTurnModalOpen, setIsTurnModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isIntegrityChecking, setIsIntegrityChecking] = useState(false);
  const [isSessionDiagnosisRunning, setIsSessionDiagnosisRunning] = useState(false);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [isPathPanelOpen, setIsPathPanelOpen] = useState(false);
  const [codexHomeDraft, setCodexHomeDraft] = useState("");
  const [databasePathDraft, setDatabasePathDraft] = useState("");
  const [pathActionError, setPathActionError] = useState<string | null>(null);
  const [isSavingPathKey, setIsSavingPathKey] = useState<"codexHome" | "databasePath" | null>(
    null
  );
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
  const [isSavingProjectOverride, setIsSavingProjectOverride] = useState(false);
  const [isSavingThreadOverride, setIsSavingThreadOverride] = useState(false);
  const [isSavingTurnOverride, setIsSavingTurnOverride] = useState(false);
  const [isAdditionalItemsVisible, setIsAdditionalItemsVisible] = useState(false);
  const [expandedDetailItemIds, setExpandedDetailItemIds] = useState<Record<string, boolean>>({});
  const [expandedIntegrityReferenceKeys, setExpandedIntegrityReferenceKeys] = useState<
    Record<string, boolean>
  >({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useState(() =>
    readStoredCollapsedState(PROJECTS_COLLAPSED_STORAGE_KEY)
  );
  const [isHistoricalCollapsed, setIsHistoricalCollapsed] = useState(() =>
    readStoredCollapsedState(HISTORICAL_COLLAPSED_STORAGE_KEY, true)
  );
  const [isChatsCollapsed, setIsChatsCollapsed] = useState(() =>
    readStoredCollapsedState(CHATS_COLLAPSED_STORAGE_KEY)
  );
  const [metadataTagFilter, setMetadataTagFilter] = useState("");
  const [isPinnedFilterActive, setIsPinnedFilterActive] = useState(false);
  const [isMemoFilterActive, setIsMemoFilterActive] = useState(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState("");
  const [rightPanelMode, setRightPanelMode] = useState<"turns" | "questions">("turns");
  const [expandedProjectIds, setExpandedProjectIds] = useState(() =>
    readStoredExpandedProjectIds()
  );

  const selectedProject =
    projects.find((project) => project.id === projectModalProjectId) ?? null;
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const selectedTurn = turns.find((turn) => turn.id === selectedTurnId) ?? null;
  const normalizedSidebarSearchTerms = normalizeSearchTerms(metadataTagFilter);
  const normalizedThreadSearchTerms = normalizeSearchTerms(threadSearchQuery);
  const metadataFilters: MetadataFilterState = {
    searchTerms: normalizedSidebarSearchTerms,
    pinnedOnly: isPinnedFilterActive,
    memoOnly: isMemoFilterActive
  };
  const isMetadataFilterActive = hasActiveMetadataFilters(metadataFilters);
  const isThreadSearchActive = normalizedThreadSearchTerms.length > 0;
  const visibleTurns = isThreadSearchActive
    ? turns.filter((turn) => matchesTurnThreadSearch(turn, normalizedThreadSearchTerms))
    : turns;
  const questionTurns = visibleTurns;
  const primaryTurnItems = turnItems.filter((item) => isPrimaryDetailItem(item));
  const additionalTurnItems = turnItems.filter((item) => !isPrimaryDetailItem(item));
  const integrityFailedChecks =
    integrityReport?.checks.filter((check) => check.status === "fail") ?? [];
  const integrityPassedChecks =
    integrityReport?.checks.filter((check) => check.status === "pass") ?? [];
  const sessionDiagnosisIssues = sessionDiagnosisReport
    ? [
        ...sessionDiagnosisReport.duplicates,
        ...sessionDiagnosisReport.importGaps,
        ...sessionDiagnosisReport.sourceProblems,
        ...sessionDiagnosisReport.parseProblems
      ]
    : [];
  const activeProjects = projects.filter((project) => project.projectStatus === "active");
  const allProjectIds = new Set(projects.map((project) => project.id));
  const projectThreads = threads.filter((thread) => allProjectIds.has(thread.projectId));
  const chatThreads = threads.filter((thread) => !allProjectIds.has(thread.projectId));
  const matchingProjectThreads = isMetadataFilterActive
    ? projectThreads.filter((thread) =>
        matchesMetadataFilters(thread, metadataFilters, [thread.title, ...thread.tags])
      )
    : projectThreads;
  const matchingChatThreads = isMetadataFilterActive
    ? chatThreads.filter((thread) =>
        matchesMetadataFilters(thread, metadataFilters, [thread.title, ...thread.tags])
      )
    : chatThreads;
  const matchingProjectThreadsByProjectId = groupThreadsByProjectId(matchingProjectThreads);
  const threadsByProjectId = groupThreadsByProjectId(projectThreads);
  const sidebarProjects = activeProjects.filter((project) => {
    if (!isMetadataFilterActive) {
      return true;
    }

    return (
      matchesMetadataFilters(project, metadataFilters, [project.displayName, ...project.tags]) ||
      Boolean(matchingProjectThreadsByProjectId[project.id]?.length)
    );
  });
  const allHistoricalProjects = [...projects.filter((project) => project.projectStatus !== "active")]
    .sort((left, right) => {
      if (left.projectStatus === right.projectStatus) {
        return 0;
      }

      if (left.projectStatus === "historical") {
        return -1;
      }

      if (right.projectStatus === "historical") {
        return 1;
      }

      return 0;
    });
  const historicalProjects = allHistoricalProjects.filter((project) => {
    if (!isMetadataFilterActive) {
      return true;
    }

    return (
      matchesMetadataFilters(project, metadataFilters, [project.displayName, ...project.tags]) ||
      Boolean(matchingProjectThreadsByProjectId[project.id]?.length)
    );
  });
  const normalizedProjectNotesDraft = normalizeNoteDraft(projectNotesDraft);
  const normalizedThreadNotesDraft = normalizeNoteDraft(threadNotesDraft);
  const normalizedTurnNotesDraft = normalizeNoteDraft(turnNotesDraft);
  const canSaveCodexHome = Boolean(
    shellInfo && codexHomeDraft.trim() && codexHomeDraft.trim() !== shellInfo.codexHome
  );
  const canSaveDatabasePath = Boolean(
    shellInfo &&
      databasePathDraft.trim() &&
      databasePathDraft.trim() !== shellInfo.databasePath
  );
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
    threadTagInputDraft.trim() &&
      !threadTagsDraft.includes(threadTagInputDraft.trim())
  );
  const canSaveThreadMemo = Boolean(
    selectedThread && normalizedThreadNotesDraft !== selectedThread.notes
  );
  const canClearThreadMemo = Boolean(selectedThread?.notes);
  const canAddTurnTag = Boolean(
    turnTagInputDraft.trim() &&
      !turnTagsDraft.includes(turnTagInputDraft.trim())
  );
  const canSaveTurnMemo = Boolean(
    selectedTurn && normalizedTurnNotesDraft !== selectedTurn.notes
  );
  const canClearTurnMemo = Boolean(selectedTurn?.notes);

  function revealThreadSelection(threadId: string) {
    const nextThread = threads.find((thread) => thread.id === threadId) ?? null;
    const nextProject = projects.find((project) => project.id === nextThread?.projectId) ?? null;

    if (nextThread && nextProject && allProjectIds.has(nextThread.projectId)) {
      setExpandedProjectIds((current) => ({
        ...current,
        [nextThread.projectId]: true
      }));

      if (nextProject.projectStatus !== "active") {
        setIsHistoricalCollapsed(false);
      }
    }
  }

  async function withLibraryLoad(task: () => Promise<void>) {
    setIsLibraryLoading(true);
    setLoadError(null);

    try {
      await task();
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLibraryLoading(false);
    }
  }

  async function loadShellInfoState() {
    const nextShellInfo = await window.codexCardFeed.getShellInfo();
    setShellInfo(nextShellInfo);
    return nextShellInfo;
  }

  async function loadTurnItemsState(turnId: string | null) {
    setSelectedTurnId(turnId);

    if (!turnId) {
      setTurnItems([]);
      return;
    }

    const nextItems = await window.codexCardFeed.listTurnItems(turnId);
    setTurnItems(nextItems);
  }

  async function loadTurnsForThread(threadId: string | null, preferredTurnId: string | null) {
    setSelectedThreadId(threadId);
    setIsTurnModalOpen(false);

    if (!threadId) {
      setTurns([]);
      setSelectedTurnId(null);
      setTurnItems([]);
      return;
    }

    const nextTurns = await window.codexCardFeed.listTurns(threadId);
    setTurns(nextTurns);

    const nextTurnId =
      preferredTurnId && nextTurns.some((turn) => turn.id === preferredTurnId)
        ? preferredTurnId
        : null;
    setSelectedTurnId(nextTurnId);
    setTurnItems([]);
  }

  async function refreshLibraryState(
    preferredThreadId: string | null,
    preferredTurnId: string | null
  ) {
    const [nextProjects, nextThreads] = await Promise.all([
      window.codexCardFeed.listProjects(),
      window.codexCardFeed.listThreads(null)
    ]);

    setProjects(sortProjectRows(nextProjects));
    setThreads(nextThreads);

    const nextThreadId = resolveSelectedId(nextThreads, preferredThreadId);
    const nextThread = nextThreads.find((thread) => thread.id === nextThreadId) ?? null;
    const nextProject = nextProjects.find((project) => project.id === nextThread?.projectId) ?? null;

    if (nextThread && nextProject) {
      setExpandedProjectIds((current) => ({
        ...current,
        [nextThread.projectId]: true
      }));

      if (nextProject.projectStatus !== "active") {
        setIsHistoricalCollapsed(false);
      }
    }

    await loadTurnsForThread(nextThreadId, preferredTurnId);
  }

  useEffect(() => {
    void withLibraryLoad(async () => {
      await Promise.all([refreshLibraryState(null, null), loadShellInfoState()]);
    });
  }, []);

  useEffect(() => {
    if (!shellInfo) {
      return;
    }

    setCodexHomeDraft(shellInfo.codexHome);
    setDatabasePathDraft(shellInfo.databasePath);
  }, [shellInfo]);

  useEffect(() => {
    window.localStorage.setItem(
      PROJECTS_COLLAPSED_STORAGE_KEY,
      isProjectsCollapsed ? "1" : "0"
    );
  }, [isProjectsCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(
      HISTORICAL_COLLAPSED_STORAGE_KEY,
      isHistoricalCollapsed ? "1" : "0"
    );
  }, [isHistoricalCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(
      CHATS_COLLAPSED_STORAGE_KEY,
      isChatsCollapsed ? "1" : "0"
    );
  }, [isChatsCollapsed]);

  useEffect(() => {
    window.localStorage.setItem(
      EXPANDED_PROJECT_IDS_STORAGE_KEY,
      JSON.stringify(expandedProjectIds)
    );
  }, [expandedProjectIds]);

  useEffect(() => {
    if (!projectModalProjectId && !isTurnModalOpen && !isDiagnosticsModalOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProjectModalProjectId(null);
        setIsTurnModalOpen(false);
        setIsDiagnosticsModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [projectModalProjectId, isTurnModalOpen, isDiagnosticsModalOpen]);

  useEffect(() => {
    if (projectModalProjectId && !selectedProject) {
      setProjectModalProjectId(null);
    }
  }, [projectModalProjectId, selectedProject]);

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
    setIsAdditionalItemsVisible(false);
    setExpandedDetailItemIds({});
  }, [selectedTurnId, isTurnModalOpen]);

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
    setThreadSearchQuery("");
  }, [selectedThreadId]);

  useEffect(() => {
    setIsTurnTitleEditing(false);
    setTurnTitleDraft(selectedTurn?.displayTitle ?? "");
    setTurnTagInputDraft("");
    setTurnTagsDraft(selectedTurn?.tags ?? []);
    setTurnNotesDraft(selectedTurn?.notes ?? "");
  }, [selectedTurn?.id, selectedTurn?.displayTitle, selectedTurn?.notes, selectedTurn?.tags]);

  useEffect(() => {
    setExpandedIntegrityReferenceKeys({});
  }, [integrityReport?.checkedAt]);

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
  }, [selectedTurnId, rightPanelMode, turns.length, isDiagnosticsModalOpen]);

  async function handleImportSessions() {
    setIsImporting(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.importCodexSessions();

      await withLibraryLoad(async () => {
        await Promise.all([
          refreshLibraryState(selectedThreadId, selectedTurnId),
          loadShellInfoState()
        ]);
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  }

  function handleProjectToggle(projectId: string) {
    setExpandedProjectIds((current) => ({
      ...current,
      [projectId]: !current[projectId]
    }));
  }

  function handleOpenProjectModal(projectId: string) {
    setProjectModalProjectId(projectId);
  }

  function handleResetMetadataFilters() {
    setMetadataTagFilter("");
    setIsPinnedFilterActive(false);
    setIsMemoFilterActive(false);
  }

  function handleThreadSelect(threadId: string) {
    revealThreadSelection(threadId);

    void withLibraryLoad(async () => {
      await loadTurnsForThread(threadId, null);
    });
  }

  function handleOpenTurnDetail(turnId: string) {
    void withLibraryLoad(async () => {
      await loadTurnItemsState(turnId);
      setIsTurnModalOpen(true);
    });
  }

  function handleCloseTurnModal() {
    setIsTurnModalOpen(false);
  }

  function handleCloseDiagnosticsModal() {
    setIsDiagnosticsModalOpen(false);
  }

  function handleCloseProjectModal() {
    setProjectModalProjectId(null);
  }

  function applyProjectOverrideToState(projectId: string, changes: ProjectOverrideInput) {
    setProjects((current) =>
      sortProjectRows(
        current.map((project) => {
          if (project.id !== projectId) {
            return project;
          }

          return {
            ...project,
            displayName:
              changes.displayName !== undefined
                ? changes.displayName ?? project.sourceDisplayName
                : project.displayName,
            isPinned: changes.isPinned ?? project.isPinned,
            tags: changes.tags !== undefined ? changes.tags ?? [] : project.tags,
            notes: changes.notes !== undefined ? changes.notes ?? "" : project.notes
          };
        })
      )
    );
  }

  function applyThreadOverrideToState(threadId: string, changes: LocalOverrideInput) {
    setThreads((current) =>
      sortThreadRows(
        current.map((thread) => {
          if (thread.id !== threadId) {
            return thread;
          }

          return {
            ...thread,
            title:
              changes.displayTitle !== undefined
                ? changes.displayTitle ?? thread.sourceTitle
                : thread.title,
            isPinned: changes.isPinned ?? thread.isPinned,
            tags: changes.tags !== undefined ? changes.tags ?? [] : thread.tags,
            notes: changes.notes !== undefined ? changes.notes ?? "" : thread.notes
          };
        })
      )
    );
  }

  function applyTurnOverrideToState(turnId: string, changes: LocalOverrideInput) {
    setTurns((current) =>
      sortTurnRows(
        current.map((turn) => {
          if (turn.id !== turnId) {
            return turn;
          }

          return {
            ...turn,
            displayTitle:
              changes.displayTitle !== undefined ? changes.displayTitle : turn.displayTitle,
            isPinned: changes.isPinned ?? turn.isPinned,
            tags: changes.tags !== undefined ? changes.tags ?? [] : turn.tags,
            notes: changes.notes !== undefined ? changes.notes ?? "" : turn.notes
          };
        })
      )
    );
  }

  function handleCancelThreadTitleEdit() {
    setThreadTitleDraft(selectedThread?.title ?? "");
    setIsThreadTitleEditing(false);
  }

  function handleCancelProjectTitleEdit() {
    setProjectTitleDraft(selectedProject?.displayName ?? "");
    setIsProjectTitleEditing(false);
  }

  async function handleAddProjectTag() {
    if (!selectedProject || !projectTagInputDraft.trim()) {
      return;
    }

    const nextTags = appendTagDraft(projectTagsDraft, projectTagInputDraft);

    if (areStringListsEqual(nextTags, projectTagsDraft)) {
      setProjectTagInputDraft("");
      return;
    }

    setIsSavingProjectOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveProjectOverride(selectedProject.id, {
        tags: nextTags
      });
      applyProjectOverrideToState(selectedProject.id, {
        tags: nextTags
      });
      setProjectTagInputDraft("");
      setProjectTagsDraft(nextTags);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  async function handleRemoveProjectTag(tagToRemove: string) {
    if (!selectedProject) {
      return;
    }

    const nextTags = projectTagsDraft.filter((tag) => tag !== tagToRemove);

    setIsSavingProjectOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveProjectOverride(selectedProject.id, {
        tags: nextTags
      });
      applyProjectOverrideToState(selectedProject.id, {
        tags: nextTags
      });
      setProjectTagsDraft(nextTags);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  function handleProjectTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void handleAddProjectTag();
  }

  function handleResetProjectMemoDraft() {
    setProjectNotesDraft(selectedProject?.notes ?? "");
  }

  async function handleAddThreadTag() {
    if (!selectedThread || !threadTagInputDraft.trim()) {
      return;
    }

    const nextTags = appendTagDraft(threadTagsDraft, threadTagInputDraft);

    if (areStringListsEqual(nextTags, threadTagsDraft)) {
      setThreadTagInputDraft("");
      return;
    }

    setIsSavingThreadOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveThreadOverride(selectedThread.id, {
        tags: nextTags
      });
      applyThreadOverrideToState(selectedThread.id, {
        tags: nextTags
      });
      setThreadTagInputDraft("");
      setThreadTagsDraft(nextTags);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  async function handleRemoveThreadTag(tagToRemove: string) {
    if (!selectedThread) {
      return;
    }

    const nextTags = threadTagsDraft.filter((tag) => tag !== tagToRemove);

    setIsSavingThreadOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveThreadOverride(selectedThread.id, {
        tags: nextTags
      });
      applyThreadOverrideToState(selectedThread.id, {
        tags: nextTags
      });
      setThreadTagsDraft(nextTags);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  function handleThreadTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void handleAddThreadTag();
  }

  function handleResetThreadMemoDraft() {
    setThreadNotesDraft(selectedThread?.notes ?? "");
  }

  function handleCancelTurnTitleEdit() {
    setTurnTitleDraft(selectedTurn?.displayTitle ?? "");
    setIsTurnTitleEditing(false);
  }

  async function handleAddTurnTag() {
    if (!selectedTurn || !turnTagInputDraft.trim()) {
      return;
    }

    const nextTags = appendTagDraft(turnTagsDraft, turnTagInputDraft);

    if (areStringListsEqual(nextTags, turnTagsDraft)) {
      setTurnTagInputDraft("");
      return;
    }

    setIsSavingTurnOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveTurnOverride(selectedTurn.id, {
        tags: nextTags
      });
      applyTurnOverrideToState(selectedTurn.id, {
        tags: nextTags
      });
      setTurnTagInputDraft("");
      setTurnTagsDraft(nextTags);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  async function handleRemoveTurnTag(tagToRemove: string) {
    if (!selectedTurn) {
      return;
    }

    const nextTags = turnTagsDraft.filter((tag) => tag !== tagToRemove);

    setIsSavingTurnOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveTurnOverride(selectedTurn.id, {
        tags: nextTags
      });
      applyTurnOverrideToState(selectedTurn.id, {
        tags: nextTags
      });
      setTurnTagsDraft(nextTags);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  function handleTurnTagInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void handleAddTurnTag();
  }

  function handleResetTurnMemoDraft() {
    setTurnNotesDraft(selectedTurn?.notes ?? "");
  }

  async function handleSaveProjectTitle() {
    if (!selectedProject) {
      return;
    }

    setIsSavingProjectOverride(true);
    setLoadError(null);

    const nextDisplayName = resolveProjectDisplayNameOverride(
      projectTitleDraft,
      selectedProject.sourceDisplayName
    );

    try {
      await window.codexCardFeed.saveProjectOverride(selectedProject.id, {
        displayName: nextDisplayName
      });
      applyProjectOverrideToState(selectedProject.id, {
        displayName: nextDisplayName
      });
      setIsProjectTitleEditing(false);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  async function handleResetProjectTitle() {
    if (!selectedProject) {
      return;
    }

    setIsSavingProjectOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveProjectOverride(selectedProject.id, {
        displayName: null
      });
      applyProjectOverrideToState(selectedProject.id, {
        displayName: null
      });
      setIsProjectTitleEditing(false);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  async function handleSaveProjectMemo() {
    if (!selectedProject) {
      return;
    }

    setIsSavingProjectOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveProjectOverride(selectedProject.id, {
        notes: normalizedProjectNotesDraft
      });
      applyProjectOverrideToState(selectedProject.id, {
        notes: normalizedProjectNotesDraft
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  async function handleClearProjectMemo() {
    if (!selectedProject) {
      return;
    }

    setIsSavingProjectOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveProjectOverride(selectedProject.id, {
        notes: ""
      });
      applyProjectOverrideToState(selectedProject.id, {
        notes: ""
      });
      setProjectNotesDraft("");
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  async function handleToggleProjectPin() {
    if (!selectedProject) {
      return;
    }

    setIsSavingProjectOverride(true);
    setLoadError(null);

    const nextPinned = !selectedProject.isPinned;

    try {
      await window.codexCardFeed.saveProjectOverride(selectedProject.id, {
        isPinned: nextPinned
      });
      applyProjectOverrideToState(selectedProject.id, {
        isPinned: nextPinned
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingProjectOverride(false);
    }
  }

  async function handleSaveThreadTitle() {
    if (!selectedThread) {
      return;
    }

    setIsSavingThreadOverride(true);
    setLoadError(null);

    const nextDisplayTitle = resolveThreadDisplayTitleOverride(
      threadTitleDraft,
      selectedThread.sourceTitle
    );

    try {
      await window.codexCardFeed.saveThreadOverride(selectedThread.id, {
        displayTitle: nextDisplayTitle
      });
      applyThreadOverrideToState(selectedThread.id, {
        displayTitle: nextDisplayTitle
      });
      setIsThreadTitleEditing(false);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  async function handleResetThreadTitle() {
    if (!selectedThread) {
      return;
    }

    setIsSavingThreadOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveThreadOverride(selectedThread.id, {
        displayTitle: null
      });
      applyThreadOverrideToState(selectedThread.id, {
        displayTitle: null
      });
      setIsThreadTitleEditing(false);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  async function handleSaveThreadMemo() {
    if (!selectedThread) {
      return;
    }

    setIsSavingThreadOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveThreadOverride(selectedThread.id, {
        notes: normalizedThreadNotesDraft
      });
      applyThreadOverrideToState(selectedThread.id, {
        notes: normalizedThreadNotesDraft
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  async function handleClearThreadMemo() {
    if (!selectedThread) {
      return;
    }

    setIsSavingThreadOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveThreadOverride(selectedThread.id, {
        notes: ""
      });
      applyThreadOverrideToState(selectedThread.id, {
        notes: ""
      });
      setThreadNotesDraft("");
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  async function handleToggleThreadPin() {
    if (!selectedThread) {
      return;
    }

    setIsSavingThreadOverride(true);
    setLoadError(null);

    const nextPinned = !selectedThread.isPinned;

    try {
      await window.codexCardFeed.saveThreadOverride(selectedThread.id, {
        isPinned: nextPinned
      });
      applyThreadOverrideToState(selectedThread.id, {
        isPinned: nextPinned
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingThreadOverride(false);
    }
  }

  async function handleSaveTurnTitle() {
    if (!selectedTurn) {
      return;
    }

    setIsSavingTurnOverride(true);
    setLoadError(null);

    const nextDisplayTitle = resolveTurnDisplayTitleOverride(turnTitleDraft);

    try {
      await window.codexCardFeed.saveTurnOverride(selectedTurn.id, {
        displayTitle: nextDisplayTitle
      });
      applyTurnOverrideToState(selectedTurn.id, {
        displayTitle: nextDisplayTitle
      });
      setIsTurnTitleEditing(false);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  async function handleResetTurnTitle() {
    if (!selectedTurn) {
      return;
    }

    setIsSavingTurnOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveTurnOverride(selectedTurn.id, {
        displayTitle: null
      });
      applyTurnOverrideToState(selectedTurn.id, {
        displayTitle: null
      });
      setIsTurnTitleEditing(false);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  async function handleSaveTurnMemo() {
    if (!selectedTurn) {
      return;
    }

    setIsSavingTurnOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveTurnOverride(selectedTurn.id, {
        notes: normalizedTurnNotesDraft
      });
      applyTurnOverrideToState(selectedTurn.id, {
        notes: normalizedTurnNotesDraft
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  async function handleClearTurnMemo() {
    if (!selectedTurn) {
      return;
    }

    setIsSavingTurnOverride(true);
    setLoadError(null);

    try {
      await window.codexCardFeed.saveTurnOverride(selectedTurn.id, {
        notes: ""
      });
      applyTurnOverrideToState(selectedTurn.id, {
        notes: ""
      });
      setTurnNotesDraft("");
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  async function handleToggleTurnPin() {
    if (!selectedTurn) {
      return;
    }

    setIsSavingTurnOverride(true);
    setLoadError(null);

    const nextPinned = !selectedTurn.isPinned;

    try {
      await window.codexCardFeed.saveTurnOverride(selectedTurn.id, {
        isPinned: nextPinned
      });
      applyTurnOverrideToState(selectedTurn.id, {
        isPinned: nextPinned
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSavingTurnOverride(false);
    }
  }

  function handleDetailItemToggle(itemId: string) {
    setExpandedDetailItemIds((current) => ({
      ...current,
      [itemId]: !current[itemId]
    }));
  }

  function handleIntegrityReferenceToggle(checkKey: string) {
    setExpandedIntegrityReferenceKeys((current) => ({
      ...current,
      [checkKey]: !current[checkKey]
    }));
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
      setIsDiagnosticsModalOpen(true);
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
      setIsDiagnosticsModalOpen(true);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsSessionDiagnosisRunning(false);
    }
  }

  function handleOpenDiagnosticsModal() {
    setIsDiagnosticsModalOpen(true);
  }

  function handleOpenIntegritySample(sampleRef: IntegritySampleRef) {
    if (!sampleRef.threadId) {
      return;
    }

    revealThreadSelection(sampleRef.threadId);
    setRightPanelMode("turns");
    setIsDiagnosticsModalOpen(false);

    void withLibraryLoad(async () => {
      await loadTurnsForThread(sampleRef.threadId, sampleRef.turnId);
    });
  }

  async function handleSaveCodexHome() {
    setIsSavingPathKey("codexHome");
    setPathActionError(null);

    try {
      const nextShellInfo = await window.codexCardFeed.updateCodexHome(codexHomeDraft);
      setShellInfo(nextShellInfo);

      await withLibraryLoad(async () => {
        await refreshLibraryState(selectedThreadId, selectedTurnId);
      });
    } catch (error) {
      setPathActionError(getErrorMessage(error));
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

      await withLibraryLoad(async () => {
        await refreshLibraryState(selectedThreadId, selectedTurnId);
      });
    } catch (error) {
      setPathActionError(getErrorMessage(error));
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

      await withLibraryLoad(async () => {
        await refreshLibraryState(selectedThreadId, selectedTurnId);
      });
    } catch (error) {
      setPathActionError(getErrorMessage(error));
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

      await withLibraryLoad(async () => {
        await refreshLibraryState(selectedThreadId, selectedTurnId);
      });
    } catch (error) {
      setPathActionError(getErrorMessage(error));
    } finally {
      setIsSavingPathKey(null);
    }
  }

  function getMatchingTagValues(tags: string[], searchTerms: string[]) {
    if (!searchTerms.length) {
      return [];
    }

    return tags.filter((tag) => containsAnySearchTerm(tag, searchTerms));
  }

  function getMatchingMemoExcerpt(notes: string, searchTerms: string[], maxLength = 120) {
    if (!searchTerms.length || !containsAnySearchTerm(notes, searchTerms)) {
      return null;
    }

    return getMatchingExcerpt(notes, searchTerms, maxLength) ?? normalizeSearchSourceText(notes);
  }

  function getAdditionalSearchExcerpt(
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

  return (
    <main className="app-shell">
      <aside className="sidebar-shell">
        <div className="sidebar-brand">
          <p className="sidebar-kicker">Codex conversation browser</p>
          <div className="sidebar-brand-row">
            <h1>CodexCardFeed</h1>
            <div className="sidebar-brand-actions">
              <button
                className="sidebar-utility-button"
                onClick={handleOpenDiagnosticsModal}
                type="button"
              >
                Diagnostics
              </button>
              <button
                aria-expanded={isPathPanelOpen}
                className="sidebar-utility-button"
                onClick={() => setIsPathPanelOpen((value) => !value)}
                type="button"
              >
                Paths
              </button>
            </div>
          </div>

          {isPathPanelOpen ? (
            <div className="path-panel">
              <section className="path-panel-item">
                <div className="path-panel-item-header">
                  <strong>Codex source path</strong>
                  <span className="mini-meta">Used on next import</span>
                </div>
                <p className="path-panel-value">
                  <span>Current</span>
                  <span>{shellInfo?.codexHome ?? "Loading..."}</span>
                </p>
                <p className="path-panel-value path-panel-default">
                  <span>Default</span>
                  <span>{shellInfo?.defaultCodexHome ?? "Loading..."}</span>
                </p>
                <input
                  className="path-panel-input"
                  onChange={(event) => setCodexHomeDraft(event.target.value)}
                  placeholder="C:\\Users\\name\\.codex"
                  type="text"
                  value={codexHomeDraft}
                />
                <div className="path-panel-actions">
                  <button
                    className="sidebar-collapse-toggle"
                    disabled={!canSaveCodexHome || isSavingPathKey !== null}
                    onClick={() => void handleSaveCodexHome()}
                    type="button"
                  >
                    {isSavingPathKey === "codexHome" ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="sidebar-collapse-toggle"
                    disabled={!shellInfo || isSavingPathKey !== null}
                    onClick={() => void handleResetCodexHome()}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </section>

              <section className="path-panel-item">
                <div className="path-panel-item-header">
                  <strong>Database path</strong>
                  <span className="mini-meta">Reopens DB immediately</span>
                </div>
                <p className="path-panel-value">
                  <span>Current</span>
                  <span>{shellInfo?.databasePath ?? "Loading..."}</span>
                </p>
                <p className="path-panel-value path-panel-default">
                  <span>Default</span>
                  <span>{shellInfo?.defaultDatabasePath ?? "Loading..."}</span>
                </p>
                <input
                  className="path-panel-input"
                  onChange={(event) => setDatabasePathDraft(event.target.value)}
                  placeholder="C:\\path\\to\\codex-card-feed.sqlite"
                  type="text"
                  value={databasePathDraft}
                />
                <div className="path-panel-actions">
                  <button
                    className="sidebar-collapse-toggle"
                    disabled={!canSaveDatabasePath || isSavingPathKey !== null}
                    onClick={() => void handleSaveDatabasePath()}
                    type="button"
                  >
                    {isSavingPathKey === "databasePath" ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="sidebar-collapse-toggle"
                    disabled={!shellInfo || isSavingPathKey !== null}
                    onClick={() => void handleResetDatabasePath()}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              </section>

              {pathActionError ? <p className="path-panel-error">{pathActionError}</p> : null}
            </div>
          ) : null}
        </div>

        <button
          className="sidebar-action"
          disabled={isImporting}
          onClick={handleImportSessions}
          type="button"
        >
          {isImporting ? "Importing..." : "Import Sessions"}
        </button>

        <div className="sidebar-scroll-area">
        <section className="path-panel sidebar-filter-panel">
          <section className="path-panel-item">
            <div className="path-panel-item-header">
              <strong>Filters</strong>
              {isMetadataFilterActive ? (
                <button
                  className="sidebar-collapse-toggle"
                  onClick={handleResetMetadataFilters}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <p className="sidebar-filter-copy">Applies to projects, chats, and thread lists.</p>
            <input
              className="path-panel-input sidebar-filter-input"
              onChange={(event) => setMetadataTagFilter(event.target.value)}
              placeholder="Search projects, threads, tags"
              type="text"
              value={metadataTagFilter}
            />
            <div className="sidebar-filter-actions">
              <button
                className={`sidebar-filter-chip ${isPinnedFilterActive ? "is-active" : ""}`}
                onClick={() => setIsPinnedFilterActive((value) => !value)}
                type="button"
              >
                Pinned
              </button>
              <button
                className={`sidebar-filter-chip ${isMemoFilterActive ? "is-active" : ""}`}
                onClick={() => setIsMemoFilterActive((value) => !value)}
                type="button"
              >
                Has memo
              </button>
            </div>
          </section>
        </section>

        <section
          className={`sidebar-section sidebar-projects ${
            isProjectsCollapsed ? "is-collapsed" : ""
          }`}
        >
          <div className="sidebar-section-header">
            <div>
              <h2>Projects</h2>
              <p>{formatFilteredCountLabel(sidebarProjects.length, activeProjects.length, "project")}</p>
            </div>
            <div className="sidebar-section-header-actions">
              {isLibraryLoading ? <span className="sidebar-pill">Loading</span> : null}
              <button
                aria-expanded={!isProjectsCollapsed}
                className="sidebar-collapse-toggle"
                onClick={() => setIsProjectsCollapsed((value) => !value)}
                type="button"
              >
                {isProjectsCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          </div>

          {!isProjectsCollapsed && sidebarProjects.length ? (
            <div className="sidebar-project-list">
              {sidebarProjects.map((project) => {
                const visibleProjectThreads = isMetadataFilterActive
                  ? (matchingProjectThreadsByProjectId[project.id] ?? [])
                  : (threadsByProjectId[project.id] ?? []);
                const isProjectExpanded = isMetadataFilterActive
                  ? visibleProjectThreads.length > 0
                  : Boolean(expandedProjectIds[project.id]);
                const matchingProjectTags = getMatchingTagValues(
                  project.tags,
                  normalizedSidebarSearchTerms
                );

                return (
                  <article className="sidebar-project-group" key={project.id}>
                    <div className="sidebar-project-card">
                      <button
                        className={`sidebar-project-button ${
                          selectedThread?.projectId === project.id ? "is-active" : ""
                        }`}
                        onClick={() => handleProjectToggle(project.id)}
                        type="button"
                      >
                        <div className="sidebar-project-heading">
                          <div className="sidebar-project-title-row">
                            <strong>{renderHighlightedText(project.displayName, normalizedSidebarSearchTerms)}</strong>
                            {project.isPinned ? (
                              <span className="sidebar-pin-badge">Pinned</span>
                            ) : null}
                          </div>
                        </div>
                        {matchingProjectTags.length ? (
                          <div className="sidebar-search-tag-list">
                            {matchingProjectTags.map((tag) => (
                              <span className="sidebar-search-tag" key={tag}>
                                {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="sidebar-item-meta">
                          <span>
                            {formatCountLabel(project.threadCount, "thread")} /{" "}
                            {formatCountLabel(project.turnCount, "turn")}
                          </span>
                          <span>{formatDateTime(project.lastActivityAt)}</span>
                        </div>
                      </button>
                      <div className="sidebar-project-actions">
                        <button
                          aria-label={`Manage ${project.displayName}`}
                          className="sidebar-project-action-button"
                          onClick={() => handleOpenProjectModal(project.id)}
                          type="button"
                        >
                          ...
                        </button>
                      </div>
                    </div>

                    {isProjectExpanded ? (
                      <div className="sidebar-project-thread-list">
                        {visibleProjectThreads.map((thread) => {
                          const matchingThreadTags = getMatchingTagValues(
                            thread.tags,
                            normalizedSidebarSearchTerms
                          );

                          return (
                            <button
                              className={`sidebar-project-thread-button ${
                                selectedThreadId === thread.id ? "is-active" : ""
                              }`}
                              key={thread.id}
                              onClick={() => handleThreadSelect(thread.id)}
                              type="button"
                            >
                              <span className="sidebar-thread-row">
                                <span className="sidebar-thread-title">
                                  {renderHighlightedText(thread.title, normalizedSidebarSearchTerms)}
                                </span>
                                {thread.isPinned ? (
                                  <span className="sidebar-pin-badge">Pinned</span>
                                ) : null}
                              </span>
                              {matchingThreadTags.length ? (
                                <span className="sidebar-thread-search-tags">
                                  {matchingThreadTags.map((tag) => (
                                    <span className="sidebar-search-tag" key={tag}>
                                      {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : !isProjectsCollapsed ? (
            <p className="sidebar-empty-state">
              {isMetadataFilterActive
                ? "No projects match the current filters."
                : "No current Codex projects were found."}
            </p>
          ) : null}
        </section>

        {allHistoricalProjects.length ? (
          <section
            className={`sidebar-section sidebar-historical ${
              isHistoricalCollapsed ? "is-collapsed" : ""
            }`}
          >
            <div className="sidebar-section-header">
              <div>
                <h2>Historical</h2>
                <p>{formatFilteredCountLabel(historicalProjects.length, allHistoricalProjects.length, "project")}</p>
              </div>
              <div className="sidebar-section-header-actions">
                <button
                  aria-expanded={!isHistoricalCollapsed}
                  className="sidebar-collapse-toggle"
                  onClick={() => setIsHistoricalCollapsed((value) => !value)}
                  type="button"
                >
                  {isHistoricalCollapsed ? "Show" : "Hide"}
                </button>
              </div>
            </div>

            {!isHistoricalCollapsed ? (
              <div className="sidebar-project-list">
                {historicalProjects.map((project) => {
                  const visibleProjectThreads = isMetadataFilterActive
                    ? (matchingProjectThreadsByProjectId[project.id] ?? [])
                    : (threadsByProjectId[project.id] ?? []);
                  const isProjectExpanded = isMetadataFilterActive
                    ? visibleProjectThreads.length > 0
                    : Boolean(expandedProjectIds[project.id]);
                  const matchingProjectTags = getMatchingTagValues(
                    project.tags,
                    normalizedSidebarSearchTerms
                  );

                  return (
                    <article className="sidebar-project-group" key={project.id}>
                      <div className="sidebar-project-card">
                        <button
                          className={`sidebar-project-button ${
                            selectedThread?.projectId === project.id ? "is-active" : ""
                          }`}
                          onClick={() => handleProjectToggle(project.id)}
                          type="button"
                        >
                          <div className="sidebar-project-heading">
                            <div className="sidebar-project-title-row">
                              <strong>{renderHighlightedText(project.displayName, normalizedSidebarSearchTerms)}</strong>
                              {project.isPinned ? (
                                <span className="sidebar-pin-badge">Pinned</span>
                              ) : null}
                              <span
                                className={`sidebar-status-badge ${
                                  project.projectStatus === "removed" ? "is-removed" : "is-historical"
                                }`}
                              >
                                {project.projectStatus}
                              </span>
                            </div>
                          </div>
                          {matchingProjectTags.length ? (
                            <div className="sidebar-search-tag-list">
                              {matchingProjectTags.map((tag) => (
                                <span className="sidebar-search-tag" key={tag}>
                                  {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="sidebar-item-meta">
                            <span>
                              {formatCountLabel(project.threadCount, "thread")} /{" "}
                              {formatCountLabel(project.turnCount, "turn")}
                            </span>
                            <span>{formatDateTime(project.lastActivityAt)}</span>
                          </div>
                        </button>
                        <div className="sidebar-project-actions">
                          <button
                            aria-label={`Manage ${project.displayName}`}
                            className="sidebar-project-action-button"
                            onClick={() => handleOpenProjectModal(project.id)}
                            type="button"
                          >
                            ...
                          </button>
                        </div>
                      </div>

                      {isProjectExpanded ? (
                        <div className="sidebar-project-thread-list">
                          {visibleProjectThreads.map((thread) => {
                            const matchingThreadTags = getMatchingTagValues(
                              thread.tags,
                              normalizedSidebarSearchTerms
                            );

                            return (
                              <button
                                className={`sidebar-project-thread-button ${
                                  selectedThreadId === thread.id ? "is-active" : ""
                                }`}
                                key={thread.id}
                                onClick={() => handleThreadSelect(thread.id)}
                                type="button"
                              >
                                <span className="sidebar-thread-row">
                                  <span className="sidebar-thread-title">
                                    {renderHighlightedText(thread.title, normalizedSidebarSearchTerms)}
                                  </span>
                                  {thread.isPinned ? (
                                    <span className="sidebar-pin-badge">Pinned</span>
                                  ) : null}
                                </span>
                                {matchingThreadTags.length ? (
                                  <span className="sidebar-thread-search-tags">
                                    {matchingThreadTags.map((tag) => (
                                      <span className="sidebar-search-tag" key={tag}>
                                        {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                                      </span>
                                    ))}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : historicalProjects.length ? null : (
              <p className="sidebar-empty-state">No historical projects match the current filters.</p>
            )}
          </section>
        ) : null}

        <section
          className={`sidebar-section sidebar-chats ${
            isChatsCollapsed ? "is-collapsed" : ""
          }`}
        >
          <div className="sidebar-section-header">
            <div>
              <h2>Chats</h2>
              <p>{formatFilteredCountLabel(matchingChatThreads.length, chatThreads.length, "chat")}</p>
            </div>
            <div className="sidebar-section-header-actions">
              <button
                aria-expanded={!isChatsCollapsed}
                className="sidebar-collapse-toggle"
                onClick={() => setIsChatsCollapsed((value) => !value)}
                type="button"
              >
                {isChatsCollapsed ? "Show" : "Hide"}
              </button>
            </div>
          </div>

          {!isChatsCollapsed && matchingChatThreads.length ? (
            <div className="sidebar-chat-list">
              {matchingChatThreads.map((thread) => {
                const matchingThreadTags = getMatchingTagValues(
                  thread.tags,
                  normalizedSidebarSearchTerms
                );

                return (
                  <button
                    key={thread.id}
                    className={`sidebar-chat-button ${
                      selectedThreadId === thread.id ? "is-active" : ""
                    }`}
                    onClick={() => handleThreadSelect(thread.id)}
                    type="button"
                  >
                    <div className="sidebar-chat-heading">
                      <strong>{renderHighlightedText(thread.title, normalizedSidebarSearchTerms)}</strong>
                      {thread.isPinned ? <span className="sidebar-pin-badge">Pinned</span> : null}
                    </div>
                    {matchingThreadTags.length ? (
                      <div className="sidebar-search-tag-list">
                        {matchingThreadTags.map((tag) => (
                          <span className="sidebar-search-tag" key={tag}>
                            {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="sidebar-item-meta">
                      <span>{formatCountLabel(thread.turnCount, "turn")}</span>
                      <span>{formatDateTime(thread.updatedAt ?? thread.lastSeenAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : !isChatsCollapsed ? (
            <p className="sidebar-empty-state">
              {isMetadataFilterActive
                ? "No chats match the current filters."
                : "Import Codex sessions to load chats."}
            </p>
          ) : null}
        </section>
        </div>
      </aside>

      <section className="workspace-shell">
        {loadError ? (
          <section className="card error-card compact-error">
            <h2>Load error</h2>
            <p className="muted">{loadError}</p>
          </section>
        ) : null}

        <div className="workspace-header">
          <div className="thread-header">
            <div className="thread-header-copy">
              <p className="workspace-kicker">Thread</p>
              <div className="management-heading-row">
                {selectedThread && isThreadTitleEditing ? (
                  <input
                    className="management-title-input"
                    onChange={(event) => setThreadTitleDraft(event.target.value)}
                    placeholder={selectedThread.sourceTitle}
                    type="text"
                    value={threadTitleDraft}
                  />
                ) : (
                  <h2>{selectedThread?.title ?? "Selected thread"}</h2>
                )}
                {selectedThread?.isPinned ? <span className="pin-pill">Pinned</span> : null}
              </div>
              {selectedThread && selectedThread.title !== selectedThread.sourceTitle ? (
                <p className="management-subcopy muted">{`Original: ${selectedThread.sourceTitle}`}</p>
              ) : null}
            </div>
            {selectedThread ? (
              <div className="thread-header-actions">
                <button
                  className={`secondary-button ${selectedThread.isPinned ? "is-active" : ""}`}
                  disabled={isSavingThreadOverride}
                  onClick={() => void handleToggleThreadPin()}
                  type="button"
                >
                  {selectedThread.isPinned ? "Unpin" : "Pin"}
                </button>
                {isThreadTitleEditing ? (
                  <>
                    <button
                      className="secondary-button"
                      disabled={isSavingThreadOverride || !canSaveThreadTitle}
                      onClick={() => void handleSaveThreadTitle()}
                      type="button"
                    >
                      Save
                    </button>
                    <button
                      className="secondary-button"
                      disabled={isSavingThreadOverride}
                      onClick={handleCancelThreadTitleEdit}
                      type="button"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="secondary-button"
                    disabled={isSavingThreadOverride}
                    onClick={() => setIsThreadTitleEditing(true)}
                    type="button"
                  >
                    Edit title
                  </button>
                )}
                {canResetThreadTitle ? (
                  <button
                    className="secondary-button"
                    disabled={isSavingThreadOverride}
                    onClick={() => void handleResetThreadTitle()}
                    type="button"
                  >
                    Use original
                  </button>
                ) : null}
                <button
                  className="secondary-button"
                  onClick={() => void handleOpenCodexThread(selectedThread.id)}
                  type="button"
                >
                  Open in Codex
                </button>
              </div>
            ) : null}
          </div>

          {selectedThread ? (
            <section className="local-metadata-panel">
              <div className="local-metadata-shell-header">
                <div>
                  <p className="management-kicker">Local metadata</p>
                  <p className="muted">Tags and memo are stored only in CodexCardFeed.</p>
                </div>
                <button
                  aria-expanded={!isThreadMetadataCollapsed}
                  className="secondary-button"
                  onClick={() => setIsThreadMetadataCollapsed((value) => !value)}
                  type="button"
                >
                  {isThreadMetadataCollapsed ? "Show" : "Hide"}
                </button>
              </div>

              {!isThreadMetadataCollapsed ? (
                <>
                  <div className="metadata-field">
                    <div className="metadata-section-header">
                      <label className="metadata-label" htmlFor="thread-tags-input">
                        Tags
                      </label>
                      <div className="metadata-section-actions">
                        <button
                          className="secondary-button"
                          disabled={isSavingThreadOverride || !canAddThreadTag}
                          onClick={() => void handleAddThreadTag()}
                          type="button"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    <div className="metadata-input-row">
                      <input
                        id="thread-tags-input"
                        className="metadata-input"
                        onChange={(event) => setThreadTagInputDraft(event.target.value)}
                        onKeyDown={handleThreadTagInputKeyDown}
                        placeholder="Add one tag and press Enter"
                        type="text"
                        value={threadTagInputDraft}
                      />
                    </div>
                    {threadTagsDraft.length ? (
                      <div className="tag-chip-list">
                        {threadTagsDraft.map((tag) => (
                          <span className="tag-chip" key={tag}>
                            <span>{tag}</span>
                            <button
                              aria-label={`Remove ${tag} tag`}
                              className="tag-chip-remove"
                              onClick={() => void handleRemoveThreadTag(tag)}
                              type="button"
                            >
                              x
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No local tags.</p>
                    )}
                  </div>

                  <div className="metadata-field">
                    <div className="metadata-section-header">
                      <label className="metadata-label" htmlFor="thread-notes-input">
                        Memo
                      </label>
                      <div className="metadata-section-actions">
                        <button
                          className="secondary-button"
                          disabled={isSavingThreadOverride || !canSaveThreadMemo}
                          onClick={() => void handleSaveThreadMemo()}
                          type="button"
                        >
                          Save memo
                        </button>
                        <button
                          className="secondary-button"
                          disabled={isSavingThreadOverride || !canSaveThreadMemo}
                          onClick={handleResetThreadMemoDraft}
                          type="button"
                        >
                          Revert memo
                        </button>
                        {canClearThreadMemo ? (
                          <button
                            className="secondary-button"
                            disabled={isSavingThreadOverride}
                            onClick={() => void handleClearThreadMemo()}
                            type="button"
                          >
                            Clear memo
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <textarea
                      id="thread-notes-input"
                      className="metadata-textarea"
                      onChange={(event) => setThreadNotesDraft(event.target.value)}
                      placeholder="Write a local memo for this thread."
                      rows={4}
                      value={threadNotesDraft}
                    />
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          <div className="panel-toolbar">
            <div className="panel-view-toggle" role="tablist" aria-label="Right panel view">
              <button
                aria-selected={rightPanelMode === "turns"}
                className={`panel-view-button ${
                  rightPanelMode === "turns" ? "is-active" : ""
                }`}
                onClick={() => setRightPanelMode("turns")}
                role="tab"
                type="button"
              >
                Turns
              </button>
              <button
                aria-selected={rightPanelMode === "questions"}
                className={`panel-view-button ${
                  rightPanelMode === "questions" ? "is-active" : ""
                }`}
                onClick={() => setRightPanelMode("questions")}
                role="tab"
                type="button"
              >
                Questions
              </button>
            </div>
            <p className="panel-toolbar-meta muted">
              {selectedThread
                ? rightPanelMode === "turns"
                  ? formatFilteredCountLabel(visibleTurns.length, turns.length, "turn")
                  : formatFilteredCountLabel(questionTurns.length, turns.length, "question")
                : "No thread selected"}
            </p>
          </div>
          <div className="panel-search-row">
            <input
              className="path-panel-input panel-search-input"
              disabled={!selectedThread}
              onChange={(event) => setThreadSearchQuery(event.target.value)}
              placeholder="Search this thread content, tags, memo"
              type="text"
              value={threadSearchQuery}
            />
            {isThreadSearchActive ? (
              <button
                className="sidebar-collapse-toggle"
                onClick={() => setThreadSearchQuery("")}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <section className="turn-list-panel">
          {visibleTurns.length ? (
            rightPanelMode === "turns" ? (
              <div className="selection-list">
                {visibleTurns.map((turn) => {
                  const turnHeading = getTurnHeading(turn);
                  const questionPreview = getQuestionPreview(turn);
                  const answerPreview = getAnswerPreview(turn);
                  const matchingTurnTags = getMatchingTagValues(
                    turn.tags,
                    normalizedThreadSearchTerms
                  );
                  const matchingMemoExcerpt = getMatchingMemoExcerpt(
                    turn.notes,
                    normalizedThreadSearchTerms
                  );
                  const questionMatchExcerpt = getAdditionalSearchExcerpt(
                    turn.searchUserText,
                    questionPreview,
                    normalizedThreadSearchTerms
                  );
                  const answerMatchExcerpt = getAdditionalSearchExcerpt(
                    turn.searchFinalAnswerText,
                    answerPreview,
                    normalizedThreadSearchTerms
                  );

                  return (
                    <button
                      data-turn-card-id={turn.id}
                      key={turn.id}
                      className={`selection-button ${
                        selectedTurnId === turn.id ? "is-active" : ""
                      }`}
                      onClick={() => handleOpenTurnDetail(turn.id)}
                      type="button"
                    >
                      <div className="selection-copy">
                        <div className="selection-topline">
                          <strong>{renderHighlightedText(turnHeading, normalizedThreadSearchTerms)}</strong>
                          <div className="selection-pills">
                            {turn.isPinned ? <span className="pin-pill">Pinned</span> : null}
                            <span
                              className={`status-pill ${
                                turn.status === "completed" ? "is-complete" : "is-open"
                              }`}
                            >
                              {turn.status}
                            </span>
                          </div>
                        </div>
                        <p className="turn-preview">
                          <span className="preview-label">Q</span>
                          <span>{renderHighlightedText(questionPreview, normalizedThreadSearchTerms)}</span>
                        </p>
                        {questionMatchExcerpt ? (
                          <p className="turn-preview turn-search-row">
                            <span className="preview-label">Q+</span>
                            <span>{renderHighlightedText(questionMatchExcerpt, normalizedThreadSearchTerms)}</span>
                          </p>
                        ) : null}
                        <p className="turn-preview">
                          <span className="preview-label">A</span>
                          <span>{renderHighlightedText(answerPreview, normalizedThreadSearchTerms)}</span>
                        </p>
                        {answerMatchExcerpt ? (
                          <p className="turn-preview turn-search-row">
                            <span className="preview-label">A+</span>
                            <span>{renderHighlightedText(answerMatchExcerpt, normalizedThreadSearchTerms)}</span>
                          </p>
                        ) : null}
                        {matchingTurnTags.length ? (
                          <p className="turn-preview turn-search-row">
                            <span className="preview-label">Tag</span>
                            <span className="turn-search-tag-list">
                              {matchingTurnTags.map((tag) => (
                                <span className="turn-search-tag" key={tag}>
                                  {renderHighlightedText(tag, normalizedThreadSearchTerms)}
                                </span>
                              ))}
                            </span>
                          </p>
                        ) : null}
                        {matchingMemoExcerpt ? (
                          <p className="turn-preview turn-search-row">
                            <span className="preview-label">Memo</span>
                            <span>{renderHighlightedText(matchingMemoExcerpt, normalizedThreadSearchTerms)}</span>
                          </p>
                        ) : null}
                      </div>
                      <div className="turn-card-actions">
                        <div className="selection-trailing">
                          <span className="mini-meta">
                            {formatCountLabel(turn.itemCount, "item")}
                          </span>
                          <span className="mini-meta token-meta">
                            {formatTokenLabel(turn.totalTokens)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="question-list">
                {questionTurns.map((turn) => {
                  const turnHeading = getTurnHeading(turn);
                  const questionPreview = getQuestionPreview(turn);
                  const matchingTurnTags = getMatchingTagValues(
                    turn.tags,
                    normalizedThreadSearchTerms
                  );
                  const matchingMemoExcerpt = getMatchingMemoExcerpt(
                    turn.notes,
                    normalizedThreadSearchTerms
                  );
                  const questionMatchExcerpt = getAdditionalSearchExcerpt(
                    turn.searchUserText,
                    questionPreview,
                    normalizedThreadSearchTerms
                  );
                  const answerMatchExcerpt = getAdditionalSearchExcerpt(
                    turn.searchFinalAnswerText,
                    "",
                    normalizedThreadSearchTerms
                  );

                  return (
                    <button
                      key={turn.id}
                      className={`selection-button question-card ${
                        selectedTurnId === turn.id ? "is-active" : ""
                      }`}
                      onClick={() => handleOpenTurnDetail(turn.id)}
                      type="button"
                    >
                      <div className="question-card-header">
                        <div className="question-card-heading">
                          <strong>{renderHighlightedText(turnHeading, normalizedThreadSearchTerms)}</strong>
                          {turn.isPinned ? <span className="pin-pill">Pinned</span> : null}
                        </div>
                        <span className="mini-meta">
                          {formatDateTime(turn.completedAt ?? turn.startedAt ?? turn.lastSeenAt)}
                        </span>
                      </div>
                      <p className="question-card-question">
                        {renderHighlightedText(questionPreview, normalizedThreadSearchTerms)}
                      </p>
                      {questionMatchExcerpt ? (
                        <p className="question-card-match">
                          <span className="preview-label">Q+</span>
                          <span>{renderHighlightedText(questionMatchExcerpt, normalizedThreadSearchTerms)}</span>
                        </p>
                      ) : null}
                      {answerMatchExcerpt ? (
                        <p className="question-card-match">
                          <span className="preview-label">A</span>
                          <span>{renderHighlightedText(answerMatchExcerpt, normalizedThreadSearchTerms)}</span>
                        </p>
                      ) : null}
                      {matchingTurnTags.length ? (
                        <p className="question-card-match">
                          <span className="preview-label">Tag</span>
                          <span className="turn-search-tag-list">
                            {matchingTurnTags.map((tag) => (
                              <span className="turn-search-tag" key={tag}>
                                {renderHighlightedText(tag, normalizedThreadSearchTerms)}
                              </span>
                            ))}
                          </span>
                        </p>
                      ) : null}
                      {matchingMemoExcerpt ? (
                        <p className="question-card-match">
                          <span className="preview-label">Memo</span>
                          <span>{renderHighlightedText(matchingMemoExcerpt, normalizedThreadSearchTerms)}</span>
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <p className="empty-state">
              {selectedThread
                ? rightPanelMode === "turns"
                  ? isThreadSearchActive
                    ? "No turns match the current search."
                    : "No turns were found for this thread."
                  : isThreadSearchActive
                    ? "No questions match the current search."
                    : "No questions were found for this thread."
                : "Choose a thread from the sidebar to load turn cards."}
            </p>
          )}
        </section>
      </section>

      {selectedProject ? (
        <div className="modal-overlay" onClick={handleCloseProjectModal} role="presentation">
          <section
            className="card modal-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="workspace-kicker">Project detail</p>
                <h2>{selectedProject.displayName}</h2>
                <p className="muted">Local project metadata and source details.</p>
              </div>
              <div className="modal-header-actions">
                <button
                  className="modal-close"
                  onClick={handleCloseProjectModal}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="modal-scroll">
              <div className="detail-body">
                <section className="detail-meta-panel">
                  <div className="detail-management-bar">
                    <div className="detail-management-copy">
                      <p className="management-kicker">Local project title</p>
                      {isProjectTitleEditing ? (
                        <input
                          className="management-title-input"
                          onChange={(event) => setProjectTitleDraft(event.target.value)}
                          placeholder={selectedProject.sourceDisplayName}
                          type="text"
                          value={projectTitleDraft}
                        />
                      ) : (
                        <strong className="detail-management-title">
                          {selectedProject.displayName}
                        </strong>
                      )}
                      {selectedProject.displayName !== selectedProject.sourceDisplayName ? (
                        <p className="management-subcopy muted">{`Original: ${selectedProject.sourceDisplayName}`}</p>
                      ) : (
                        <p className="management-subcopy muted">
                          No custom project title stored.
                        </p>
                      )}
                    </div>
                    <div className="detail-management-actions">
                      <button
                        className={`secondary-button ${selectedProject.isPinned ? "is-active" : ""}`}
                        disabled={isSavingProjectOverride}
                        onClick={() => void handleToggleProjectPin()}
                        type="button"
                      >
                        {selectedProject.isPinned ? "Unpin" : "Pin"}
                      </button>
                      {isProjectTitleEditing ? (
                        <>
                          <button
                            className="secondary-button"
                            disabled={isSavingProjectOverride || !canSaveProjectTitle}
                            onClick={() => void handleSaveProjectTitle()}
                            type="button"
                          >
                            Save
                          </button>
                          <button
                            className="secondary-button"
                            disabled={isSavingProjectOverride}
                            onClick={handleCancelProjectTitleEdit}
                            type="button"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary-button"
                          disabled={isSavingProjectOverride}
                          onClick={() => setIsProjectTitleEditing(true)}
                          type="button"
                        >
                          Edit title
                        </button>
                      )}
                      {canResetProjectTitle ? (
                        <button
                          className="secondary-button"
                          disabled={isSavingProjectOverride}
                          onClick={() => void handleResetProjectTitle()}
                          type="button"
                        >
                          Use original
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <section className="local-metadata-panel local-metadata-panel-detail">
                    <div className="local-metadata-shell-header">
                      <div>
                        <p className="management-kicker">Local metadata</p>
                        <p className="muted">Tags and memo are stored only in CodexCardFeed.</p>
                      </div>
                      <button
                        aria-expanded={!isProjectMetadataCollapsed}
                        className="secondary-button"
                        onClick={() => setIsProjectMetadataCollapsed((value) => !value)}
                        type="button"
                      >
                        {isProjectMetadataCollapsed ? "Show" : "Hide"}
                      </button>
                    </div>

                    {!isProjectMetadataCollapsed ? (
                      <>
                        <div className="metadata-field">
                          <div className="metadata-section-header">
                            <label className="metadata-label" htmlFor="project-tags-input">
                              Tags
                            </label>
                            <div className="metadata-section-actions">
                              <button
                                className="secondary-button"
                                disabled={isSavingProjectOverride || !canAddProjectTag}
                                onClick={() => void handleAddProjectTag()}
                                type="button"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                          <div className="metadata-input-row">
                            <input
                              id="project-tags-input"
                              className="metadata-input"
                              onChange={(event) => setProjectTagInputDraft(event.target.value)}
                              onKeyDown={handleProjectTagInputKeyDown}
                              placeholder="Add one tag and press Enter"
                              type="text"
                              value={projectTagInputDraft}
                            />
                          </div>
                          {projectTagsDraft.length ? (
                            <div className="tag-chip-list">
                              {projectTagsDraft.map((tag) => (
                                <span className="tag-chip" key={tag}>
                                  <span>{tag}</span>
                                  <button
                                    aria-label={`Remove ${tag} tag`}
                                    className="tag-chip-remove"
                                    onClick={() => void handleRemoveProjectTag(tag)}
                                    type="button"
                                  >
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="muted">No local tags.</p>
                          )}
                        </div>

                        <div className="metadata-field">
                          <div className="metadata-section-header">
                            <label className="metadata-label" htmlFor="project-notes-input">
                              Memo
                            </label>
                            <div className="metadata-section-actions">
                              <button
                                className="secondary-button"
                                disabled={isSavingProjectOverride || !canSaveProjectMemo}
                                onClick={() => void handleSaveProjectMemo()}
                                type="button"
                              >
                                Save memo
                              </button>
                              <button
                                className="secondary-button"
                                disabled={isSavingProjectOverride || !canSaveProjectMemo}
                                onClick={handleResetProjectMemoDraft}
                                type="button"
                              >
                                Revert memo
                              </button>
                              {canClearProjectMemo ? (
                                <button
                                  className="secondary-button"
                                  disabled={isSavingProjectOverride}
                                  onClick={() => void handleClearProjectMemo()}
                                  type="button"
                                >
                                  Clear memo
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <textarea
                            id="project-notes-input"
                            className="metadata-textarea"
                            onChange={(event) => setProjectNotesDraft(event.target.value)}
                            placeholder="Write a local memo for this project."
                            rows={4}
                            value={projectNotesDraft}
                          />
                        </div>
                      </>
                    ) : null}
                  </section>

                  <div className="detail-meta-header">
                    <strong>{selectedProject.displayName}</strong>
                    <div className="detail-meta-pills">
                      {selectedProject.isPinned ? <span className="pin-pill">Pinned</span> : null}
                      <span className="count-pill">
                        {formatCountLabel(selectedProject.threadCount, "thread")}
                      </span>
                      <span className="count-pill">
                        {formatCountLabel(selectedProject.turnCount, "turn")}
                      </span>
                    </div>
                  </div>

                  <dl className="detail-meta">
                    <div>
                      <dt>Status</dt>
                      <dd>{selectedProject.projectStatus}</dd>
                    </div>
                    <div>
                      <dt>Last activity</dt>
                      <dd>{formatDateTime(selectedProject.lastActivityAt)}</dd>
                    </div>
                    <div>
                      <dt>Source kind</dt>
                      <dd>{selectedProject.sourceKind}</dd>
                    </div>
                    <div>
                      <dt>Sessions</dt>
                      <dd>{formatCountLabel(selectedProject.sourceSessionPaths.length, "file")}</dd>
                    </div>
                    <div>
                      <dt>Source path</dt>
                      <dd>{selectedProject.sourcePath}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isDiagnosticsModalOpen ? (
        <div className="modal-overlay" onClick={handleCloseDiagnosticsModal} role="presentation">
          <section
            className="card modal-dialog diagnostics-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="workspace-kicker">Diagnostics</p>
                <h2>Data check and session diagnosis</h2>
                <p className="muted">
                  Inspect DB consistency and Codex session import tracking in one place.
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  className="secondary-button"
                  disabled={isIntegrityChecking}
                  onClick={() => void handleRunIntegrityCheck()}
                  type="button"
                >
                  {isIntegrityChecking ? "Checking..." : "Data check"}
                </button>
                <button
                  className="secondary-button"
                  disabled={isSessionDiagnosisRunning}
                  onClick={() => void handleRunSessionDiagnosis()}
                  type="button"
                >
                  {isSessionDiagnosisRunning ? "Diagnosing..." : "Session diagnosis"}
                </button>
                <button
                  className="modal-close"
                  onClick={handleCloseDiagnosticsModal}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="modal-scroll">
              <div className="detail-body">
                <section className="integrity-section">
                  <div className="integrity-section-header">
                    <div>
                      <strong>Data check</strong>
                      <p className="integrity-check-description">
                        {integrityReport
                          ? `Last checked ${formatDateTime(integrityReport.checkedAt)}`
                          : "Run a data check to inspect turn, thread, and token consistency."}
                      </p>
                    </div>
                  </div>

                  {integrityReport ? (
                    <dl className="integrity-summary-grid">
                      <div>
                        <dt>Total checks</dt>
                        <dd>{formatInteger(integrityReport.summary.totalChecks)}</dd>
                      </div>
                      <div>
                        <dt>Passed</dt>
                        <dd>{formatInteger(integrityReport.summary.passedChecks)}</dd>
                      </div>
                      <div>
                        <dt>Failed</dt>
                        <dd>{formatInteger(integrityReport.summary.failedChecks)}</dd>
                      </div>
                      <div>
                        <dt>New issues</dt>
                        <dd>{formatInteger(integrityReport.summary.newIssueCount)}</dd>
                      </div>
                      <div>
                        <dt>Errors</dt>
                        <dd>{formatInteger(integrityReport.summary.errorCount)}</dd>
                      </div>
                      <div>
                        <dt>Warnings</dt>
                        <dd>{formatInteger(integrityReport.summary.warningCount)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="empty-state integrity-empty-state">
                      No data check has been run yet.
                    </p>
                  )}
                </section>

                {integrityReport ? (
                  <section className="integrity-section">
                    <div className="integrity-section-header">
                      <strong>Issues</strong>
                      <span className="mini-meta">
                        {formatTotalAndNewLabel(
                          integrityFailedChecks.length,
                          integrityReport.summary.newIssueCount,
                          "check"
                        )}
                      </span>
                    </div>

                    {integrityFailedChecks.length ? (
                      <div className="integrity-check-list">
                        {integrityFailedChecks.map((check) => {
                          const hasNewReferences = check.newAffectedCount > 0;
                          const isReferenceListExpanded =
                            expandedIntegrityReferenceKeys[check.key] === true;
                          const visibleSampleRefs =
                            hasNewReferences && !isReferenceListExpanded
                              ? check.sampleRefs.slice(0, 5)
                              : check.sampleRefs;
                          const shouldShowReferenceToggle =
                            hasNewReferences && check.sampleRefs.length > 5;

                          return (
                            <article className="integrity-check-card" key={check.key}>
                              <div className="integrity-check-header">
                                <div>
                                  <strong>{check.label}</strong>
                                  <p className="integrity-check-description">
                                    {check.description}
                                  </p>
                                </div>
                                <div className="integrity-check-pills">
                                  <span
                                    className={`integrity-severity-pill ${
                                      check.severity === "error" ? "is-error" : "is-warning"
                                    }`}
                                  >
                                    {check.severity}
                                  </span>
                                  <span className="count-pill">
                                    {`Total ${formatInteger(check.affectedCount)}`}
                                  </span>
                                  <span className="count-pill count-pill-new">
                                    {`New ${formatInteger(check.newAffectedCount)}`}
                                  </span>
                                </div>
                              </div>
                              <p className="integrity-check-message">{check.message}</p>
                              {check.sampleRefs.length ? (
                                <div className="integrity-reference-block">
                                  <p className="mini-meta integrity-reference-label">
                                    {hasNewReferences
                                      ? `${formatCountLabel(
                                          check.newAffectedCount,
                                          "new reference"
                                        )} shown first`
                                      : "Sample references"}
                                  </p>
                                  <ul className="integrity-sample-list">
                                    {visibleSampleRefs.map((sampleRef) => (
                                      <li
                                        key={[
                                          check.key,
                                          sampleRef.label,
                                          sampleRef.threadId ?? "none",
                                          sampleRef.turnId ?? "none"
                                        ].join(":")}
                                      >
                                        {sampleRef.threadId ? (
                                          <button
                                            className={`integrity-sample-link ${
                                              sampleRef.isNew ? "is-new" : ""
                                            }`}
                                            onClick={() => handleOpenIntegritySample(sampleRef)}
                                            type="button"
                                          >
                                            {sampleRef.label}
                                          </button>
                                        ) : (
                                          <span
                                            className={
                                              sampleRef.isNew ? "integrity-sample-text is-new" : undefined
                                            }
                                          >
                                            {sampleRef.label}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                  {shouldShowReferenceToggle ? (
                                    <button
                                      className="detail-expand-toggle integrity-reference-toggle"
                                      onClick={() => handleIntegrityReferenceToggle(check.key)}
                                      type="button"
                                    >
                                      {isReferenceListExpanded
                                        ? "Show less"
                                        : `Show more (${formatInteger(
                                            check.sampleRefs.length - 5
                                          )})`}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="empty-state integrity-empty-state">
                        No integrity issues were detected.
                      </p>
                    )}
                  </section>
                ) : null}

                {integrityReport ? (
                  <section className="integrity-section">
                    <div className="integrity-section-header">
                      <strong>Passed checks</strong>
                      <span className="mini-meta">
                        {formatCountLabel(integrityPassedChecks.length, "check")}
                      </span>
                    </div>
                    <div className="integrity-pass-list">
                      {integrityPassedChecks.map((check) => (
                        <article className="integrity-pass-row" key={check.key}>
                          <strong>{check.label}</strong>
                          <p className="mini-meta">{check.message}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="diagnosis-section">
                  <div className="diagnosis-section-header">
                    <div>
                      <strong>Session diagnosis</strong>
                      <p className="diagnosis-issue-message">
                        {sessionDiagnosisReport
                          ? `Last checked ${formatDateTime(sessionDiagnosisReport.checkedAt)}`
                          : "Run a session diagnosis to detect import gaps and source tracking problems."}
                      </p>
                    </div>
                  </div>

                  {sessionDiagnosisReport ? (
                    <section className="diagnosis-summary-panel">
                      <dl className="diagnosis-summary-grid">
                        <div>
                          <dt>Current files</dt>
                          <dd>{formatInteger(sessionDiagnosisReport.summary.scannedFiles)}</dd>
                        </div>
                        <div>
                          <dt>Tracked files</dt>
                          <dd>{formatInteger(sessionDiagnosisReport.summary.trackedFiles)}</dd>
                        </div>
                        <div>
                          <dt>DB threads</dt>
                          <dd>{formatInteger(sessionDiagnosisReport.summary.dbThreads)}</dd>
                        </div>
                        <div>
                          <dt>Issues</dt>
                          <dd>{formatInteger(sessionDiagnosisReport.summary.totalIssueCount)}</dd>
                        </div>
                        <div>
                          <dt>New issues</dt>
                          <dd>{formatInteger(sessionDiagnosisReport.summary.newTotalIssueCount)}</dd>
                        </div>
                        <div>
                          <dt>Import gaps</dt>
                          <dd>{formatInteger(sessionDiagnosisReport.summary.importGapCount)}</dd>
                        </div>
                        <div>
                          <dt>Duplicates</dt>
                          <dd>{formatInteger(sessionDiagnosisReport.summary.duplicateCount)}</dd>
                        </div>
                      </dl>

                      <dl className="diagnosis-path-grid">
                        <div>
                          <dt>Codex source</dt>
                          <dd>{sessionDiagnosisReport.codexHome}</dd>
                        </div>
                        <div>
                          <dt>Sessions root</dt>
                          <dd>{sessionDiagnosisReport.sessionsRoot}</dd>
                        </div>
                      </dl>
                    </section>
                  ) : (
                    <p className="empty-state integrity-empty-state">
                      No session diagnosis has been run yet.
                    </p>
                  )}
                </section>

                {sessionDiagnosisReport ? (
                  <section className="diagnosis-section">
                    <div className="diagnosis-section-header">
                      <strong>Import gaps</strong>
                      <span className="mini-meta">
                        {formatTotalAndNewLabel(
                          sessionDiagnosisReport.importGaps.length,
                          sessionDiagnosisReport.summary.newImportGapCount,
                          "issue"
                        )}
                      </span>
                    </div>

                    {sessionDiagnosisReport.importGaps.length ? (
                      <div className="diagnosis-issue-list">
                        {sessionDiagnosisReport.importGaps.map((issue, issueIndex) => (
                          <article
                            className="diagnosis-issue-card"
                            key={`${issue.code}:${issue.sourcePath ?? issueIndex}`}
                          >
                            <div className="diagnosis-issue-header">
                              <div>
                                <strong>{issue.title}</strong>
                                <p className="diagnosis-issue-message">{issue.message}</p>
                              </div>
                              <div className="diagnosis-issue-pills">
                                <span
                                  className={`integrity-severity-pill ${
                                    issue.severity === "error" ? "is-error" : "is-warning"
                                  }`}
                                >
                                  {issue.severity}
                                </span>
                                <span className="diagnosis-action-pill">
                                  {formatSuggestedActionLabel(issue.suggestedAction)}
                                </span>
                              </div>
                            </div>
                            <dl className="diagnosis-meta-grid">
                              {issue.sourcePath ? (
                                <div>
                                  <dt>Source</dt>
                                  <dd>{issue.sourcePath}</dd>
                                </div>
                              ) : null}
                              {issue.parsedThreadId ? (
                                <div>
                                  <dt>Parsed</dt>
                                  <dd>{issue.parsedThreadId}</dd>
                                </div>
                              ) : null}
                              {issue.trackedThreadId ? (
                                <div>
                                  <dt>Tracked</dt>
                                  <dd>{issue.trackedThreadId}</dd>
                                </div>
                              ) : null}
                              {issue.trackedStatus ? (
                                <div>
                                  <dt>Status</dt>
                                  <dd>{issue.trackedStatus}</dd>
                                </div>
                              ) : null}
                              {issue.lastImportedAt ? (
                                <div>
                                  <dt>Imported</dt>
                                  <dd>{formatDateTime(issue.lastImportedAt)}</dd>
                                </div>
                              ) : null}
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state integrity-empty-state">
                        No import gaps were detected.
                      </p>
                    )}
                  </section>
                ) : null}

                {sessionDiagnosisReport ? (
                  <section className="diagnosis-section">
                    <div className="diagnosis-section-header">
                      <strong>Duplicate conflicts</strong>
                      <span className="mini-meta">
                        {formatTotalAndNewLabel(
                          sessionDiagnosisReport.duplicates.length,
                          sessionDiagnosisReport.summary.newDuplicateCount,
                          "issue"
                        )}
                      </span>
                    </div>

                    {sessionDiagnosisReport.duplicates.length ? (
                      <div className="diagnosis-issue-list">
                        {sessionDiagnosisReport.duplicates.map((issue, issueIndex) => (
                          <article
                            className="diagnosis-issue-card"
                            key={`${issue.code}:${issue.sourcePath ?? issueIndex}`}
                          >
                            <div className="diagnosis-issue-header">
                              <div>
                                <strong>{issue.title}</strong>
                                <p className="diagnosis-issue-message">{issue.message}</p>
                              </div>
                              <div className="diagnosis-issue-pills">
                                <span
                                  className={`integrity-severity-pill ${
                                    issue.severity === "error" ? "is-error" : "is-warning"
                                  }`}
                                >
                                  {issue.severity}
                                </span>
                                <span className="diagnosis-action-pill">
                                  {formatSuggestedActionLabel(issue.suggestedAction)}
                                </span>
                              </div>
                            </div>
                            <dl className="diagnosis-meta-grid">
                              {issue.sourcePath ? (
                                <div>
                                  <dt>Source</dt>
                                  <dd>{issue.sourcePath}</dd>
                                </div>
                              ) : null}
                              {issue.relatedThreadIds.length ? (
                                <div className="is-stacked">
                                  <dt>Threads</dt>
                                  <dd>
                                    <ul className="detail-query-list">
                                      {issue.relatedThreadIds.map((threadId) => (
                                        <li key={`${issue.code}:${threadId}`}>{threadId}</li>
                                      ))}
                                    </ul>
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state integrity-empty-state">
                        No duplicate DB conflicts were detected.
                      </p>
                    )}
                  </section>
                ) : null}

                {sessionDiagnosisReport ? (
                  <section className="diagnosis-section">
                    <div className="diagnosis-section-header">
                      <strong>Source problems</strong>
                      <span className="mini-meta">
                        {formatTotalAndNewLabel(
                          sessionDiagnosisReport.sourceProblems.length,
                          sessionDiagnosisReport.summary.newSourceProblemCount,
                          "issue"
                        )}
                      </span>
                    </div>

                    {sessionDiagnosisReport.sourceProblems.length ? (
                      <div className="diagnosis-issue-list">
                        {sessionDiagnosisReport.sourceProblems.map((issue, issueIndex) => (
                          <article
                            className="diagnosis-issue-card"
                            key={`${issue.code}:${issue.sourcePath ?? issueIndex}`}
                          >
                            <div className="diagnosis-issue-header">
                              <div>
                                <strong>{issue.title}</strong>
                                <p className="diagnosis-issue-message">{issue.message}</p>
                              </div>
                              <div className="diagnosis-issue-pills">
                                <span
                                  className={`integrity-severity-pill ${
                                    issue.severity === "error" ? "is-error" : "is-warning"
                                  }`}
                                >
                                  {issue.severity}
                                </span>
                                <span className="diagnosis-action-pill">
                                  {formatSuggestedActionLabel(issue.suggestedAction)}
                                </span>
                              </div>
                            </div>
                            <dl className="diagnosis-meta-grid">
                              {issue.sourcePath ? (
                                <div>
                                  <dt>Source</dt>
                                  <dd>{issue.sourcePath}</dd>
                                </div>
                              ) : null}
                              {issue.trackedThreadId ? (
                                <div>
                                  <dt>Tracked</dt>
                                  <dd>{issue.trackedThreadId}</dd>
                                </div>
                              ) : null}
                              {issue.trackedStatus ? (
                                <div>
                                  <dt>Status</dt>
                                  <dd>{issue.trackedStatus}</dd>
                                </div>
                              ) : null}
                              {issue.lastImportedAt ? (
                                <div>
                                  <dt>Imported</dt>
                                  <dd>{formatDateTime(issue.lastImportedAt)}</dd>
                                </div>
                              ) : null}
                              {issue.lastError ? (
                                <div>
                                  <dt>Last error</dt>
                                  <dd>{issue.lastError}</dd>
                                </div>
                              ) : null}
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state integrity-empty-state">
                        No source tracking problems were detected.
                      </p>
                    )}
                  </section>
                ) : null}

                {sessionDiagnosisReport ? (
                  <section className="diagnosis-section">
                    <div className="diagnosis-section-header">
                      <strong>Parse problems</strong>
                      <span className="mini-meta">
                        {formatTotalAndNewLabel(
                          sessionDiagnosisReport.parseProblems.length,
                          sessionDiagnosisReport.summary.newParseProblemCount,
                          "issue"
                        )}
                      </span>
                    </div>

                    {sessionDiagnosisReport.parseProblems.length ? (
                      <div className="diagnosis-issue-list">
                        {sessionDiagnosisReport.parseProblems.map((issue, issueIndex) => (
                          <article
                            className="diagnosis-issue-card"
                            key={`${issue.code}:${issue.sourcePath ?? issueIndex}`}
                          >
                            <div className="diagnosis-issue-header">
                              <div>
                                <strong>{issue.title}</strong>
                                <p className="diagnosis-issue-message">{issue.message}</p>
                              </div>
                              <div className="diagnosis-issue-pills">
                                <span
                                  className={`integrity-severity-pill ${
                                    issue.severity === "error" ? "is-error" : "is-warning"
                                  }`}
                                >
                                  {issue.severity}
                                </span>
                                <span className="diagnosis-action-pill">
                                  {formatSuggestedActionLabel(issue.suggestedAction)}
                                </span>
                              </div>
                            </div>
                            <dl className="diagnosis-meta-grid">
                              {issue.sourcePath ? (
                                <div>
                                  <dt>Source</dt>
                                  <dd>{issue.sourcePath}</dd>
                                </div>
                              ) : null}
                              {issue.trackedThreadId ? (
                                <div>
                                  <dt>Tracked</dt>
                                  <dd>{issue.trackedThreadId}</dd>
                                </div>
                              ) : null}
                              {issue.trackedStatus ? (
                                <div>
                                  <dt>Status</dt>
                                  <dd>{issue.trackedStatus}</dd>
                                </div>
                              ) : null}
                              {issue.lastError ? (
                                <div>
                                  <dt>Last error</dt>
                                  <dd>{issue.lastError}</dd>
                                </div>
                              ) : null}
                            </dl>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state integrity-empty-state">
                        No parse problems were detected.
                      </p>
                    )}
                  </section>
                ) : null}

                {sessionDiagnosisReport && sessionDiagnosisIssues.length === 0 ? (
                  <section className="diagnosis-section">
                    <div className="diagnosis-section-header">
                      <strong>Result</strong>
                    </div>
                    <p className="empty-state integrity-empty-state">
                      Current Codex source files and DB session tracking look consistent.
                    </p>
                  </section>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {isTurnModalOpen && selectedTurn ? (
        <div className="modal-overlay" onClick={handleCloseTurnModal} role="presentation">
          <section
            className="card modal-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="workspace-kicker">Turn detail</p>
                <h2>{selectedThread?.title ?? "Selected thread"}</h2>
                <p className="muted">
                  Original stored turn items and source metadata for {getTurnHeading(selectedTurn)}
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  className="modal-close"
                  onClick={handleCloseTurnModal}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="modal-scroll">
              <div className="detail-body">
                <section className="detail-meta-panel">
                  <div className="detail-management-bar">
                    <div className="detail-management-copy">
                      <p className="management-kicker">Local turn title</p>
                      {isTurnTitleEditing ? (
                        <input
                          className="management-title-input"
                          onChange={(event) => setTurnTitleDraft(event.target.value)}
                          placeholder="Leave blank to use the default turn heading"
                          type="text"
                          value={turnTitleDraft}
                        />
                      ) : (
                        <strong className="detail-management-title">
                          {selectedTurn.displayTitle ?? "Default turn heading"}
                        </strong>
                      )}
                      <p className="management-subcopy muted">
                        {selectedTurn.displayTitle
                          ? `Original heading: Turn ${selectedTurn.ordinal}`
                          : "No custom turn title stored."}
                      </p>
                    </div>
                    <div className="detail-management-actions">
                      <button
                        className={`secondary-button ${selectedTurn.isPinned ? "is-active" : ""}`}
                        disabled={isSavingTurnOverride}
                        onClick={() => void handleToggleTurnPin()}
                        type="button"
                      >
                        {selectedTurn.isPinned ? "Unpin" : "Pin"}
                      </button>
                      {isTurnTitleEditing ? (
                        <>
                          <button
                            className="secondary-button"
                            disabled={isSavingTurnOverride || !canSaveTurnTitle}
                            onClick={() => void handleSaveTurnTitle()}
                            type="button"
                          >
                            Save
                          </button>
                          <button
                            className="secondary-button"
                            disabled={isSavingTurnOverride}
                            onClick={handleCancelTurnTitleEdit}
                            type="button"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="secondary-button"
                          disabled={isSavingTurnOverride}
                          onClick={() => setIsTurnTitleEditing(true)}
                          type="button"
                        >
                          Edit title
                        </button>
                      )}
                      {canResetTurnTitle ? (
                        <button
                          className="secondary-button"
                          disabled={isSavingTurnOverride}
                          onClick={() => void handleResetTurnTitle()}
                          type="button"
                        >
                          Use default
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <section className="local-metadata-panel local-metadata-panel-detail">
                    <div className="local-metadata-shell-header">
                      <div>
                        <p className="management-kicker">Local metadata</p>
                        <p className="muted">Tags and memo are stored only in CodexCardFeed.</p>
                      </div>
                      <button
                        aria-expanded={!isTurnMetadataCollapsed}
                        className="secondary-button"
                        onClick={() => setIsTurnMetadataCollapsed((value) => !value)}
                        type="button"
                      >
                        {isTurnMetadataCollapsed ? "Show" : "Hide"}
                      </button>
                    </div>

                    {!isTurnMetadataCollapsed ? (
                      <>
                        <div className="metadata-field">
                          <div className="metadata-section-header">
                            <label className="metadata-label" htmlFor="turn-tags-input">
                              Tags
                            </label>
                            <div className="metadata-section-actions">
                              <button
                                className="secondary-button"
                                disabled={isSavingTurnOverride || !canAddTurnTag}
                                onClick={() => void handleAddTurnTag()}
                                type="button"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                          <div className="metadata-input-row">
                            <input
                              id="turn-tags-input"
                              className="metadata-input"
                              onChange={(event) => setTurnTagInputDraft(event.target.value)}
                              onKeyDown={handleTurnTagInputKeyDown}
                              placeholder="Add one tag and press Enter"
                              type="text"
                              value={turnTagInputDraft}
                            />
                          </div>
                          {turnTagsDraft.length ? (
                            <div className="tag-chip-list">
                              {turnTagsDraft.map((tag) => (
                                <span className="tag-chip" key={tag}>
                                  <span>{tag}</span>
                                  <button
                                    aria-label={`Remove ${tag} tag`}
                                    className="tag-chip-remove"
                                    onClick={() => void handleRemoveTurnTag(tag)}
                                    type="button"
                                  >
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="muted">No local tags.</p>
                          )}
                        </div>

                        <div className="metadata-field">
                          <div className="metadata-section-header">
                            <label className="metadata-label" htmlFor="turn-notes-input">
                              Memo
                            </label>
                            <div className="metadata-section-actions">
                              <button
                                className="secondary-button"
                                disabled={isSavingTurnOverride || !canSaveTurnMemo}
                                onClick={() => void handleSaveTurnMemo()}
                                type="button"
                              >
                                Save memo
                              </button>
                              <button
                                className="secondary-button"
                                disabled={isSavingTurnOverride || !canSaveTurnMemo}
                                onClick={handleResetTurnMemoDraft}
                                type="button"
                              >
                                Revert memo
                              </button>
                              {canClearTurnMemo ? (
                                <button
                                  className="secondary-button"
                                  disabled={isSavingTurnOverride}
                                  onClick={() => void handleClearTurnMemo()}
                                  type="button"
                                >
                                  Clear memo
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <textarea
                            id="turn-notes-input"
                            className="metadata-textarea"
                            onChange={(event) => setTurnNotesDraft(event.target.value)}
                            placeholder="Write a local memo for this turn."
                            rows={4}
                            value={turnNotesDraft}
                          />
                        </div>
                      </>
                    ) : null}
                  </section>

                  <div className="detail-meta-header">
                    <strong>{getTurnHeading(selectedTurn)}</strong>
                    <div className="detail-meta-pills">
                      {selectedTurn.isPinned ? <span className="pin-pill">Pinned</span> : null}
                      <span
                        className={`status-pill ${
                          selectedTurn.status === "completed" ? "is-complete" : "is-open"
                        }`}
                      >
                        {selectedTurn.status}
                      </span>
                      <span className="count-pill">
                        {formatTokenLabel(selectedTurn.totalTokens)}
                      </span>
                    </div>
                  </div>

                  <dl className="detail-meta">
                    <div>
                      <dt>Started</dt>
                      <dd>{formatDateTime(selectedTurn.startedAt)}</dd>
                    </div>
                    <div>
                      <dt>Completed</dt>
                      <dd>{formatDateTime(selectedTurn.completedAt)}</dd>
                    </div>
                    <div>
                      <dt>Turn ID</dt>
                      <dd>{selectedTurn.id}</dd>
                    </div>
                    <div>
                      <dt>Session</dt>
                      <dd>{selectedThread?.sourceSessionPath ?? "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Workspace</dt>
                      <dd>{selectedThread?.sourceCwd ?? "Projectless"}</dd>
                    </div>
                  </dl>

                  <dl className="token-grid">
                    <div>
                      <dt>Total</dt>
                      <dd>{formatInteger(selectedTurn.totalTokens)}</dd>
                    </div>
                    <div>
                      <dt>Input</dt>
                      <dd>{formatInteger(selectedTurn.inputTokens)}</dd>
                    </div>
                    <div>
                      <dt>Cached</dt>
                      <dd>{formatInteger(selectedTurn.cachedInputTokens)}</dd>
                    </div>
                    <div>
                      <dt>Output</dt>
                      <dd>{formatInteger(selectedTurn.outputTokens)}</dd>
                    </div>
                    <div>
                      <dt>Reasoning</dt>
                      <dd>{formatInteger(selectedTurn.reasoningOutputTokens)}</dd>
                    </div>
                    <div>
                      <dt>Events</dt>
                      <dd>{formatInteger(selectedTurn.tokenEventCount)}</dd>
                    </div>
                  </dl>
                </section>

                <div className="detail-items">
                  {primaryTurnItems.length ? (
                    primaryTurnItems.map((item, itemIndex) => {
                      const presentation = getItemPresentation(
                        primaryTurnItems,
                        itemIndex,
                        selectedTurn.reasoningOutputTokens
                      );
                      const isExpandableText = Boolean(
                        presentation.textContent &&
                          presentation.textContent.length > DETAIL_TEXT_PREVIEW_LENGTH
                      );
                      const isDetailItemExpanded = expandedDetailItemIds[item.id] === true;
                      const isMarkdownItem = isMarkdownDetailItem(item);

                      return (
                        <article className="detail-item" key={item.id}>
                          <div className="detail-item-header">
                            <div className="detail-item-badges">
                              <span className={`role-badge ${getRoleClassName(item.role)}`}>
                                {item.role}
                              </span>
                              <span
                                className={`item-type-badge ${presentation.categoryClassName}`}
                              >
                                {presentation.categoryLabel}
                              </span>
                              <span className="kind-badge">{item.kind}</span>
                            </div>
                            <time className="mini-meta">{formatDateTime(item.createdAt)}</time>
                          </div>

                          <div className="detail-item-content">
                            <p className="detail-item-summary">{presentation.summary}</p>
                            {presentation.meta.length ? (
                              <dl className="detail-item-meta">
                                {presentation.meta.map((entry) => (
                                  <div
                                    className={
                                      Array.isArray(entry.value) ? "is-stacked" : undefined
                                    }
                                    key={`${item.id}:${entry.label}`}
                                  >
                                    <dt>{entry.label}</dt>
                                    <dd>
                                      {Array.isArray(entry.value) ? (
                                        <ul className="detail-query-list">
                                          {entry.value.map((value) => (
                                            <li key={value}>{value}</li>
                                          ))}
                                        </ul>
                                      ) : (
                                        entry.value
                                      )}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            ) : null}
                            {presentation.textContent ? (
                              isMarkdownItem ? (
                                <div
                                  className={`detail-markdown ${
                                    isExpandableText && !isDetailItemExpanded
                                      ? "is-collapsed"
                                      : ""
                                  }`}
                                >
                                  <ReactMarkdown
                                    components={{
                                      a: ({ href, children }) => (
                                        <a
                                          className="detail-markdown-link"
                                          href={href}
                                          onClick={(event) => event.preventDefault()}
                                          title={href ?? undefined}
                                        >
                                          {children}
                                        </a>
                                      )
                                    }}
                                    remarkPlugins={[remarkGfm]}
                                  >
                                    {presentation.textContent}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <pre className="detail-text">{presentation.textContent}</pre>
                              )
                            ) : null}
                            {isExpandableText ? (
                              <button
                                className="detail-expand-toggle"
                                onClick={() => handleDetailItemToggle(item.id)}
                                type="button"
                              >
                                {isDetailItemExpanded ? "Show less" : "Show more"}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="empty-state detail-empty">
                      This turn has no stored user question or final answer yet.
                    </p>
                  )}
                </div>

                {additionalTurnItems.length ? (
                  <section className="detail-hidden-section">
                    <button
                      aria-expanded={isAdditionalItemsVisible}
                      className="detail-hidden-toggle"
                      onClick={() => setIsAdditionalItemsVisible((value) => !value)}
                      type="button"
                    >
                      {isAdditionalItemsVisible
                        ? `Hide other activity (${additionalTurnItems.length})`
                        : `Show other activity (${additionalTurnItems.length})`}
                    </button>

                    {isAdditionalItemsVisible ? (
                      <div className="detail-items detail-items-hidden">
                        {additionalTurnItems.map((item, itemIndex) => {
                          const presentation = getItemPresentation(
                            additionalTurnItems,
                            itemIndex,
                            selectedTurn.reasoningOutputTokens
                          );

                          return (
                            <article className="detail-item" key={item.id}>
                              <div className="detail-item-header">
                                <div className="detail-item-badges">
                                  <span className={`role-badge ${getRoleClassName(item.role)}`}>
                                    {item.role}
                                  </span>
                                  <span
                                    className={`item-type-badge ${presentation.categoryClassName}`}
                                  >
                                    {presentation.categoryLabel}
                                  </span>
                                  <span className="kind-badge">{item.kind}</span>
                                </div>
                                <time className="mini-meta">
                                  {formatDateTime(item.createdAt)}
                                </time>
                              </div>

                              <div className="detail-item-content">
                                <p className="detail-item-summary">{presentation.summary}</p>
                                {presentation.meta.length ? (
                                  <dl className="detail-item-meta">
                                    {presentation.meta.map((entry) => (
                                      <div
                                        className={
                                          Array.isArray(entry.value) ? "is-stacked" : undefined
                                        }
                                        key={`${item.id}:${entry.label}`}
                                      >
                                        <dt>{entry.label}</dt>
                                        <dd>
                                          {Array.isArray(entry.value) ? (
                                            <ul className="detail-query-list">
                                              {entry.value.map((value) => (
                                                <li key={value}>{value}</li>
                                              ))}
                                            </ul>
                                          ) : (
                                            entry.value
                                          )}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                ) : null}
                                {presentation.textContent ? (
                                  <pre className="detail-text">{presentation.textContent}</pre>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

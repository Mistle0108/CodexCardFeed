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

function formatInteger(value: number) {
  return integerFormatter.format(value);
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
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const [isTurnModalOpen, setIsTurnModalOpen] = useState(false);
  const [isIntegrityModalOpen, setIsIntegrityModalOpen] = useState(false);
  const [isSessionDiagnosisModalOpen, setIsSessionDiagnosisModalOpen] = useState(false);
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
  const [isAdditionalItemsVisible, setIsAdditionalItemsVisible] = useState(false);
  const [expandedDetailItemIds, setExpandedDetailItemIds] = useState<Record<string, boolean>>({});
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
  const [rightPanelMode, setRightPanelMode] = useState<"turns" | "questions">("turns");
  const [expandedProjectIds, setExpandedProjectIds] = useState(() =>
    readStoredExpandedProjectIds()
  );

  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const selectedTurn = turns.find((turn) => turn.id === selectedTurnId) ?? null;
  const questionTurns = turns;
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
  const sidebarProjects = projects.filter((project) => project.isSidebarProject);
  const historicalProjects = projects.filter((project) => !project.isSidebarProject);
  const allProjectIds = new Set(projects.map((project) => project.id));
  const projectThreads = threads.filter((thread) => allProjectIds.has(thread.projectId));
  const chatThreads = threads.filter((thread) => !allProjectIds.has(thread.projectId));
  const canSaveCodexHome = Boolean(
    shellInfo && codexHomeDraft.trim() && codexHomeDraft.trim() !== shellInfo.codexHome
  );
  const canSaveDatabasePath = Boolean(
    shellInfo &&
      databasePathDraft.trim() &&
      databasePathDraft.trim() !== shellInfo.databasePath
  );
  const threadsByProjectId = projectThreads.reduce<Record<string, ThreadListItem[]>>(
    (groups, thread) => {
      if (!groups[thread.projectId]) {
        groups[thread.projectId] = [];
      }

      groups[thread.projectId].push(thread);
      return groups;
    },
    {}
  );

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

    setProjects(nextProjects);
    setThreads(nextThreads);

    const nextThreadId = resolveSelectedId(nextThreads, preferredThreadId);
    const nextThread = nextThreads.find((thread) => thread.id === nextThreadId) ?? null;
    const nextProject = nextProjects.find((project) => project.id === nextThread?.projectId) ?? null;

    if (nextThread && nextProject) {
      setExpandedProjectIds((current) => ({
        ...current,
        [nextThread.projectId]: true
      }));

      if (!nextProject.isSidebarProject) {
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
    if (!isTurnModalOpen && !isIntegrityModalOpen && !isSessionDiagnosisModalOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsTurnModalOpen(false);
        setIsIntegrityModalOpen(false);
        setIsSessionDiagnosisModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isTurnModalOpen, isIntegrityModalOpen, isSessionDiagnosisModalOpen]);

  useEffect(() => {
    setIsAdditionalItemsVisible(false);
    setExpandedDetailItemIds({});
  }, [selectedTurnId, isTurnModalOpen]);

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

  function handleThreadSelect(threadId: string) {
    const nextThread = threads.find((thread) => thread.id === threadId) ?? null;
    const nextProject = projects.find((project) => project.id === nextThread?.projectId) ?? null;

    if (nextThread && nextProject && allProjectIds.has(nextThread.projectId)) {
      setExpandedProjectIds((current) => ({
        ...current,
        [nextThread.projectId]: true
      }));

      if (!nextProject.isSidebarProject) {
        setIsHistoricalCollapsed(false);
      }
    }

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

  function handleCloseIntegrityModal() {
    setIsIntegrityModalOpen(false);
  }

  function handleCloseSessionDiagnosisModal() {
    setIsSessionDiagnosisModalOpen(false);
  }

  function handleDetailItemToggle(itemId: string) {
    setExpandedDetailItemIds((current) => ({
      ...current,
      [itemId]: !current[itemId]
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
      setIsIntegrityModalOpen(true);
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
      setIsSessionDiagnosisModalOpen(true);
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

  return (
    <main className="app-shell">
      <aside className="sidebar-shell">
        <div className="sidebar-brand">
          <p className="sidebar-kicker">Codex conversation browser</p>
          <div className="sidebar-brand-row">
            <h1>CodexCardFeed</h1>
            <button
              aria-expanded={isPathPanelOpen}
              className="sidebar-utility-button"
              onClick={() => setIsPathPanelOpen((value) => !value)}
              type="button"
            >
              Paths
            </button>
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

        <section
          className={`sidebar-section sidebar-projects ${
            isProjectsCollapsed ? "is-collapsed" : ""
          }`}
        >
          <div className="sidebar-section-header">
            <div>
              <h2>Projects</h2>
              <p>{formatCountLabel(sidebarProjects.length, "project")}</p>
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
              {sidebarProjects.map((project) => (
                <article className="sidebar-project-group" key={project.id}>
                  <button
                    className={`sidebar-project-button ${
                      selectedThread?.projectId === project.id ? "is-active" : ""
                    }`}
                    onClick={() => handleProjectToggle(project.id)}
                    type="button"
                  >
                    <div className="sidebar-project-heading">
                      <strong>{project.displayName}</strong>
                      <span className="sidebar-project-caret" aria-hidden="true">
                        {expandedProjectIds[project.id] ? "▾" : "▸"}
                      </span>
                    </div>
                    <div className="sidebar-item-meta">
                      <span>
                        {formatCountLabel(project.threadCount, "thread")} /{" "}
                        {formatCountLabel(project.turnCount, "turn")}
                      </span>
                      <span>{formatDateTime(project.lastActivityAt)}</span>
                    </div>
                  </button>

                  {expandedProjectIds[project.id] ? (
                    <div className="sidebar-project-thread-list">
                      {(threadsByProjectId[project.id] ?? []).map((thread) => (
                        <button
                          className={`sidebar-project-thread-button ${
                            selectedThreadId === thread.id ? "is-active" : ""
                          }`}
                          key={thread.id}
                          onClick={() => handleThreadSelect(thread.id)}
                          type="button"
                        >
                          {thread.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : !isProjectsCollapsed ? (
            <p className="sidebar-empty-state">
              No current Codex projects were found.
            </p>
          ) : null}
        </section>

        {historicalProjects.length ? (
          <section
            className={`sidebar-section sidebar-historical ${
              isHistoricalCollapsed ? "is-collapsed" : ""
            }`}
          >
            <div className="sidebar-section-header">
              <div>
                <h2>Historical</h2>
                <p>{formatCountLabel(historicalProjects.length, "project")}</p>
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
                {historicalProjects.map((project) => (
                  <article className="sidebar-project-group" key={project.id}>
                    <button
                      className={`sidebar-project-button ${
                        selectedThread?.projectId === project.id ? "is-active" : ""
                      }`}
                      onClick={() => handleProjectToggle(project.id)}
                      type="button"
                    >
                      <div className="sidebar-project-heading">
                        <strong>{project.displayName}</strong>
                        <span className="sidebar-project-caret" aria-hidden="true">
                          {expandedProjectIds[project.id] ? "v" : ">"}
                        </span>
                      </div>
                      <div className="sidebar-item-meta">
                        <span>
                          {formatCountLabel(project.threadCount, "thread")} /{" "}
                          {formatCountLabel(project.turnCount, "turn")}
                        </span>
                        <span>{formatDateTime(project.lastActivityAt)}</span>
                      </div>
                    </button>

                    {expandedProjectIds[project.id] ? (
                      <div className="sidebar-project-thread-list">
                        {(threadsByProjectId[project.id] ?? []).map((thread) => (
                          <button
                            className={`sidebar-project-thread-button ${
                              selectedThreadId === thread.id ? "is-active" : ""
                            }`}
                            key={thread.id}
                            onClick={() => handleThreadSelect(thread.id)}
                            type="button"
                          >
                            {thread.title}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
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
              <p>{formatCountLabel(chatThreads.length, "chat")}</p>
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

          {!isChatsCollapsed && chatThreads.length ? (
            <div className="sidebar-chat-list">
              {chatThreads.map((thread) => (
                <button
                  key={thread.id}
                  className={`sidebar-chat-button ${
                    selectedThreadId === thread.id ? "is-active" : ""
                  }`}
                  onClick={() => handleThreadSelect(thread.id)}
                  type="button"
                >
                  <strong>{thread.title}</strong>
                  <div className="sidebar-item-meta">
                    <span>{formatCountLabel(thread.turnCount, "turn")}</span>
                    <span>{formatDateTime(thread.updatedAt ?? thread.lastSeenAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : !isChatsCollapsed ? (
            <p className="sidebar-empty-state">
              Import Codex sessions to load chats.
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
              <h2>{selectedThread?.title ?? "Selected thread"}</h2>
            </div>
            {selectedThread ? (
              <button
                className="secondary-button"
                onClick={() => void handleOpenCodexThread(selectedThread.id)}
                type="button"
              >
                Open in Codex
              </button>
            ) : null}
          </div>

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
            <div className="panel-toolbar-actions">
              <p className="panel-toolbar-meta muted">
                {selectedThread
                  ? rightPanelMode === "turns"
                    ? formatCountLabel(turns.length, "turn")
                    : formatCountLabel(questionTurns.length, "question")
                  : "No thread selected"}
              </p>
              {integrityReport ? (
                <p
                  className={`mini-meta integrity-toolbar-meta ${
                    integrityReport.summary.failedChecks ? "has-issues" : "is-clean"
                  }`}
                >
                  {integrityReport.summary.failedChecks
                    ? `${formatCountLabel(integrityReport.summary.failedChecks, "issue")} found`
                    : "No issues found"}
                </p>
              ) : null}
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
            </div>
          </div>
        </div>

        <section className="turn-list-panel">
          {turns.length ? (
            rightPanelMode === "turns" ? (
              <div className="selection-list">
                {turns.map((turn) => (
                  <article
                    key={turn.id}
                    className={`selection-button selection-card ${
                      selectedTurnId === turn.id ? "is-active" : ""
                    }`}
                  >
                    <div className="selection-copy">
                      <div className="selection-topline">
                        <strong>{getTurnHeading(turn)}</strong>
                        <span
                          className={`status-pill ${
                            turn.status === "completed" ? "is-complete" : "is-open"
                          }`}
                        >
                          {turn.status}
                        </span>
                      </div>
                      <p className="turn-preview">
                        <span className="preview-label">Q</span>
                        <span>{getQuestionPreview(turn)}</span>
                      </p>
                      <p className="turn-preview">
                        <span className="preview-label">A</span>
                        <span>{getAnswerPreview(turn)}</span>
                      </p>
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
                      <div className="turn-card-buttons">
                        <button
                          className="secondary-button"
                          onClick={() => handleOpenTurnDetail(turn.id)}
                          type="button"
                        >
                          View detail
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="question-list">
                {questionTurns.map((turn) => (
                  <button
                    key={turn.id}
                    className={`selection-button question-card ${
                      selectedTurnId === turn.id ? "is-active" : ""
                    }`}
                    onClick={() => handleOpenTurnDetail(turn.id)}
                    type="button"
                  >
                    <div className="question-card-header">
                      <strong>{`Turn ${turn.ordinal}`}</strong>
                      <span className="mini-meta">
                        {formatDateTime(turn.completedAt ?? turn.startedAt ?? turn.lastSeenAt)}
                      </span>
                    </div>
                    <p className="question-card-question">{getQuestionPreview(turn)}</p>
                  </button>
                ))}
              </div>
            )
          ) : (
            <p className="empty-state">
              {selectedThread
                ? rightPanelMode === "turns"
                  ? "No turns were found for this thread."
                  : "No questions were found for this thread."
                : "Choose a thread from the sidebar to load turn cards."}
            </p>
          )}
        </section>
      </section>

      {isSessionDiagnosisModalOpen && sessionDiagnosisReport ? (
        <div
          className="modal-overlay"
          onClick={handleCloseSessionDiagnosisModal}
          role="presentation"
        >
          <section
            className="card modal-dialog diagnosis-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="workspace-kicker">Session diagnosis</p>
                <h2>Session duplicate and import gap diagnosis</h2>
                <p className="muted">
                  Last checked {formatDateTime(sessionDiagnosisReport.checkedAt)}
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  className="secondary-button"
                  disabled={isSessionDiagnosisRunning}
                  onClick={() => void handleRunSessionDiagnosis()}
                  type="button"
                >
                  {isSessionDiagnosisRunning ? "Diagnosing..." : "Run again"}
                </button>
                <button
                  className="modal-close"
                  onClick={handleCloseSessionDiagnosisModal}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="modal-scroll">
              <div className="detail-body">
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

                <section className="diagnosis-section">
                  <div className="diagnosis-section-header">
                    <strong>Import gaps</strong>
                    <span className="mini-meta">
                      {formatCountLabel(sessionDiagnosisReport.importGaps.length, "issue")}
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

                <section className="diagnosis-section">
                  <div className="diagnosis-section-header">
                    <strong>Duplicate conflicts</strong>
                    <span className="mini-meta">
                      {formatCountLabel(sessionDiagnosisReport.duplicates.length, "issue")}
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

                <section className="diagnosis-section">
                  <div className="diagnosis-section-header">
                    <strong>Source problems</strong>
                    <span className="mini-meta">
                      {formatCountLabel(sessionDiagnosisReport.sourceProblems.length, "issue")}
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

                <section className="diagnosis-section">
                  <div className="diagnosis-section-header">
                    <strong>Parse problems</strong>
                    <span className="mini-meta">
                      {formatCountLabel(sessionDiagnosisReport.parseProblems.length, "issue")}
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

                {sessionDiagnosisIssues.length === 0 ? (
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

      {isIntegrityModalOpen && integrityReport ? (
        <div
          className="modal-overlay"
          onClick={handleCloseIntegrityModal}
          role="presentation"
        >
          <section
            className="card modal-dialog integrity-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="workspace-kicker">Data integrity</p>
                <h2>Database integrity check</h2>
                <p className="muted">
                  Last checked {formatDateTime(integrityReport.checkedAt)}
                </p>
              </div>
              <div className="modal-header-actions">
                <button
                  className="secondary-button"
                  disabled={isIntegrityChecking}
                  onClick={() => void handleRunIntegrityCheck()}
                  type="button"
                >
                  {isIntegrityChecking ? "Checking..." : "Run again"}
                </button>
                <button
                  className="modal-close"
                  onClick={handleCloseIntegrityModal}
                  type="button"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="modal-scroll">
              <div className="detail-body">
                <section className="integrity-summary-panel">
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
                      <dt>Errors</dt>
                      <dd>{formatInteger(integrityReport.summary.errorCount)}</dd>
                    </div>
                    <div>
                      <dt>Warnings</dt>
                      <dd>{formatInteger(integrityReport.summary.warningCount)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="integrity-section">
                  <div className="integrity-section-header">
                    <strong>Issues</strong>
                    <span className="mini-meta">
                      {formatCountLabel(integrityFailedChecks.length, "check")}
                    </span>
                  </div>

                  {integrityFailedChecks.length ? (
                    <div className="integrity-check-list">
                      {integrityFailedChecks.map((check) => (
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
                                {formatInteger(check.affectedCount)}
                              </span>
                            </div>
                          </div>
                          <p className="integrity-check-message">{check.message}</p>
                          {check.sampleRefs.length ? (
                            <ul className="integrity-sample-list">
                              {check.sampleRefs.map((sampleRef) => (
                                <li key={`${check.key}:${sampleRef}`}>{sampleRef}</li>
                              ))}
                            </ul>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state integrity-empty-state">
                      No integrity issues were detected.
                    </p>
                  )}
                </section>

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
                  <div className="detail-meta-header">
                    <strong>{getTurnHeading(selectedTurn)}</strong>
                    <div className="detail-meta-pills">
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

import { formatCountLabel, formatInteger } from "./app-utils";

export type DetailMetaEntry = {
  label: string;
  value: string | string[];
};

export type ItemPresentation = {
  categoryClassName: string;
  categoryLabel: string;
  summary: string;
  meta: DetailMetaEntry[];
  textContent: string | null;
};

export function clipLargeText(text: string, maxLength = 1600) {
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
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
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

export function getItemPresentation(
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
        ...(webSearchSummary?.status ? [{ label: "Status", value: webSearchSummary.status }] : []),
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

export function isPrimaryDetailItem(item: TurnItem) {
  return (
    (item.role === "user" && item.kind !== "message:bootstrap_context") ||
    item.kind === "message:final_answer"
  );
}

export function isMarkdownDetailItem(item: TurnItem) {
  return (
    (item.role === "user" && item.kind === "message") ||
    item.kind === "message:final_answer"
  );
}

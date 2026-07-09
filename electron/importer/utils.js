const crypto = require("node:crypto");
const path = require("node:path");

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePathForId(sourcePath) {
  const normalized = path.normalize(sourcePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function normalizePathList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => path.normalize(value));
}

function isPathInsideDirectory(candidatePath, directoryPath) {
  if (!candidatePath || !directoryPath) {
    return false;
  }

  const normalizedCandidate = normalizePathForId(candidatePath);
  const normalizedDirectory = normalizePathForId(directoryPath);

  return (
    normalizedCandidate === normalizedDirectory ||
    normalizedCandidate.startsWith(`${normalizedDirectory}${path.sep}`)
  );
}

function toIsoFromUnixSeconds(value) {
  if (typeof value !== "number") {
    return null;
  }

  return new Date(value * 1000).toISOString();
}

function extractTextFromMessage(payload) {
  if (Array.isArray(payload.content)) {
    return payload.content
      .map((part) => {
        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  if (typeof payload.text === "string") {
    return payload.text.trim();
  }

  return "";
}

function clipSnippet(text, maxLength = 240) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function isBootstrapUserMessage(text) {
  return text.trimStart().startsWith("# AGENTS.md instructions");
}

function getMessageKind(role, phase, textContent) {
  if (role === "user" && isBootstrapUserMessage(textContent)) {
    return "message:bootstrap_context";
  }

  return phase ? `message:${phase}` : "message";
}

function buildReasoningPayload(payload) {
  const summary = Array.isArray(payload.summary) ? payload.summary : [];
  const encryptedContent =
    typeof payload.encrypted_content === "string" ? payload.encrypted_content : "";

  return {
    summaryCount: summary.length,
    hasContent: payload.content !== null && payload.content !== undefined,
    encryptedLength: encryptedContent.length
  };
}

function createFallbackPreviewSnippet(text, maxLength = 240) {
  if (typeof text !== "string" || isBootstrapUserMessage(text)) {
    return "";
  }

  return clipSnippet(text, maxLength);
}

function compareNullableIso(left, right) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left < right ? -1 : 1;
}

function pickEarlierIso(currentValue, nextValue) {
  if (!currentValue) {
    return nextValue ?? null;
  }

  if (!nextValue) {
    return currentValue;
  }

  return nextValue < currentValue ? nextValue : currentValue;
}

function pickLaterIso(currentValue, nextValue) {
  if (!currentValue) {
    return nextValue ?? null;
  }

  if (!nextValue) {
    return currentValue;
  }

  return nextValue > currentValue ? nextValue : currentValue;
}

function pickPreferredText(currentValue, nextValue) {
  const currentText = currentValue ?? "";
  const nextText = nextValue ?? "";

  if (!currentText) {
    return nextText;
  }

  if (!nextText) {
    return currentText;
  }

  return nextText.length > currentText.length ? nextText : currentText;
}

function buildTurnContentHash(items) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        items.map((item) => ({
          role: item.role,
          kind: item.kind,
          textContent: item.textContent
        }))
      )
    )
    .digest("hex");
}

function createEmptyTokenUsage() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    tokenEventCount: 0
  };
}

function normalizeTokenUsage(usage) {
  if (!usage || typeof usage !== "object") {
    return null;
  }

  return {
    inputTokens: Number(usage.input_tokens ?? 0),
    cachedInputTokens: Number(usage.cached_input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    reasoningOutputTokens: Number(usage.reasoning_output_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? 0),
    tokenEventCount: 1
  };
}

function summarizeTokenEvents(tokenEvents) {
  const usage = createEmptyTokenUsage();

  for (const tokenEvent of tokenEvents) {
    usage.inputTokens += tokenEvent.inputTokens;
    usage.cachedInputTokens += tokenEvent.cachedInputTokens;
    usage.outputTokens += tokenEvent.outputTokens;
    usage.reasoningOutputTokens += tokenEvent.reasoningOutputTokens;
    usage.totalTokens += tokenEvent.totalTokens;
    usage.tokenEventCount += 1;
  }

  return usage;
}

module.exports = {
  isRecord,
  isNonEmptyString,
  normalizePathForId,
  normalizePathList,
  isPathInsideDirectory,
  toIsoFromUnixSeconds,
  extractTextFromMessage,
  clipSnippet,
  isBootstrapUserMessage,
  getMessageKind,
  buildReasoningPayload,
  createFallbackPreviewSnippet,
  compareNullableIso,
  pickEarlierIso,
  pickLaterIso,
  pickPreferredText,
  buildTurnContentHash,
  createEmptyTokenUsage,
  normalizeTokenUsage,
  summarizeTokenEvents
};

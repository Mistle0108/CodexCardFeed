const path = require("node:path");
const {
  compareNullableIso,
  createFallbackPreviewSnippet,
  pickEarlierIso,
  pickLaterIso,
  pickPreferredText,
  buildTurnContentHash,
  summarizeTokenEvents
} = require("./utils");

function mergeTurnSnapshots(turns, threadId) {
  const turnsById = new Map();

  for (const turn of turns) {
    if (!turnsById.has(turn.id)) {
      turnsById.set(turn.id, {
        id: turn.id,
        threadId,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
        status: turn.status,
        modelName: turn.modelName ?? null,
        reasoningEffort: turn.reasoningEffort ?? null,
        firstUserSnippet: turn.firstUserSnippet,
        lastSeenAt: turn.lastSeenAt,
        items: new Map(turn.items.map((item) => [item.id, { ...item }])),
        tokenEvents: new Map(turn.tokenEvents.map((tokenEvent) => [tokenEvent.id, { ...tokenEvent }]))
      });
      continue;
    }

    const mergedTurn = turnsById.get(turn.id);
    mergedTurn.startedAt = pickEarlierIso(mergedTurn.startedAt, turn.startedAt);
    mergedTurn.completedAt = pickLaterIso(mergedTurn.completedAt, turn.completedAt);
    mergedTurn.status =
      mergedTurn.completedAt || turn.status === "completed"
        ? "completed"
        : mergedTurn.status;
    mergedTurn.modelName = pickPreferredText(mergedTurn.modelName, turn.modelName);
    mergedTurn.reasoningEffort = pickPreferredText(
      mergedTurn.reasoningEffort,
      turn.reasoningEffort
    );
    mergedTurn.firstUserSnippet = pickPreferredText(
      mergedTurn.firstUserSnippet,
      turn.firstUserSnippet
    );
    mergedTurn.lastSeenAt = pickLaterIso(mergedTurn.lastSeenAt, turn.lastSeenAt);

    for (const item of turn.items) {
      if (!mergedTurn.items.has(item.id)) {
        mergedTurn.items.set(item.id, { ...item });
        continue;
      }

      const mergedItem = mergedTurn.items.get(item.id);
      mergedItem.ordinal = Math.min(mergedItem.ordinal, item.ordinal);
      mergedItem.textContent = pickPreferredText(
        mergedItem.textContent,
        item.textContent
      );
      mergedItem.rawJson = pickPreferredText(mergedItem.rawJson, item.rawJson);
      mergedItem.createdAt = pickEarlierIso(mergedItem.createdAt, item.createdAt);
    }

    for (const tokenEvent of turn.tokenEvents) {
      if (!mergedTurn.tokenEvents.has(tokenEvent.id)) {
        mergedTurn.tokenEvents.set(tokenEvent.id, { ...tokenEvent });
      }
    }
  }

  return [...turnsById.values()]
    .map((turn) => {
      const items = [...turn.items.values()]
        .sort((left, right) => {
          if (left.ordinal !== right.ordinal) {
            return left.ordinal - right.ordinal;
          }

          const createdAtOrder = compareNullableIso(left.createdAt, right.createdAt);

          if (createdAtOrder !== 0) {
            return createdAtOrder;
          }

          return left.id.localeCompare(right.id);
        })
        .map((item, index) => ({
          ...item,
          ordinal: index + 1
        }));

      let firstUserSnippet = turn.firstUserSnippet;

      if (!firstUserSnippet) {
        for (const item of items) {
          if (item.role !== "user") {
            continue;
          }

          firstUserSnippet = createFallbackPreviewSnippet(item.textContent ?? "");

          if (firstUserSnippet) {
            break;
          }
        }
      }

      const tokenEvents = [...turn.tokenEvents.values()].sort((left, right) => {
        const createdAtOrder = compareNullableIso(left.createdAt, right.createdAt);

        if (createdAtOrder !== 0) {
          return createdAtOrder;
        }

        return left.id.localeCompare(right.id);
      });

      return {
        id: turn.id,
        threadId,
        ordinal: 0,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
        status: turn.completedAt || turn.status === "completed" ? "completed" : "in_progress",
        modelName: turn.modelName ?? null,
        reasoningEffort: turn.reasoningEffort ?? null,
        firstUserSnippet,
        contentHash: buildTurnContentHash(items),
        lastSeenAt: turn.lastSeenAt,
        tokenUsage: summarizeTokenEvents(tokenEvents),
        tokenEvents,
        items
      };
    })
    .sort((left, right) => {
      const startedAtOrder = compareNullableIso(left.startedAt, right.startedAt);

      if (startedAtOrder !== 0) {
        return startedAtOrder;
      }

      const completedAtOrder = compareNullableIso(left.completedAt, right.completedAt);

      if (completedAtOrder !== 0) {
        return completedAtOrder;
      }

      const lastSeenOrder = compareNullableIso(left.lastSeenAt, right.lastSeenAt);

      if (lastSeenOrder !== 0) {
        return lastSeenOrder;
      }

      return left.id.localeCompare(right.id);
    })
    .map((turn, index) => ({
      ...turn,
      ordinal: index + 1
    }));
}

function mergeThreadSnapshots(parsedSessions) {
  const preferredProject =
    parsedSessions.find((session) => session.project.sourceKind === "workspace")?.project ??
    parsedSessions[0].project;
  const latestSnapshot = parsedSessions.reduce((best, current) => {
    if (!best) {
      return current;
    }

    const bestActivity =
      best.thread.updatedAt ?? best.thread.lastSeenAt ?? best.thread.createdAt;
    const currentActivity =
      current.thread.updatedAt ?? current.thread.lastSeenAt ?? current.thread.createdAt;

    return compareNullableIso(bestActivity, currentActivity) < 0 ? current : best;
  }, null);
  const turns = mergeTurnSnapshots(
    parsedSessions.flatMap((session) => session.turns),
    latestSnapshot.thread.id
  );
  const preview =
    turns.find((turn) => turn.firstUserSnippet)?.firstUserSnippet ??
    latestSnapshot.thread.preview;

  return {
    project: preferredProject,
    thread: {
      id: latestSnapshot.thread.id,
      projectId: preferredProject.projectId,
      sourceCwd:
        latestSnapshot.thread.sourceCwd ??
        parsedSessions.find((session) => session.thread.sourceCwd)?.thread.sourceCwd ??
        null,
      sourceSessionPath: latestSnapshot.thread.sourceSessionPath,
      sourceKind: latestSnapshot.thread.sourceKind,
      title:
        latestSnapshot.thread.title ||
        preview ||
        path.basename(latestSnapshot.thread.sourceSessionPath, ".jsonl"),
      preview,
      createdAt: parsedSessions.reduce(
        (value, session) => pickEarlierIso(value, session.thread.createdAt),
        null
      ),
      updatedAt: parsedSessions.reduce(
        (value, session) => pickLaterIso(value, session.thread.updatedAt),
        null
      ),
      lastSeenAt: parsedSessions.reduce(
        (value, session) => pickLaterIso(value, session.thread.lastSeenAt),
        null
      )
    },
    turns
  };
}

module.exports = {
  mergeTurnSnapshots,
  mergeThreadSnapshots
};

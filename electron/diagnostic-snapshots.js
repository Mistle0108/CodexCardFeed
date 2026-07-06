const SNAPSHOT_VERSION = 1;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey)
    );

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeRefs(refs) {
  if (!Array.isArray(refs)) {
    return [];
  }

  return Array.from(
    new Set(refs.filter((entry) => isNonEmptyString(entry)).map((entry) => entry.trim()))
  ).sort();
}

function normalizeGroups(groups) {
  if (!groups || typeof groups !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(groups)
      .filter(([groupKey]) => isNonEmptyString(groupKey))
      .map(([groupKey, refs]) => [groupKey, normalizeRefs(refs)])
  );
}

function readSnapshot(database, snapshotKey) {
  const row = database
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(snapshotKey);

  if (!row || !isNonEmptyString(row.value)) {
    return null;
  }

  try {
    const parsed = JSON.parse(row.value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      version:
        typeof parsed.version === "number" ? parsed.version : SNAPSHOT_VERSION,
      groups: normalizeGroups(parsed.groups)
    };
  } catch {
    return null;
  }
}

function writeSnapshot(database, snapshotKey, groups) {
  const payload = {
    version: SNAPSHOT_VERSION,
    updatedAt: new Date().toISOString(),
    groups: normalizeGroups(groups)
  };

  database
    .prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(snapshotKey, JSON.stringify(payload));
}

function compareAndStoreSnapshot(database, snapshotKey, currentGroups) {
  const normalizedCurrentGroups = normalizeGroups(currentGroups);
  const previousSnapshot = readSnapshot(database, snapshotKey);
  const hasBaseline = Boolean(previousSnapshot);
  const newCounts = {};
  const newRefs = {};
  let totalNewCount = 0;

  for (const [groupKey, refs] of Object.entries(normalizedCurrentGroups)) {
    const previousRefs = hasBaseline ? previousSnapshot.groups[groupKey] ?? [] : [];
    const previousRefSet = new Set(previousRefs);
    const nextNewRefs = [];
    let newCount = 0;

    for (const ref of refs) {
      if (!previousRefSet.has(ref)) {
        newCount += 1;
        nextNewRefs.push(ref);
      }
    }

    newCounts[groupKey] = newCount;
    newRefs[groupKey] = nextNewRefs;
    totalNewCount += newCount;
  }

  writeSnapshot(database, snapshotKey, normalizedCurrentGroups);

  return {
    hasBaseline,
    newCounts,
    newRefs,
    totalNewCount
  };
}

module.exports = {
  compareAndStoreSnapshot,
  stableStringify
};

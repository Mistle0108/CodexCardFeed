const SEARCH_INDEX_VERSION = "1";
const DEFAULT_SEARCH_LIMIT = 100;
const MAX_SEARCH_LIMIT = 100;

const SEARCH_DOCUMENT_SELECT = `
  SELECT
    turns.id AS turn_id,
    COALESCE((
      SELECT group_concat(items.text_content, char(10) || char(10))
      FROM items
      WHERE items.turn_id = turns.id
        AND items.role = 'user'
        AND items.kind <> 'message:bootstrap_context'
        AND COALESCE(items.text_content, '') <> ''
      ORDER BY items.ordinal ASC
    ), '') AS user_text,
    COALESCE((
      SELECT group_concat(items.text_content, char(10) || char(10))
      FROM items
      WHERE items.turn_id = turns.id
        AND items.role = 'assistant'
        AND items.kind = 'message:final_answer'
        AND COALESCE(items.text_content, '') <> ''
      ORDER BY items.ordinal ASC
    ), '') AS final_answer_text,
    COALESCE(turn_overrides.display_title, '') AS title_text,
    COALESCE((
      SELECT group_concat(value, char(10))
      FROM json_each(
        CASE
          WHEN json_valid(turn_overrides.tags_json) THEN turn_overrides.tags_json
          ELSE '[]'
        END
      )
    ), '') AS tags_text,
    COALESCE(turn_overrides.notes, '') AS notes_text
  FROM turns
  LEFT JOIN turn_overrides
    ON turn_overrides.turn_id = turns.id
`;

function createTurnSearchSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS turn_search_documents (
      turn_id TEXT PRIMARY KEY,
      user_text TEXT NOT NULL DEFAULT '',
      final_answer_text TEXT NOT NULL DEFAULT '',
      title_text TEXT NOT NULL DEFAULT '',
      tags_text TEXT NOT NULL DEFAULT '',
      notes_text TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE CASCADE
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS turn_search_index USING fts5(
      user_text,
      final_answer_text,
      title_text,
      tags_text,
      notes_text,
      content='turn_search_documents',
      content_rowid='rowid',
      tokenize='trigram'
    );

    CREATE TRIGGER IF NOT EXISTS turn_search_documents_ai
    AFTER INSERT ON turn_search_documents
    BEGIN
      INSERT INTO turn_search_index(
        rowid,
        user_text,
        final_answer_text,
        title_text,
        tags_text,
        notes_text
      )
      VALUES (
        new.rowid,
        new.user_text,
        new.final_answer_text,
        new.title_text,
        new.tags_text,
        new.notes_text
      );
    END;

    CREATE TRIGGER IF NOT EXISTS turn_search_documents_ad
    AFTER DELETE ON turn_search_documents
    BEGIN
      INSERT INTO turn_search_index(
        turn_search_index,
        rowid,
        user_text,
        final_answer_text,
        title_text,
        tags_text,
        notes_text
      )
      VALUES (
        'delete',
        old.rowid,
        old.user_text,
        old.final_answer_text,
        old.title_text,
        old.tags_text,
        old.notes_text
      );
    END;

    CREATE TRIGGER IF NOT EXISTS turn_search_documents_au
    AFTER UPDATE ON turn_search_documents
    BEGIN
      INSERT INTO turn_search_index(
        turn_search_index,
        rowid,
        user_text,
        final_answer_text,
        title_text,
        tags_text,
        notes_text
      )
      VALUES (
        'delete',
        old.rowid,
        old.user_text,
        old.final_answer_text,
        old.title_text,
        old.tags_text,
        old.notes_text
      );

      INSERT INTO turn_search_index(
        rowid,
        user_text,
        final_answer_text,
        title_text,
        tags_text,
        notes_text
      )
      VALUES (
        new.rowid,
        new.user_text,
        new.final_answer_text,
        new.title_text,
        new.tags_text,
        new.notes_text
      );
    END;
  `);
}

function setSearchMetaValue(database, key, value) {
  database
    .prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, value);
}

function upsertTurnSearchDocuments(database, whereClause = "", ...parameters) {
  database
    .prepare(`
      INSERT INTO turn_search_documents (
        turn_id,
        user_text,
        final_answer_text,
        title_text,
        tags_text,
        notes_text
      )
      ${SEARCH_DOCUMENT_SELECT}
      ${whereClause}
      ON CONFLICT(turn_id) DO UPDATE SET
        user_text = excluded.user_text,
        final_answer_text = excluded.final_answer_text,
        title_text = excluded.title_text,
        tags_text = excluded.tags_text,
        notes_text = excluded.notes_text
    `)
    .run(...parameters);
}

function rebuildTurnSearchIndex(database) {
  database.exec("DELETE FROM turn_search_documents");
  upsertTurnSearchDocuments(database);
  database.exec("INSERT INTO turn_search_index(turn_search_index) VALUES('optimize')");
  setSearchMetaValue(database, "turn_search_index_version", SEARCH_INDEX_VERSION);
  setSearchMetaValue(database, "turn_search_index_rebuilt_at", new Date().toISOString());
}

function ensureTurnSearchIndex(database) {
  const version = database
    .prepare("SELECT value FROM app_meta WHERE key = 'turn_search_index_version'")
    .get()?.value;
  const turnCount = Number(database.prepare("SELECT COUNT(*) AS count FROM turns").get()?.count ?? 0);
  const documentCount = Number(
    database.prepare("SELECT COUNT(*) AS count FROM turn_search_documents").get()?.count ?? 0
  );

  if (version === SEARCH_INDEX_VERSION && turnCount === documentCount) {
    return false;
  }

  database.exec("BEGIN");

  try {
    rebuildTurnSearchIndex(database);
    database.exec("COMMIT");
    return true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function refreshTurnSearchDocument(database, turnId) {
  upsertTurnSearchDocuments(database, "WHERE turns.id = ?", turnId);
}

function refreshThreadSearchDocuments(database, threadId) {
  upsertTurnSearchDocuments(database, "WHERE turns.thread_id = ?", threadId);
}

function normalizeSearchQuery(query) {
  if (typeof query !== "string") {
    throw new Error("Search query must be a string.");
  }

  return query.replace(/\s+/g, " ").trim().slice(0, 500);
}

function normalizeSearchPageOptions(options = {}) {
  const requestedLimit = Number.parseInt(options.limit, 10);
  const requestedOffset = Number.parseInt(options.offset, 10);

  return {
    limit: Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_SEARCH_LIMIT)
      : DEFAULT_SEARCH_LIMIT,
    offset: Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0
  };
}

function quoteFtsQuery(query) {
  return `"${query.replace(/"/g, '""')}"`;
}

function parseTags(tagsJson) {
  try {
    const parsed = JSON.parse(tagsJson ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function createMatchExcerpt(text, query, maxLength = 220) {
  const normalized = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";

  if (!normalized) {
    return "";
  }

  const matchIndex = normalized.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());

  if (matchIndex < 0) {
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
  }

  const start = Math.max(0, matchIndex - 70);
  const end = Math.min(normalized.length, start + maxLength);
  return `${start > 0 ? "..." : ""}${normalized.slice(start, end)}${
    end < normalized.length ? "..." : ""
  }`;
}

function mapSearchResult(row, query) {
  const searchableFields = [
    ["question", "Question", row.user_text],
    ["answer", "Final answer", row.final_answer_text],
    ["title", "Turn title", row.title_text],
    ["tags", "Tags", row.tags_text],
    ["memo", "Memo", row.notes_text]
  ];
  const normalizedQuery = query.toLocaleLowerCase();
  const matches = searchableFields
    .filter(([, , value]) => value.toLocaleLowerCase().includes(normalizedQuery))
    .map(([field, label, value]) => ({
      field,
      label,
      snippet: createMatchExcerpt(value, query)
    }));

  return {
    turnId: row.turn_id,
    threadId: row.thread_id,
    projectId: row.project_id ?? null,
    projectName: row.project_name ?? null,
    threadTitle: row.thread_title,
    turnOrdinal: Number(row.turn_ordinal),
    turnTitle: row.title_text || null,
    tags: parseTags(row.tags_json),
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    matches
  };
}

const SEARCH_RESULT_SELECT = `
  SELECT
    turn_search_documents.turn_id,
    turn_search_documents.user_text,
    turn_search_documents.final_answer_text,
    turn_search_documents.title_text,
    turn_search_documents.tags_text,
    turn_search_documents.notes_text,
    turns.thread_id,
    turns.ordinal AS turn_ordinal,
    turns.started_at,
    turns.completed_at,
    threads.project_id,
    COALESCE(thread_overrides.display_title, threads.title) AS thread_title,
    COALESCE(project_overrides.display_name, projects.display_name) AS project_name,
    turn_overrides.tags_json
  FROM turn_search_documents
  INNER JOIN turns
    ON turns.id = turn_search_documents.turn_id
  INNER JOIN threads
    ON threads.id = turns.thread_id
  LEFT JOIN projects
    ON projects.id = threads.project_id
  LEFT JOIN project_overrides
    ON project_overrides.project_id = projects.id
  LEFT JOIN thread_overrides
    ON thread_overrides.thread_id = threads.id
  LEFT JOIN turn_overrides
    ON turn_overrides.turn_id = turns.id
`;

function searchTurns(database, query, options = {}) {
  const normalizedQuery = normalizeSearchQuery(query);
  const { limit, offset } = normalizeSearchPageOptions(options);

  if (!normalizedQuery) {
    return {
      query: "",
      results: [],
      total: 0,
      limit,
      offset,
      hasMore: false
    };
  }

  const useFts = Array.from(normalizedQuery).length >= 3;
  let rows;
  let total;

  if (useFts) {
    const ftsQuery = quoteFtsQuery(normalizedQuery);
    total = Number(
      database
        .prepare(`
          SELECT COUNT(*) AS count
          FROM turn_search_index
          WHERE turn_search_index MATCH ?
        `)
        .get(ftsQuery)?.count ?? 0
    );
    rows = database
      .prepare(`
        ${SEARCH_RESULT_SELECT}
        INNER JOIN turn_search_index
          ON turn_search_index.rowid = turn_search_documents.rowid
        WHERE turn_search_index MATCH ?
        ORDER BY
          bm25(turn_search_index, 1.4, 1.2, 1.8, 1.6, 1.5) ASC,
          COALESCE(turns.completed_at, turns.started_at, turns.last_seen_at) DESC
        LIMIT ? OFFSET ?
      `)
      .all(ftsQuery, limit, offset);
  } else {
    const likeQuery = `%${normalizedQuery.replace(/([%_\\])/g, "\\$1")}%`;
    const whereClause = `
      WHERE turn_search_documents.user_text LIKE ? ESCAPE '\\'
        OR turn_search_documents.final_answer_text LIKE ? ESCAPE '\\'
        OR turn_search_documents.title_text LIKE ? ESCAPE '\\'
        OR turn_search_documents.tags_text LIKE ? ESCAPE '\\'
        OR turn_search_documents.notes_text LIKE ? ESCAPE '\\'
    `;
    const parameters = Array(5).fill(likeQuery);
    total = Number(
      database
        .prepare(`
          SELECT COUNT(*) AS count
          FROM turn_search_documents
          ${whereClause}
        `)
        .get(...parameters)?.count ?? 0
    );
    rows = database
      .prepare(`
        ${SEARCH_RESULT_SELECT}
        ${whereClause}
        ORDER BY COALESCE(turns.completed_at, turns.started_at, turns.last_seen_at) DESC
        LIMIT ? OFFSET ?
      `)
      .all(...parameters, limit, offset);
  }

  const results = rows.map((row) => mapSearchResult(row, normalizedQuery));

  return {
    query: normalizedQuery,
    results,
    total,
    limit,
    offset,
    hasMore: offset + results.length < total
  };
}

module.exports = {
  createTurnSearchSchema,
  ensureTurnSearchIndex,
  rebuildTurnSearchIndex,
  refreshThreadSearchDocuments,
  refreshTurnSearchDocument,
  searchTurns
};

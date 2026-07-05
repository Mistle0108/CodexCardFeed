const { DatabaseSync } = require("node:sqlite");

const CURRENT_SCHEMA_VERSION = 5;

function createMetaTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function getMetaValue(database, key) {
  const row = database
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(key);

  return row ? row.value : null;
}

function setMetaValue(database, key, value) {
  database
    .prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, value);
}

function getSchemaVersion(database) {
  const version = getMetaValue(database, "schema_version");
  return version ? Number.parseInt(version, 10) : 0;
}

function migrationOne(database) {
  createMetaTable(database);
  setMetaValue(database, "schema_version", "1");
}

function migrationTwo(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      source_path TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      source_cwd TEXT,
      source_session_path TEXT,
      source_kind TEXT NOT NULL,
      title TEXT NOT NULL,
      preview TEXT NOT NULL DEFAULT '',
      created_at TEXT,
      updated_at TEXT,
      last_seen_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      status TEXT NOT NULL,
      first_user_snippet TEXT NOT NULL DEFAULT '',
      content_hash TEXT,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
      UNIQUE (thread_id, ordinal)
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      turn_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      role TEXT NOT NULL,
      kind TEXT NOT NULL,
      text_content TEXT,
      raw_json TEXT,
      created_at TEXT,
      FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE CASCADE,
      UNIQUE (turn_id, ordinal)
    );

    CREATE TABLE IF NOT EXISTS thread_overrides (
      thread_id TEXT PRIMARY KEY,
      display_title TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS turn_overrides (
      turn_id TEXT PRIMARY KEY,
      display_title TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS turn_summaries (
      turn_id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      summary_mode TEXT NOT NULL,
      title TEXT,
      question_summary TEXT,
      answer_summary TEXT,
      keywords_json TEXT NOT NULL DEFAULT '[]',
      model_name TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (turn_id) REFERENCES turns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      source_cursor TEXT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      details_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_threads_project_updated
      ON threads (project_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_threads_last_seen
      ON threads (last_seen_at DESC);

    CREATE INDEX IF NOT EXISTS idx_turns_thread_ordinal
      ON turns (thread_id, ordinal);

    CREATE INDEX IF NOT EXISTS idx_turns_last_seen
      ON turns (last_seen_at DESC);

    CREATE INDEX IF NOT EXISTS idx_items_turn_ordinal
      ON items (turn_id, ordinal);

    CREATE INDEX IF NOT EXISTS idx_turn_summaries_content_hash
      ON turn_summaries (content_hash);

    CREATE INDEX IF NOT EXISTS idx_sync_runs_source_started
      ON sync_runs (source_name, started_at DESC);
  `);

  setMetaValue(database, "schema_version", "2");
  setMetaValue(database, "app_schema_name", "codex-card-feed-core");
}

function hasColumn(database, tableName, columnName) {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((row) => row.name === columnName);
}

function addColumnIfMissing(database, tableName, columnName, columnDefinition) {
  if (hasColumn(database, tableName, columnName)) {
    return;
  }

  database.exec(`
    ALTER TABLE ${tableName}
    ADD COLUMN ${columnName} ${columnDefinition}
  `);
}

function migrationThree(database) {
  addColumnIfMissing(database, "turns", "input_tokens", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(database, "turns", "cached_input_tokens", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(database, "turns", "output_tokens", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(
    database,
    "turns",
    "reasoning_output_tokens",
    "INTEGER NOT NULL DEFAULT 0"
  );
  addColumnIfMissing(database, "turns", "total_tokens", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(database, "turns", "token_event_count", "INTEGER NOT NULL DEFAULT 0");

  setMetaValue(database, "schema_version", "3");
}

function migrationFour(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS session_source_files (
      source_path TEXT PRIMARY KEY,
      thread_id TEXT,
      file_size INTEGER NOT NULL DEFAULT 0,
      modified_at_ms INTEGER NOT NULL DEFAULT 0,
      modified_at TEXT,
      status TEXT NOT NULL,
      last_imported_at TEXT NOT NULL,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_session_source_files_thread
      ON session_source_files (thread_id);

    CREATE INDEX IF NOT EXISTS idx_session_source_files_status
      ON session_source_files (status, last_imported_at DESC);
  `);

  setMetaValue(database, "schema_version", "4");
}

function migrationFive(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS import_validation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_run_id INTEGER NOT NULL,
      severity TEXT NOT NULL,
      scope TEXT NOT NULL,
      file_path TEXT,
      code TEXT NOT NULL,
      message TEXT NOT NULL,
      line_number INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_import_validation_logs_sync_run
      ON import_validation_logs (sync_run_id, id ASC);

    CREATE INDEX IF NOT EXISTS idx_import_validation_logs_severity
      ON import_validation_logs (severity, created_at DESC);
  `);

  setMetaValue(database, "schema_version", "5");
}

const migrations = [
  { version: 1, apply: migrationOne },
  { version: 2, apply: migrationTwo },
  { version: 3, apply: migrationThree },
  { version: 4, apply: migrationFour },
  { version: 5, apply: migrationFive }
];

function runMigrations(database) {
  createMetaTable(database);

  let version = getSchemaVersion(database);

  for (const migration of migrations) {
    if (migration.version <= version) {
      continue;
    }

    database.exec("BEGIN");

    try {
      migration.apply(database);
      database.exec("COMMIT");
      version = migration.version;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  if (version !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unexpected schema version ${version}; expected ${CURRENT_SCHEMA_VERSION}.`
    );
  }

  return version;
}

function listUserTables(database) {
  return database
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    .all()
    .map((row) => row.name);
}

function listIndexes(database) {
  return database
    .prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    .all()
    .map((row) => row.name);
}

function getRowCount(database, tableName) {
  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get();

  return row ? row.count : 0;
}

function getDatabaseOverview(database) {
  const tableNames = listUserTables(database);
  const indexNames = listIndexes(database);
  const tables = tableNames.map((name) => ({
    name,
    rowCount: getRowCount(database, name)
  }));

  return {
    schemaVersion: String(getSchemaVersion(database)),
    schemaName: getMetaValue(database, "app_schema_name") ?? "unknown",
    tables,
    indexNames
  };
}

function listProjects(database) {
  return database
    .prepare(`
      SELECT
        projects.id,
        projects.display_name,
        projects.source_kind,
        projects.source_path,
        COUNT(DISTINCT threads.id) AS thread_count,
        COUNT(DISTINCT turns.id) AS turn_count,
        MAX(COALESCE(threads.updated_at, threads.last_seen_at)) AS last_activity_at
      FROM projects
      LEFT JOIN threads
        ON threads.project_id = projects.id
      LEFT JOIN turns
        ON turns.thread_id = threads.id
      WHERE projects.source_kind = 'workspace'
      GROUP BY
        projects.id,
        projects.display_name,
        projects.source_kind,
        projects.source_path
      ORDER BY
        last_activity_at DESC,
        projects.display_name ASC
    `)
    .all()
    .map((row) => ({
      id: row.id,
      displayName: row.display_name,
      sourceKind: row.source_kind,
      sourcePath: row.source_path,
      threadCount: Number(row.thread_count ?? 0),
      turnCount: Number(row.turn_count ?? 0),
      lastActivityAt: row.last_activity_at ?? null
    }));
}

function listThreads(database, projectId = null) {
  return database
    .prepare(`
      SELECT
        threads.id,
        threads.project_id,
        projects.display_name AS project_display_name,
        COALESCE(thread_overrides.display_title, threads.title) AS display_title,
        threads.title AS source_title,
        threads.preview,
        threads.source_cwd,
        threads.source_session_path,
        threads.updated_at,
        threads.last_seen_at,
        MAX(COALESCE(thread_overrides.pinned, 0)) AS is_pinned,
        COUNT(turns.id) AS turn_count,
        SUM(CASE WHEN turns.status = 'completed' THEN 1 ELSE 0 END) AS completed_turn_count
      FROM threads
      LEFT JOIN projects
        ON projects.id = threads.project_id
      LEFT JOIN turns
        ON turns.thread_id = threads.id
      LEFT JOIN thread_overrides
        ON thread_overrides.thread_id = threads.id
      WHERE (? IS NULL OR threads.project_id = ?)
      GROUP BY
        threads.id,
        threads.project_id,
        projects.display_name,
        thread_overrides.display_title,
        threads.title,
        threads.preview,
        threads.source_cwd,
        threads.source_session_path,
        threads.updated_at,
        threads.last_seen_at
      ORDER BY
        COALESCE(threads.updated_at, threads.last_seen_at) DESC,
        threads.id DESC
    `)
    .all(projectId, projectId)
    .map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectDisplayName: row.project_display_name ?? null,
      title: row.display_title,
      sourceTitle: row.source_title,
      preview: row.preview,
      sourceCwd: row.source_cwd,
      sourceSessionPath: row.source_session_path,
      updatedAt: row.updated_at ?? null,
      lastSeenAt: row.last_seen_at ?? null,
      isPinned: Boolean(row.is_pinned),
      turnCount: Number(row.turn_count ?? 0),
      completedTurnCount: Number(row.completed_turn_count ?? 0)
    }));
}

function listThreadsByProject(database, projectId) {
  return listThreads(database, projectId);
}

function listTurnsByThread(database, threadId) {
  return database
    .prepare(`
      SELECT
        turns.id,
        turns.thread_id,
        turns.ordinal,
        turn_overrides.display_title,
        turns.first_user_snippet,
        (
          SELECT assistant_items.text_content
          FROM items AS assistant_items
          WHERE assistant_items.turn_id = turns.id
            AND assistant_items.role = 'assistant'
            AND assistant_items.kind LIKE 'message%'
            AND COALESCE(assistant_items.text_content, '') <> ''
          ORDER BY
            CASE
              WHEN assistant_items.kind = 'message:final_answer' THEN 0
              ELSE 1
            END ASC,
            assistant_items.ordinal ASC
          LIMIT 1
        ) AS first_assistant_snippet,
        turns.status,
        turns.started_at,
        turns.completed_at,
        turns.last_seen_at,
        turns.input_tokens,
        turns.cached_input_tokens,
        turns.output_tokens,
        turns.reasoning_output_tokens,
        turns.total_tokens,
        turns.token_event_count,
        MAX(COALESCE(turn_overrides.pinned, 0)) AS is_pinned,
        COUNT(items.id) AS item_count
      FROM turns
      LEFT JOIN items
        ON items.turn_id = turns.id
      LEFT JOIN turn_overrides
        ON turn_overrides.turn_id = turns.id
      WHERE turns.thread_id = ?
      GROUP BY
        turns.id,
        turns.thread_id,
        turns.ordinal,
        turn_overrides.display_title,
        turns.first_user_snippet,
        turns.status,
        turns.started_at,
        turns.completed_at,
        turns.last_seen_at,
        turns.input_tokens,
        turns.cached_input_tokens,
        turns.output_tokens,
        turns.reasoning_output_tokens,
        turns.total_tokens,
        turns.token_event_count
      ORDER BY turns.ordinal DESC
    `)
    .all(threadId)
    .map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      ordinal: Number(row.ordinal),
      displayTitle: row.display_title || null,
      firstUserSnippet: row.first_user_snippet,
      firstAssistantSnippet: row.first_assistant_snippet ?? "",
      status: row.status,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
      lastSeenAt: row.last_seen_at ?? null,
      inputTokens: Number(row.input_tokens ?? 0),
      cachedInputTokens: Number(row.cached_input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      reasoningOutputTokens: Number(row.reasoning_output_tokens ?? 0),
      totalTokens: Number(row.total_tokens ?? 0),
      tokenEventCount: Number(row.token_event_count ?? 0),
      isPinned: Boolean(row.is_pinned),
      itemCount: Number(row.item_count ?? 0)
    }));
}

function listItemsByTurn(database, turnId) {
  return database
    .prepare(`
      SELECT
        id,
        turn_id,
        ordinal,
        role,
        kind,
        text_content,
        raw_json,
        created_at
      FROM items
      WHERE turn_id = ?
      ORDER BY ordinal ASC
    `)
    .all(turnId)
    .map((row) => ({
      id: row.id,
      turnId: row.turn_id,
      ordinal: Number(row.ordinal),
      role: row.role,
      kind: row.kind,
      textContent: row.text_content ?? "",
      rawJson: row.raw_json ?? "",
      createdAt: row.created_at ?? null
    }));
}

function initializeDatabase(databasePath) {
  const database = new DatabaseSync(databasePath);

  database.exec("PRAGMA foreign_keys = ON");

  const schemaVersion = runMigrations(database);
  const overview = getDatabaseOverview(database);

  return {
    database,
    databasePath,
    schemaVersion: String(schemaVersion),
    overview
  };
}

module.exports = {
  initializeDatabase,
  getDatabaseOverview,
  listProjects,
  listThreads,
  listThreadsByProject,
  listTurnsByThread,
  listItemsByTurn
};

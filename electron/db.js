const { DatabaseSync } = require("node:sqlite");

const CURRENT_SCHEMA_VERSION = 6;

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

function migrationSix(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS project_overrides (
      project_id TEXT PRIMARY KEY,
      display_name TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      pinned INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  setMetaValue(database, "schema_version", "6");
}

const migrations = [
  { version: 1, apply: migrationOne },
  { version: 2, apply: migrationTwo },
  { version: 3, apply: migrationThree },
  { version: 4, apply: migrationFour },
  { version: 5, apply: migrationFive },
  { version: 6, apply: migrationSix }
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
        COALESCE(project_overrides.display_name, projects.display_name) AS display_name,
        projects.display_name AS source_display_name,
        project_overrides.tags_json,
        project_overrides.notes,
        projects.source_kind,
        projects.source_path,
        MAX(COALESCE(project_overrides.pinned, 0)) AS is_pinned,
        json_group_array(DISTINCT CASE
          WHEN threads.source_session_path IS NOT NULL
            AND threads.source_session_path <> ''
          THEN threads.source_session_path
        END) AS source_session_paths_json,
        COUNT(DISTINCT threads.id) AS thread_count,
        COUNT(DISTINCT turns.id) AS turn_count,
        MAX(COALESCE(threads.updated_at, threads.last_seen_at)) AS last_activity_at
      FROM projects
      LEFT JOIN project_overrides
        ON project_overrides.project_id = projects.id
      LEFT JOIN threads
        ON threads.project_id = projects.id
      LEFT JOIN turns
        ON turns.thread_id = threads.id
      WHERE projects.source_kind = 'workspace'
      GROUP BY
        projects.id,
        project_overrides.display_name,
        project_overrides.tags_json,
        project_overrides.notes,
        projects.display_name,
        projects.source_kind,
        projects.source_path
      ORDER BY
        is_pinned DESC,
        last_activity_at DESC,
        display_name ASC
    `)
    .all()
    .map((row) => ({
      id: row.id,
      displayName: row.display_name,
      sourceDisplayName: row.source_display_name,
      tags: parseOverrideTagsJson(row.tags_json),
      notes: typeof row.notes === "string" ? row.notes : "",
      sourceKind: row.source_kind,
      sourcePath: row.source_path,
      isPinned: Boolean(row.is_pinned),
      sourceSessionPaths: JSON.parse(row.source_session_paths_json ?? "[]").filter(
        (value) => typeof value === "string" && value.trim()
      ),
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
        thread_overrides.tags_json,
        thread_overrides.notes,
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
        thread_overrides.tags_json,
        thread_overrides.notes,
        threads.title,
        threads.preview,
        threads.source_cwd,
        threads.source_session_path,
        threads.updated_at,
        threads.last_seen_at
      ORDER BY
        is_pinned DESC,
        COALESCE(threads.updated_at, threads.last_seen_at) DESC,
        threads.id DESC
    `)
    .all(projectId, projectId)
    .map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectDisplayName: row.project_display_name ?? null,
      title: row.display_title,
      tags: parseOverrideTagsJson(row.tags_json),
      notes: typeof row.notes === "string" ? row.notes : "",
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
        turn_overrides.tags_json,
        turn_overrides.notes,
        turns.first_user_snippet,
        (
          SELECT group_concat(search_user_items.text_content, char(10) || char(10))
          FROM (
            SELECT user_items.text_content
            FROM items AS user_items
            WHERE user_items.turn_id = turns.id
              AND user_items.role = 'user'
              AND user_items.kind <> 'message:bootstrap_context'
              AND COALESCE(user_items.text_content, '') <> ''
            ORDER BY user_items.ordinal ASC
          ) AS search_user_items
        ) AS search_user_text,
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
        (
          SELECT group_concat(search_answer_items.text_content, char(10) || char(10))
          FROM (
            SELECT answer_items.text_content
            FROM items AS answer_items
            WHERE answer_items.turn_id = turns.id
              AND answer_items.kind = 'message:final_answer'
              AND COALESCE(answer_items.text_content, '') <> ''
            ORDER BY answer_items.ordinal ASC
          ) AS search_answer_items
        ) AS search_final_answer_text,
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
        turn_overrides.tags_json,
        turn_overrides.notes,
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
      ORDER BY
        is_pinned DESC,
        turns.ordinal DESC
    `)
    .all(threadId)
    .map((row) => ({
      id: row.id,
      threadId: row.thread_id,
      ordinal: Number(row.ordinal),
      displayTitle: row.display_title || null,
      tags: parseOverrideTagsJson(row.tags_json),
      notes: typeof row.notes === "string" ? row.notes : "",
      firstUserSnippet: row.first_user_snippet,
      firstAssistantSnippet: row.first_assistant_snippet ?? "",
      searchUserText: row.search_user_text ?? row.first_user_snippet ?? "",
      searchFinalAnswerText: row.search_final_answer_text ?? row.first_assistant_snippet ?? "",
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

function normalizeOverrideDisplayTitle(displayTitle, label) {
  if (displayTitle === undefined) {
    return undefined;
  }

  if (displayTitle === null) {
    return null;
  }

  if (typeof displayTitle !== "string") {
    throw new Error(`${label} must be a string or null.`);
  }

  const normalized = displayTitle.trim();
  return normalized ? normalized : null;
}

function normalizeOverridePinnedValue(isPinned, label) {
  if (isPinned === undefined) {
    return undefined;
  }

  if (typeof isPinned !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return isPinned ? 1 : 0;
}

function parseOverrideTagsJson(tagsJson) {
  if (typeof tagsJson !== "string" || !tagsJson.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(tagsJson);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const seen = new Set();
    const normalized = [];

    for (const value of parsed) {
      if (typeof value !== "string") {
        continue;
      }

      const trimmed = value.trim();

      if (!trimmed || seen.has(trimmed)) {
        continue;
      }

      seen.add(trimmed);
      normalized.push(trimmed);
    }

    return normalized;
  } catch {
    return [];
  }
}

function normalizeOverrideTagsValue(tags, label) {
  if (tags === undefined) {
    return undefined;
  }

  if (tags === null) {
    return "[]";
  }

  if (!Array.isArray(tags)) {
    throw new Error(`${label} must be an array or null.`);
  }

  const normalized = [];
  const seen = new Set();

  for (const value of tags) {
    if (typeof value !== "string") {
      throw new Error(`${label} values must be strings.`);
    }

    const trimmed = value.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return JSON.stringify(normalized);
}

function normalizeOverrideNotesValue(notes, label) {
  if (notes === undefined) {
    return undefined;
  }

  if (notes === null) {
    return "";
  }

  if (typeof notes !== "string") {
    throw new Error(`${label} must be a string or null.`);
  }

  return notes.trim();
}

function saveThreadOverride(database, threadId, changes) {
  if (typeof threadId !== "string" || !threadId.trim()) {
    throw new Error("Thread ID cannot be empty.");
  }

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("Thread override payload must be an object.");
  }

  const baseThread = database.prepare("SELECT id FROM threads WHERE id = ?").get(threadId);

  if (!baseThread) {
    throw new Error("Thread not found.");
  }

  const nextDisplayTitle = normalizeOverrideDisplayTitle(
    changes.displayTitle,
    "Thread display title"
  );
  const nextPinned = normalizeOverridePinnedValue(changes.isPinned, "Thread pin state");
  const nextTagsJson = normalizeOverrideTagsValue(changes.tags, "Thread tags");
  const nextNotes = normalizeOverrideNotesValue(changes.notes, "Thread notes");

  if (
    nextDisplayTitle === undefined &&
    nextPinned === undefined &&
    nextTagsJson === undefined &&
    nextNotes === undefined
  ) {
    return;
  }

  const existingOverride = database
    .prepare(`
      SELECT
        display_title,
        tags_json,
        pinned,
        notes
      FROM thread_overrides
      WHERE thread_id = ?
    `)
    .get(threadId);
  const resolvedDisplayTitle =
    nextDisplayTitle !== undefined ? nextDisplayTitle : existingOverride?.display_title ?? null;
  const resolvedPinned =
    nextPinned !== undefined ? nextPinned : Number(existingOverride?.pinned ?? 0);
  const resolvedTagsJson =
    nextTagsJson !== undefined
      ? nextTagsJson
      : JSON.stringify(parseOverrideTagsJson(existingOverride?.tags_json));
  const resolvedNotes =
    nextNotes !== undefined
      ? nextNotes
      : typeof existingOverride?.notes === "string"
        ? existingOverride.notes.trim()
        : "";

  if (
    resolvedDisplayTitle === null &&
    resolvedPinned === 0 &&
    resolvedTagsJson === "[]" &&
    !resolvedNotes
  ) {
    database.prepare("DELETE FROM thread_overrides WHERE thread_id = ?").run(threadId);
    return;
  }

  database
    .prepare(`
      INSERT INTO thread_overrides (
        thread_id,
        display_title,
        tags_json,
        pinned,
        notes,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET
        display_title = excluded.display_title,
        tags_json = excluded.tags_json,
        pinned = excluded.pinned,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `)
    .run(
      threadId,
      resolvedDisplayTitle,
      resolvedTagsJson,
      resolvedPinned,
      resolvedNotes,
      new Date().toISOString()
    );
}

function saveProjectOverride(database, projectId, changes) {
  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new Error("Project ID cannot be empty.");
  }

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("Project override payload must be an object.");
  }

  const baseProject = database.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);

  if (!baseProject) {
    throw new Error("Project not found.");
  }

  const nextDisplayName = normalizeOverrideDisplayTitle(
    changes.displayName,
    "Project display name"
  );
  const nextPinned = normalizeOverridePinnedValue(changes.isPinned, "Project pin state");
  const nextTagsJson = normalizeOverrideTagsValue(changes.tags, "Project tags");
  const nextNotes = normalizeOverrideNotesValue(changes.notes, "Project notes");

  if (
    nextDisplayName === undefined &&
    nextPinned === undefined &&
    nextTagsJson === undefined &&
    nextNotes === undefined
  ) {
    return;
  }

  const existingOverride = database
    .prepare(`
      SELECT
        display_name,
        tags_json,
        pinned,
        notes
      FROM project_overrides
      WHERE project_id = ?
    `)
    .get(projectId);
  const resolvedDisplayName =
    nextDisplayName !== undefined ? nextDisplayName : existingOverride?.display_name ?? null;
  const resolvedPinned =
    nextPinned !== undefined ? nextPinned : Number(existingOverride?.pinned ?? 0);
  const resolvedTagsJson =
    nextTagsJson !== undefined
      ? nextTagsJson
      : JSON.stringify(parseOverrideTagsJson(existingOverride?.tags_json));
  const resolvedNotes =
    nextNotes !== undefined
      ? nextNotes
      : typeof existingOverride?.notes === "string"
        ? existingOverride.notes.trim()
        : "";

  if (
    resolvedDisplayName === null &&
    resolvedPinned === 0 &&
    resolvedTagsJson === "[]" &&
    !resolvedNotes
  ) {
    database.prepare("DELETE FROM project_overrides WHERE project_id = ?").run(projectId);
    return;
  }

  database
    .prepare(`
      INSERT INTO project_overrides (
        project_id,
        display_name,
        tags_json,
        pinned,
        notes,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        display_name = excluded.display_name,
        tags_json = excluded.tags_json,
        pinned = excluded.pinned,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `)
    .run(
      projectId,
      resolvedDisplayName,
      resolvedTagsJson,
      resolvedPinned,
      resolvedNotes,
      new Date().toISOString()
    );
}

function saveTurnOverride(database, turnId, changes) {
  if (typeof turnId !== "string" || !turnId.trim()) {
    throw new Error("Turn ID cannot be empty.");
  }

  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("Turn override payload must be an object.");
  }

  const baseTurn = database.prepare("SELECT id FROM turns WHERE id = ?").get(turnId);

  if (!baseTurn) {
    throw new Error("Turn not found.");
  }

  const nextDisplayTitle = normalizeOverrideDisplayTitle(
    changes.displayTitle,
    "Turn display title"
  );
  const nextPinned = normalizeOverridePinnedValue(changes.isPinned, "Turn pin state");
  const nextTagsJson = normalizeOverrideTagsValue(changes.tags, "Turn tags");
  const nextNotes = normalizeOverrideNotesValue(changes.notes, "Turn notes");

  if (
    nextDisplayTitle === undefined &&
    nextPinned === undefined &&
    nextTagsJson === undefined &&
    nextNotes === undefined
  ) {
    return;
  }

  const existingOverride = database
    .prepare(`
      SELECT
        display_title,
        tags_json,
        pinned,
        notes
      FROM turn_overrides
      WHERE turn_id = ?
    `)
    .get(turnId);
  const resolvedDisplayTitle =
    nextDisplayTitle !== undefined ? nextDisplayTitle : existingOverride?.display_title ?? null;
  const resolvedPinned =
    nextPinned !== undefined ? nextPinned : Number(existingOverride?.pinned ?? 0);
  const resolvedTagsJson =
    nextTagsJson !== undefined
      ? nextTagsJson
      : JSON.stringify(parseOverrideTagsJson(existingOverride?.tags_json));
  const resolvedNotes =
    nextNotes !== undefined
      ? nextNotes
      : typeof existingOverride?.notes === "string"
        ? existingOverride.notes.trim()
        : "";

  if (
    resolvedDisplayTitle === null &&
    resolvedPinned === 0 &&
    resolvedTagsJson === "[]" &&
    !resolvedNotes
  ) {
    database.prepare("DELETE FROM turn_overrides WHERE turn_id = ?").run(turnId);
    return;
  }

  database
    .prepare(`
      INSERT INTO turn_overrides (
        turn_id,
        display_title,
        tags_json,
        pinned,
        notes,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(turn_id) DO UPDATE SET
        display_title = excluded.display_title,
        tags_json = excluded.tags_json,
        pinned = excluded.pinned,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `)
    .run(
      turnId,
      resolvedDisplayTitle,
      resolvedTagsJson,
      resolvedPinned,
      resolvedNotes,
      new Date().toISOString()
    );
}

function initializeDatabase(databasePath) {
  const database = new DatabaseSync(databasePath);

  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");

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
  listItemsByTurn,
  saveProjectOverride,
  saveThreadOverride,
  saveTurnOverride
};

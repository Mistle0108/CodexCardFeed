const {
  IMPORTER_LAYOUT_VERSION_KEY,
  SOURCE_FILE_STATUS_ACTIVE
} = require("./constants");
const { listValidationLogEntries } = require("./validation");

function upsertProject(database, project, importedAt) {
  database
    .prepare(`
      INSERT INTO projects (
        id,
        source_path,
        display_name,
        source_kind,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_path = excluded.source_path,
        display_name = excluded.display_name,
        source_kind = excluded.source_kind,
        updated_at = excluded.updated_at
    `)
    .run(
      project.projectId,
      project.sourcePath,
      project.displayName,
      project.sourceKind,
      importedAt,
      importedAt
    );
}

function upsertThread(database, thread) {
  database
    .prepare(`
      INSERT INTO threads (
        id,
        project_id,
        source_cwd,
        source_session_path,
        source_kind,
        title,
        preview,
        created_at,
        updated_at,
        last_seen_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        source_cwd = excluded.source_cwd,
        source_session_path = excluded.source_session_path,
        source_kind = excluded.source_kind,
        title = excluded.title,
        preview = excluded.preview,
        created_at = COALESCE(threads.created_at, excluded.created_at),
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at
    `)
    .run(
      thread.id,
      thread.projectId,
      thread.sourceCwd,
      thread.sourceSessionPath,
      thread.sourceKind,
      thread.title,
      thread.preview,
      thread.createdAt,
      thread.updatedAt,
      thread.lastSeenAt
    );
}

function upsertTurn(database, turn) {
  database
    .prepare(`
      INSERT INTO turns (
        id,
        thread_id,
        ordinal,
        started_at,
        completed_at,
        status,
        first_user_snippet,
        content_hash,
        last_seen_at,
        input_tokens,
        cached_input_tokens,
        output_tokens,
        reasoning_output_tokens,
        total_tokens,
        token_event_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        thread_id = excluded.thread_id,
        ordinal = excluded.ordinal,
        started_at = COALESCE(turns.started_at, excluded.started_at),
        completed_at = excluded.completed_at,
        status = excluded.status,
        first_user_snippet = excluded.first_user_snippet,
        content_hash = excluded.content_hash,
        last_seen_at = excluded.last_seen_at,
        input_tokens = excluded.input_tokens,
        cached_input_tokens = excluded.cached_input_tokens,
        output_tokens = excluded.output_tokens,
        reasoning_output_tokens = excluded.reasoning_output_tokens,
        total_tokens = excluded.total_tokens,
        token_event_count = excluded.token_event_count
    `)
    .run(
      turn.id,
      turn.threadId,
      turn.ordinal,
      turn.startedAt,
      turn.completedAt,
      turn.status,
      turn.firstUserSnippet,
      turn.contentHash,
      turn.lastSeenAt,
      turn.tokenUsage.inputTokens,
      turn.tokenUsage.cachedInputTokens,
      turn.tokenUsage.outputTokens,
      turn.tokenUsage.reasoningOutputTokens,
      turn.tokenUsage.totalTokens,
      turn.tokenUsage.tokenEventCount
    );
}

function upsertItem(database, item) {
  database
    .prepare(`
      INSERT INTO items (
        id,
        turn_id,
        ordinal,
        role,
        kind,
        text_content,
        raw_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        turn_id = excluded.turn_id,
        ordinal = excluded.ordinal,
        role = excluded.role,
        kind = excluded.kind,
        text_content = excluded.text_content,
        raw_json = excluded.raw_json,
        created_at = excluded.created_at
    `)
    .run(
      item.id,
      item.turnId,
      item.ordinal,
      item.role,
      item.kind,
      item.textContent,
      item.rawJson,
      item.createdAt
    );
}

function getImporterMetaValue(database, key) {
  const row = database
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .get(key);

  return row?.value ?? null;
}

function setImporterMetaValue(database, key, value) {
  database
    .prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, value);
}

function listTrackedSourceFiles(database) {
  return new Map(
    database
      .prepare(`
        SELECT
          source_path,
          thread_id,
          file_size,
          modified_at_ms,
          modified_at,
          status,
          last_imported_at,
          last_error
        FROM session_source_files
      `)
      .all()
      .map((row) => [
        row.source_path,
        {
          sourcePath: row.source_path,
          threadId: row.thread_id ?? null,
          fileSize: Number(row.file_size ?? 0),
          modifiedAtMs: Number(row.modified_at_ms ?? 0),
          modifiedAt: row.modified_at ?? null,
          status: row.status,
          lastImportedAt: row.last_imported_at,
          lastError: row.last_error ?? null
        }
      ])
  );
}

function listExistingThreadSourceFiles(database) {
  return database
    .prepare(`
      SELECT
        id,
        source_session_path
      FROM threads
      WHERE source_session_path IS NOT NULL
        AND source_session_path <> ''
    `)
    .all()
    .map((row) => ({
      threadId: row.id,
      sourcePath: row.source_session_path
    }));
}

function listThreadSourceRecords(database) {
  return database
    .prepare(`
      SELECT
        id,
        title,
        source_session_path
      FROM threads
    `)
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      sourceSessionPath: row.source_session_path ?? null
    }));
}

function upsertTrackedSourceFile(database, sourceFile, importedAt) {
  database
    .prepare(`
      INSERT INTO session_source_files (
        source_path,
        thread_id,
        file_size,
        modified_at_ms,
        modified_at,
        status,
        last_imported_at,
        last_error
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_path) DO UPDATE SET
        thread_id = excluded.thread_id,
        file_size = excluded.file_size,
        modified_at_ms = excluded.modified_at_ms,
        modified_at = excluded.modified_at,
        status = excluded.status,
        last_imported_at = excluded.last_imported_at,
        last_error = excluded.last_error
    `)
    .run(
      sourceFile.sourcePath,
      sourceFile.threadId,
      sourceFile.fileSize,
      sourceFile.modifiedAtMs,
      sourceFile.modifiedAt,
      sourceFile.status,
      importedAt,
      sourceFile.lastError ?? null
    );
}

function hasTrackedSourceFileChanged(trackedSourceFile, currentSourceFile) {
  if (!trackedSourceFile) {
    return true;
  }

  if (trackedSourceFile.status !== SOURCE_FILE_STATUS_ACTIVE) {
    return true;
  }

  return (
    trackedSourceFile.fileSize !== currentSourceFile.fileSize ||
    trackedSourceFile.modifiedAtMs !== currentSourceFile.modifiedAtMs
  );
}

function deleteStaleItemsForTurn(database, turnId, itemIds) {
  if (!itemIds.length) {
    database.prepare("DELETE FROM items WHERE turn_id = ?").run(turnId);
    return;
  }

  const placeholders = itemIds.map(() => "?").join(", ");
  database
    .prepare(`
      DELETE FROM items
      WHERE turn_id = ?
        AND id NOT IN (${placeholders})
    `)
    .run(turnId, ...itemIds);
}

function deleteStaleTurnsForThread(database, threadId, turnIds) {
  if (!turnIds.length) {
    database.prepare("DELETE FROM turns WHERE thread_id = ?").run(threadId);
    return;
  }

  const placeholders = turnIds.map(() => "?").join(", ");
  database
    .prepare(`
      DELETE FROM turns
      WHERE thread_id = ?
        AND id NOT IN (${placeholders})
    `)
    .run(threadId, ...turnIds);
}

function reconcileThreadSnapshot(database, mergedSession, importedAt) {
  upsertProject(database, mergedSession.project, importedAt);
  upsertThread(database, mergedSession.thread);

  const turnIds = [];

  for (const turn of mergedSession.turns) {
    turnIds.push(turn.id);
    upsertTurn(database, turn);

    const itemIds = [];

    for (const item of turn.items) {
      itemIds.push(item.id);
      upsertItem(database, item);
    }

    deleteStaleItemsForTurn(database, turn.id, itemIds);
  }

  deleteStaleTurnsForThread(database, mergedSession.thread.id, turnIds);
}

function pruneEmptyProjects(database) {
  database.exec(`
    DELETE FROM projects
    WHERE id NOT IN (
      SELECT DISTINCT project_id
      FROM threads
      WHERE project_id IS NOT NULL
    )
  `);
}

function startSyncRun(database, sourceName, startedAt) {
  const result = database
    .prepare(`
      INSERT INTO sync_runs (
        source_name,
        status,
        started_at,
        details_json
      )
      VALUES (?, 'running', ?, '{}')
    `)
    .run(sourceName, startedAt);

  return Number(result.lastInsertRowid);
}

function finishSyncRun(database, syncRunId, status, completedAt, details) {
  database
    .prepare(`
      UPDATE sync_runs
      SET status = ?,
          completed_at = ?,
          details_json = ?
      WHERE id = ?
    `)
    .run(status, completedAt, JSON.stringify(details), syncRunId);
}

function persistValidationLogs(database, syncRunId, validationState, createdAt) {
  const logEntries = listValidationLogEntries(validationState);

  if (!logEntries.length) {
    return;
  }

  const insertLogStatement = database.prepare(`
    INSERT INTO import_validation_logs (
      sync_run_id,
      severity,
      scope,
      file_path,
      code,
      message,
      line_number,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const entry of logEntries) {
    insertLogStatement.run(
      syncRunId,
      entry.severity,
      entry.scope,
      entry.filePath ?? null,
      entry.code,
      entry.message,
      entry.lineNumber ?? null,
      createdAt
    );
  }
}

function getImporterLayoutVersion(database) {
  const value = getImporterMetaValue(database, IMPORTER_LAYOUT_VERSION_KEY);

  if (!value) {
    return 0;
  }

  return Number.parseInt(value, 10) || 0;
}

function setImporterLayoutVersion(database, version) {
  setImporterMetaValue(database, IMPORTER_LAYOUT_VERSION_KEY, String(version));
}

function resetImportedLibrary(database) {
  database.exec("BEGIN");

  try {
    database.exec(`
      DELETE FROM sync_runs;
      DELETE FROM session_source_files;
      DELETE FROM threads;
      DELETE FROM projects;
    `);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

module.exports = {
  getImporterMetaValue,
  setImporterMetaValue,
  listTrackedSourceFiles,
  listExistingThreadSourceFiles,
  listThreadSourceRecords,
  upsertTrackedSourceFile,
  hasTrackedSourceFileChanged,
  reconcileThreadSnapshot,
  pruneEmptyProjects,
  startSyncRun,
  finishSyncRun,
  persistValidationLogs,
  getImporterLayoutVersion,
  setImporterLayoutVersion,
  resetImportedLibrary
};

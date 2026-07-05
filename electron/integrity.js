function runQuery(database, sql, ...params) {
  return database.prepare(sql).all(...params);
}

function createSampleRef(label, options = {}) {
  return {
    label,
    threadId: options.threadId ?? null,
    turnId: options.turnId ?? null
  };
}

function createThreadSampleRef(threadId, label = threadId) {
  return createSampleRef(label, { threadId });
}

function createTurnSampleRef(row, label = row.id) {
  return createSampleRef(label, {
    threadId: row.thread_id ?? null,
    turnId: row.id ?? null
  });
}

function createCheckResult({
  key,
  label,
  description,
  severity,
  affectedCount,
  sampleRefs,
  passMessage,
  failMessage
}) {
  const hasIssues = affectedCount > 0;

  return {
    key,
    label,
    description,
    severity,
    status: hasIssues ? "fail" : "pass",
    affectedCount,
    sampleRefs: hasIssues ? sampleRefs : [],
    message: hasIssues ? failMessage(affectedCount) : passMessage
  };
}

function createQueryCheck(database, definition) {
  const rows = runQuery(database, definition.sql, ...(definition.params ?? []));
  const sampleRefs = rows
    .slice(0, definition.sampleLimit ?? 5)
    .map((row) => definition.mapSampleRef(row));

  return createCheckResult({
    key: definition.key,
    label: definition.label,
    description: definition.description,
    severity: definition.severity,
    affectedCount: rows.length,
    sampleRefs,
    passMessage: definition.passMessage,
    failMessage: definition.failMessage
  });
}

function createOrdinalContinuityCheck({
  rows,
  parentKey,
  ordinalKey,
  key,
  label,
  description
}) {
  let currentParent = null;
  let expectedOrdinal = 1;
  let affectedCount = 0;
  const sampleRefs = [];

  for (const row of rows) {
    const parentId = row[parentKey];
    const ordinal = Number(row[ordinalKey] ?? 0);

    if (parentId !== currentParent) {
      currentParent = parentId;
      expectedOrdinal = 1;
    }

    if (ordinal !== expectedOrdinal) {
      affectedCount += 1;

      if (sampleRefs.length < 5) {
        sampleRefs.push(
          createThreadSampleRef(
            parentId,
            `${parentId}: expected ${expectedOrdinal}, found ${ordinal}`
          )
        );
      }

      expectedOrdinal = ordinal + 1;
      continue;
    }

    expectedOrdinal += 1;
  }

  return createCheckResult({
    key,
    label,
    description,
    severity: "warning",
    affectedCount,
    sampleRefs,
    passMessage: "Ordinals are contiguous.",
    failMessage(count) {
      return `${count} ordinal gap or mismatch${count === 1 ? "" : "es"} detected.`;
    }
  });
}

function buildIntegrityChecks(database) {
  const queryChecks = [
    {
      key: "threads_missing_project",
      label: "Threads with missing project references",
      description: "Each non-null thread.project_id should resolve to a stored project.",
      severity: "error",
      sql: `
        SELECT threads.id, threads.project_id
        FROM threads
        LEFT JOIN projects
          ON projects.id = threads.project_id
        WHERE threads.project_id IS NOT NULL
          AND projects.id IS NULL
      `,
      mapSampleRef(row) {
        return createThreadSampleRef(row.id, `${row.id} -> ${row.project_id}`);
      },
      passMessage: "All thread-to-project references are valid.",
      failMessage(count) {
        return `Detected ${count} thread reference${count === 1 ? "" : "s"} pointing to missing projects.`;
      }
    },
    {
      key: "turns_missing_thread",
      label: "Turns with missing thread references",
      description: "Every turn.thread_id should resolve to a stored thread.",
      severity: "error",
      sql: `
        SELECT turns.id, turns.thread_id
        FROM turns
        LEFT JOIN threads
          ON threads.id = turns.thread_id
        WHERE threads.id IS NULL
      `,
      mapSampleRef(row) {
        return createSampleRef(`${row.id} -> ${row.thread_id}`);
      },
      passMessage: "All turn-to-thread references are valid.",
      failMessage(count) {
        return `Detected ${count} turn reference${count === 1 ? "" : "s"} pointing to missing threads.`;
      }
    },
    {
      key: "items_missing_turn",
      label: "Items with missing turn references",
      description: "Every item.turn_id should resolve to a stored turn.",
      severity: "error",
      sql: `
        SELECT items.id, items.turn_id
        FROM items
        LEFT JOIN turns
          ON turns.id = items.turn_id
        WHERE turns.id IS NULL
      `,
      mapSampleRef(row) {
        return createSampleRef(`${row.id} -> ${row.turn_id}`);
      },
      passMessage: "All item-to-turn references are valid.",
      failMessage(count) {
        return `Detected ${count} item reference${count === 1 ? "" : "s"} pointing to missing turns.`;
      }
    },
    {
      key: "thread_overrides_missing_thread",
      label: "Thread overrides without base threads",
      description: "Local thread override rows should keep a matching thread.",
      severity: "warning",
      sql: `
        SELECT thread_overrides.thread_id
        FROM thread_overrides
        LEFT JOIN threads
          ON threads.id = thread_overrides.thread_id
        WHERE threads.id IS NULL
      `,
      mapSampleRef(row) {
        return createSampleRef(row.thread_id);
      },
      passMessage: "All thread overrides are attached to threads.",
      failMessage(count) {
        return `Detected ${count} orphaned thread override${count === 1 ? "" : "s"}.`;
      }
    },
    {
      key: "turn_overrides_missing_turn",
      label: "Turn overrides without base turns",
      description: "Local turn override rows should keep a matching turn.",
      severity: "warning",
      sql: `
        SELECT turn_overrides.turn_id
        FROM turn_overrides
        LEFT JOIN turns
          ON turns.id = turn_overrides.turn_id
        WHERE turns.id IS NULL
      `,
      mapSampleRef(row) {
        return createSampleRef(row.turn_id);
      },
      passMessage: "All turn overrides are attached to turns.",
      failMessage(count) {
        return `Detected ${count} orphaned turn override${count === 1 ? "" : "s"}.`;
      }
    },
    {
      key: "turn_summaries_missing_turn",
      label: "Turn summaries without base turns",
      description: "Stored turn summary rows should keep a matching turn.",
      severity: "warning",
      sql: `
        SELECT turn_summaries.turn_id
        FROM turn_summaries
        LEFT JOIN turns
          ON turns.id = turn_summaries.turn_id
        WHERE turns.id IS NULL
      `,
      mapSampleRef(row) {
        return createSampleRef(row.turn_id);
      },
      passMessage: "All stored turn summaries are attached to turns.",
      failMessage(count) {
        return `Detected ${count} orphaned turn summar${count === 1 ? "y" : "ies"}.`;
      }
    },
    {
      key: "session_source_files_missing_thread",
      label: "Session source rows without threads",
      description: "Tracked source files should keep a matching thread when thread_id is present.",
      severity: "warning",
      sql: `
        SELECT session_source_files.source_path, session_source_files.thread_id
        FROM session_source_files
        LEFT JOIN threads
          ON threads.id = session_source_files.thread_id
        WHERE session_source_files.thread_id IS NOT NULL
          AND threads.id IS NULL
      `,
      mapSampleRef(row) {
        return createSampleRef(`${row.thread_id} -> ${row.source_path}`);
      },
      passMessage: "Tracked source file rows are attached to existing threads.",
      failMessage(count) {
        return `Detected ${count} tracked source file row${count === 1 ? "" : "s"} pointing to missing threads.`;
      }
    },
    {
      key: "validation_logs_missing_sync_run",
      label: "Validation logs without sync runs",
      description: "Import validation logs should keep a matching sync_run record.",
      severity: "warning",
      sql: `
        SELECT import_validation_logs.id, import_validation_logs.sync_run_id
        FROM import_validation_logs
        LEFT JOIN sync_runs
          ON sync_runs.id = import_validation_logs.sync_run_id
        WHERE sync_runs.id IS NULL
      `,
      mapSampleRef(row) {
        return createSampleRef(`${row.id} -> ${row.sync_run_id}`);
      },
      passMessage: "All validation logs are attached to sync runs.",
      failMessage(count) {
        return `Detected ${count} validation log row${count === 1 ? "" : "s"} pointing to missing sync runs.`;
      }
    },
    {
      key: "threads_without_turns",
      label: "Threads without turns",
      description: "Imported threads should contain at least one stored turn.",
      severity: "warning",
      sql: `
        SELECT threads.id
        FROM threads
        LEFT JOIN turns
          ON turns.thread_id = threads.id
        GROUP BY threads.id
        HAVING COUNT(turns.id) = 0
      `,
      mapSampleRef(row) {
        return createThreadSampleRef(row.id);
      },
      passMessage: "All threads contain at least one turn.",
      failMessage(count) {
        return `Detected ${count} thread${count === 1 ? "" : "s"} without turns.`;
      }
    },
    {
      key: "turns_without_items",
      label: "Turns without items",
      description: "Each turn should contain at least one stored item.",
      severity: "error",
      sql: `
        SELECT turns.id, turns.thread_id
        FROM turns
        LEFT JOIN items
          ON items.turn_id = turns.id
        GROUP BY turns.id, turns.thread_id
        HAVING COUNT(items.id) = 0
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All turns contain at least one stored item.",
      failMessage(count) {
        return `Detected ${count} turn${count === 1 ? "" : "s"} without items.`;
      }
    },
    {
      key: "completed_turns_without_user_message",
      label: "Completed turns without user messages",
      description: "Completed turns should keep at least one user message item.",
      severity: "warning",
      sql: `
        SELECT turns.id, turns.thread_id
        FROM turns
        WHERE turns.status = 'completed'
          AND NOT EXISTS (
            SELECT 1
            FROM items
            WHERE items.turn_id = turns.id
              AND items.role = 'user'
              AND items.kind = 'message'
              AND COALESCE(items.text_content, '') <> ''
          )
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All completed turns contain a stored user message.",
      failMessage(count) {
        return `Detected ${count} completed turn${count === 1 ? "" : "s"} missing user messages.`;
      }
    },
    {
      key: "completed_turns_without_final_answer",
      label: "Completed turns without assistant answers",
      description: "Completed turns should keep at least one assistant answer message.",
      severity: "warning",
      sql: `
        SELECT turns.id, turns.thread_id
        FROM turns
        WHERE turns.status = 'completed'
          AND NOT EXISTS (
            SELECT 1
            FROM items
            WHERE items.turn_id = turns.id
              AND items.role = 'assistant'
              AND items.kind LIKE 'message%'
              AND COALESCE(items.text_content, '') <> ''
          )
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All completed turns contain a stored assistant answer.",
      failMessage(count) {
        return `Detected ${count} completed turn${count === 1 ? "" : "s"} missing assistant answers.`;
      }
    },
    {
      key: "negative_turn_token_usage",
      label: "Turns with negative token usage",
      description: "Turn token counters should never be negative.",
      severity: "error",
      sql: `
        SELECT id, thread_id
        FROM turns
        WHERE input_tokens < 0
          OR cached_input_tokens < 0
          OR output_tokens < 0
          OR reasoning_output_tokens < 0
          OR total_tokens < 0
          OR token_event_count < 0
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All token counters are non-negative.",
      failMessage(count) {
        return `Detected ${count} turn${count === 1 ? "" : "s"} with negative token counters.`;
      }
    },
    {
      key: "cached_tokens_exceed_input",
      label: "Turns where cached input exceeds input",
      description: "cached_input_tokens should be a subset of input_tokens.",
      severity: "error",
      sql: `
        SELECT id, thread_id
        FROM turns
        WHERE cached_input_tokens > input_tokens
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All cached token counts are within input token counts.",
      failMessage(count) {
        return `Detected ${count} turn${count === 1 ? "" : "s"} storing cached tokens above input tokens.`;
      }
    },
    {
      key: "total_tokens_below_components",
      label: "Turns where total tokens are below component counts",
      description: "total_tokens should not be lower than the stored token components.",
      severity: "warning",
      sql: `
        SELECT id, thread_id
        FROM turns
        WHERE total_tokens < input_tokens
          OR total_tokens < output_tokens
          OR total_tokens < cached_input_tokens
          OR total_tokens < reasoning_output_tokens
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All total token counts are at least as large as stored components.",
      failMessage(count) {
        return `Detected ${count} turn${count === 1 ? "" : "s"} storing total tokens below component counts.`;
      }
    },
    {
      key: "token_usage_without_events",
      label: "Turns with token totals but zero token events",
      description: "Non-zero token totals should usually have at least one token event.",
      severity: "warning",
      sql: `
        SELECT id, thread_id
        FROM turns
        WHERE token_event_count = 0
          AND (
            input_tokens > 0
            OR cached_input_tokens > 0
            OR output_tokens > 0
            OR reasoning_output_tokens > 0
            OR total_tokens > 0
          )
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All non-zero token totals have token events.",
      failMessage(count) {
        return `Detected ${count} turn${count === 1 ? "" : "s"} storing token totals without token events.`;
      }
    },
    {
      key: "turns_completed_before_started",
      label: "Turns completed before they started",
      description: "completed_at should not be earlier than started_at.",
      severity: "error",
      sql: `
        SELECT id, thread_id
        FROM turns
        WHERE started_at IS NOT NULL
          AND completed_at IS NOT NULL
          AND completed_at < started_at
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All turn timestamps keep completed_at after started_at.",
      failMessage(count) {
        return `Detected ${count} turn${count === 1 ? "" : "s"} with completed_at earlier than started_at.`;
      }
    },
    {
      key: "turns_last_seen_before_activity",
      label: "Turns where last seen precedes activity",
      description: "last_seen_at should not be earlier than the turn start or completion time.",
      severity: "warning",
      sql: `
        SELECT id, thread_id
        FROM turns
        WHERE last_seen_at IS NOT NULL
          AND (
            (completed_at IS NOT NULL AND last_seen_at < completed_at)
            OR (completed_at IS NULL AND started_at IS NOT NULL AND last_seen_at < started_at)
          )
      `,
      mapSampleRef(row) {
        return createTurnSampleRef(row);
      },
      passMessage: "All turn last-seen timestamps are aligned with activity timestamps.",
      failMessage(count) {
        return `Detected ${count} turn${count === 1 ? "" : "s"} with last_seen_at earlier than activity timestamps.`;
      }
    },
    {
      key: "threads_last_seen_before_activity",
      label: "Threads where last seen precedes activity",
      description: "thread.last_seen_at should not be earlier than created_at or updated_at.",
      severity: "warning",
      sql: `
        SELECT id
        FROM threads
        WHERE last_seen_at IS NOT NULL
          AND (
            (updated_at IS NOT NULL AND last_seen_at < updated_at)
            OR (updated_at IS NULL AND created_at IS NOT NULL AND last_seen_at < created_at)
          )
      `,
      mapSampleRef(row) {
        return createThreadSampleRef(row.id);
      },
      passMessage: "All thread last-seen timestamps are aligned with activity timestamps.",
      failMessage(count) {
        return `Detected ${count} thread${count === 1 ? "" : "s"} with last_seen_at earlier than activity timestamps.`;
      }
    }
  ];

  const checks = queryChecks.map((definition) => createQueryCheck(database, definition));

  checks.push(
    createOrdinalContinuityCheck({
      rows: runQuery(
        database,
        `
          SELECT thread_id, ordinal
          FROM turns
          ORDER BY thread_id ASC, ordinal ASC
        `
      ),
      parentKey: "thread_id",
      ordinalKey: "ordinal",
      key: "turn_ordinals_not_contiguous",
      label: "Threads with non-contiguous turn ordinals",
      description: "Turn ordinals should be a 1-based contiguous sequence inside each thread."
    })
  );

  checks.push(
    createOrdinalContinuityCheck({
      rows: runQuery(
        database,
        `
          SELECT turn_id, ordinal
          FROM items
          ORDER BY turn_id ASC, ordinal ASC
        `
      ),
      parentKey: "turn_id",
      ordinalKey: "ordinal",
      key: "item_ordinals_not_contiguous",
      label: "Turns with non-contiguous item ordinals",
      description: "Item ordinals should be a 1-based contiguous sequence inside each turn."
    })
  );

  return checks;
}

function runIntegrityCheck(database) {
  const checks = buildIntegrityChecks(database);
  const failedChecks = checks.filter((check) => check.status === "fail");
  const errorCount = failedChecks.filter((check) => check.severity === "error").length;
  const warningCount = failedChecks.filter((check) => check.severity === "warning").length;

  return {
    checkedAt: new Date().toISOString(),
    summary: {
      totalChecks: checks.length,
      passedChecks: checks.length - failedChecks.length,
      failedChecks: failedChecks.length,
      errorCount,
      warningCount
    },
    checks
  };
}

module.exports = {
  runIntegrityCheck
};

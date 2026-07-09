const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { initializeDatabase } = require("../../electron/db");
const { importCodexSessions } = require("../../electron/importer");

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeJsonLines(filePath, entries) {
  fs.writeFileSync(filePath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function createTestContext() {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "codex-card-feed-test-"));
  const codexHome = path.join(rootPath, ".codex");
  const workspaceRoot = path.join(rootPath, "workspace");
  const sessionsRoot = path.join(codexHome, "sessions", "2026", "07", "10");
  const databasePath = path.join(rootPath, "codex-card-feed.sqlite");
  const sessionId = "thread-1";
  const turnId = "turn-1";
  const sessionFilePath = path.join(
    sessionsRoot,
    "rollout-2026-07-10T00-00-00-00000000-0000-0000-0000-000000000001.jsonl"
  );

  fs.mkdirSync(path.join(workspaceRoot, ".git"), { recursive: true });
  fs.mkdirSync(sessionsRoot, { recursive: true });

  writeJsonLines(path.join(codexHome, "session_index.jsonl"), [
    {
      id: sessionId,
      thread_name: "Card UI thread"
    }
  ]);

  writeJsonFile(path.join(codexHome, ".codex-global-state.json"), {
    "electron-saved-workspace-roots": [workspaceRoot],
    "electron-workspace-root-labels": {
      [workspaceRoot]: "Fixture Workspace"
    }
  });

  writeJsonLines(sessionFilePath, [
    {
      type: "session_meta",
      timestamp: "2026-07-10T00:00:00.000Z",
      payload: {
        session_id: sessionId,
        cwd: workspaceRoot,
        workspace_roots: [workspaceRoot],
        timestamp: "2026-07-10T00:00:00.000Z"
      }
    },
    {
      type: "turn_context",
      timestamp: "2026-07-10T00:00:01.000Z",
      payload: {
        turn_id: turnId,
        workspace_roots: [workspaceRoot]
      }
    },
    {
      type: "event_msg",
      timestamp: "2026-07-10T00:00:02.000Z",
      payload: {
        type: "task_started",
        turn_id: turnId,
        started_at: 1720569602
      }
    },
    {
      type: "response_item",
      timestamp: "2026-07-10T00:00:03.000Z",
      payload: {
        type: "message",
        role: "user",
        text: "# AGENTS.md instructions\nDo not use this as a preview."
      }
    },
    {
      type: "response_item",
      timestamp: "2026-07-10T00:00:04.000Z",
      payload: {
        type: "message",
        role: "user",
        text: "How do I build a card UI?"
      }
    },
    {
      type: "response_item",
      timestamp: "2026-07-10T00:00:05.000Z",
      payload: {
        type: "message",
        role: "assistant",
        phase: "commentary",
        text: "Inspecting the codebase."
      }
    },
    {
      type: "response_item",
      timestamp: "2026-07-10T00:00:06.000Z",
      payload: {
        type: "reasoning",
        summary: ["step"],
        encrypted_content: "abc"
      }
    },
    {
      type: "response_item",
      timestamp: "2026-07-10T00:00:07.000Z",
      payload: {
        type: "message",
        role: "assistant",
        phase: "final_answer",
        text: "Build it with cards and filters."
      }
    },
    {
      type: "event_msg",
      timestamp: "2026-07-10T00:00:08.000Z",
      payload: {
        type: "token_count",
        info: {
          last_token_usage: {
            input_tokens: 10,
            cached_input_tokens: 3,
            output_tokens: 5,
            reasoning_output_tokens: 2,
            total_tokens: 17
          }
        }
      }
    },
    {
      type: "event_msg",
      timestamp: "2026-07-10T00:00:09.000Z",
      payload: {
        type: "task_complete",
        turn_id: turnId,
        completed_at: 1720569609
      }
    }
  ]);

  const databaseState = initializeDatabase(databasePath);

  return {
    codexHome,
    database: databaseState.database,
    databasePath,
    rootPath,
    sessionFilePath,
    sessionId,
    turnId,
    workspaceRoot
  };
}

function createImportedTestContext() {
  const context = createTestContext();
  const importResult = importCodexSessions(context.database, {
    codexHome: context.codexHome
  });

  return {
    ...context,
    importResult
  };
}

function cleanupTestContext(context) {
  if (context?.database && typeof context.database.close === "function") {
    context.database.close();
  }

  if (context?.rootPath) {
    fs.rmSync(context.rootPath, {
      force: true,
      recursive: true
    });
  }
}

module.exports = {
  cleanupTestContext,
  createImportedTestContext,
  createTestContext
};

const { parentPort, workerData } = require("node:worker_threads");
const { getDatabaseOverview, initializeDatabase } = require("./db");
const { runIntegrityCheck } = require("./integrity");
const { importCodexSessions, runSessionDiagnosis } = require("./importer");
const { BACKGROUND_TASK_TYPES } = require("./background-tasks");

function assertParentPort() {
  if (!parentPort) {
    throw new Error("Background task worker requires a parent port.");
  }

  return parentPort;
}

function assertStringValue(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} cannot be empty.`);
  }

  return value;
}

async function runTask() {
  const taskType = workerData?.type;
  const payload = workerData?.payload ?? {};
  const databasePath = assertStringValue(payload.databasePath, "Database path");
  const databaseState = initializeDatabase(databasePath);

  try {
    if (taskType === BACKGROUND_TASK_TYPES.IMPORT_SESSIONS) {
      const codexHome = assertStringValue(payload.codexHome, "Codex source path");
      const result = importCodexSessions(databaseState.database, { codexHome });

      return {
        ...result,
        overview: getDatabaseOverview(databaseState.database)
      };
    }

    if (taskType === BACKGROUND_TASK_TYPES.RUN_INTEGRITY_CHECK) {
      return runIntegrityCheck(databaseState.database);
    }

    if (taskType === BACKGROUND_TASK_TYPES.RUN_SESSION_DIAGNOSIS) {
      const codexHome = assertStringValue(payload.codexHome, "Codex source path");
      return runSessionDiagnosis(databaseState.database, { codexHome });
    }

    throw new Error(`Unsupported background task type "${String(taskType)}".`);
  } finally {
    databaseState.database.close();
  }
}

async function main() {
  const port = assertParentPort();

  try {
    const result = await runTask();
    port.postMessage({
      ok: true,
      result
    });
  } catch (error) {
    port.postMessage({
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null
      }
    });
  }
}

void main();

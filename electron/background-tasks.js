const path = require("node:path");
const { Worker } = require("node:worker_threads");

const BACKGROUND_TASK_TYPES = {
  IMPORT_SESSIONS: "importSessions",
  RUN_INTEGRITY_CHECK: "runIntegrityCheck",
  RUN_SESSION_DIAGNOSIS: "runSessionDiagnosis"
};

const BACKGROUND_TASK_LABELS = {
  [BACKGROUND_TASK_TYPES.IMPORT_SESSIONS]: "session import",
  [BACKGROUND_TASK_TYPES.RUN_INTEGRITY_CHECK]: "data check",
  [BACKGROUND_TASK_TYPES.RUN_SESSION_DIAGNOSIS]: "session diagnosis"
};

function formatBackgroundTaskLabel(taskType) {
  return BACKGROUND_TASK_LABELS[taskType] ?? taskType;
}

function createBackgroundTaskBusyError(actionLabel, taskType) {
  return new Error(
    `${actionLabel} is unavailable while ${formatBackgroundTaskLabel(taskType)} is running.`
  );
}

function createBackgroundTaskRunner(workerScriptPath) {
  let activeTask = null;

  function assertIdle(actionLabel = "This action") {
    if (!activeTask) {
      return;
    }

    throw createBackgroundTaskBusyError(actionLabel, activeTask.type);
  }

  function clearActiveTask(worker) {
    if (activeTask?.worker === worker) {
      activeTask = null;
    }
  }

  function runTask(type, payload = {}) {
    assertIdle("Another background task");

    const worker = new Worker(workerScriptPath, {
      workerData: {
        type,
        payload
      }
    });

    activeTask = {
      type,
      worker,
      startedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      let settled = false;

      function finish(callback) {
        if (settled) {
          return;
        }

        settled = true;
        clearActiveTask(worker);
        callback();
      }

      worker.once("message", (message) => {
        finish(() => {
          if (message?.ok) {
            resolve(message.result);
            return;
          }

          const error = new Error(message?.error?.message ?? "Background task failed.");

          if (message?.error?.stack) {
            error.stack = message.error.stack;
          }

          reject(error);
        });
      });

      worker.once("error", (error) => {
        finish(() => {
          reject(error);
        });
      });

      worker.once("exit", (code) => {
        finish(() => {
          if (code === 0) {
            reject(new Error("Background task worker exited without a result."));
            return;
          }

          reject(new Error(`Background task worker exited with code ${code}.`));
        });
      });
    });
  }

  return {
    assertIdle,
    getActiveTask() {
      return activeTask
        ? {
            type: activeTask.type,
            startedAt: activeTask.startedAt
          }
        : null;
    },
    runImportSessions(payload) {
      return runTask(BACKGROUND_TASK_TYPES.IMPORT_SESSIONS, payload);
    },
    runIntegrityCheck(payload) {
      return runTask(BACKGROUND_TASK_TYPES.RUN_INTEGRITY_CHECK, payload);
    },
    runSessionDiagnosis(payload) {
      return runTask(BACKGROUND_TASK_TYPES.RUN_SESSION_DIAGNOSIS, payload);
    }
  };
}

module.exports = {
  BACKGROUND_TASK_TYPES,
  createBackgroundTaskRunner,
  createBackgroundTaskBusyError,
  defaultWorkerScriptPath: path.join(__dirname, "background-task-worker.js")
};

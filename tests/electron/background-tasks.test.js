const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { listThreads } = require("../../electron/db");
const {
  createBackgroundTaskRunner
} = require("../../electron/background-tasks");
const {
  cleanupTestContext,
  createImportedTestContext,
  createTestContext
} = require("./test-helpers");

const workerScriptPath = path.join(
  __dirname,
  "..",
  "..",
  "electron",
  "background-task-worker.js"
);

test("background import task imports sessions through a worker and returns overview", async () => {
  const context = createTestContext();
  const runner = createBackgroundTaskRunner(workerScriptPath);

  try {
    const result = await runner.runImportSessions({
      databasePath: context.databasePath,
      codexHome: context.codexHome
    });

    assert.equal(result.importedProjects, 1);
    assert.equal(result.importedThreads, 1);
    assert.equal(result.importedTurns, 1);
    assert.equal(result.importedItems, 5);
    assert.equal(result.overview.schemaVersion, "6");
    assert.ok(result.overview.tables.some((table) => table.name === "threads" && table.rowCount === 1));
    assert.ok(result.overview.tables.some((table) => table.name === "turns" && table.rowCount === 1));

    const threads = listThreads(context.database);
    assert.equal(threads.length, 1);
    assert.equal(threads[0].title, "Card UI thread");
  } finally {
    cleanupTestContext(context);
  }
});

test("background diagnosis task returns missing source file issues through a worker", async () => {
  const context = createImportedTestContext();
  const runner = createBackgroundTaskRunner(workerScriptPath);

  try {
    fs.rmSync(context.sessionFilePath, { force: true });

    const report = await runner.runSessionDiagnosis({
      databasePath: context.databasePath,
      codexHome: context.codexHome
    });

    assert.equal(report.summary.sourceProblemCount, 1);
    assert.equal(report.sourceProblems[0].code, "tracked_source_not_found_in_current_scan");
    assert.equal(report.sourceProblems[0].trackedThreadId, context.sessionId);
  } finally {
    cleanupTestContext(context);
  }
});

test("background task runner rejects overlapping jobs while one worker is active", async () => {
  const context = createTestContext();
  const slowWorkerPath = path.join(context.rootPath, "slow-worker.js");
  const runner = createBackgroundTaskRunner(slowWorkerPath);

  fs.writeFileSync(
    slowWorkerPath,
    `
      const { parentPort } = require("node:worker_threads");
      setTimeout(() => {
        parentPort.postMessage({ ok: true, result: { done: true } });
      }, 100);
    `,
    "utf8"
  );

  try {
    const firstTask = runner.runImportSessions({
      databasePath: context.databasePath,
      codexHome: context.codexHome
    });

    assert.throws(
      () =>
        runner.runIntegrityCheck({
          databasePath: context.databasePath
        }),
      /Another background task is unavailable while session import is running\./
    );

    await firstTask;
  } finally {
    cleanupTestContext(context);
  }
});

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const { importCodexSessions } = require("../../electron/importer");
const { runIntegrityCheck } = require("../../electron/integrity");
const {
  listItemsByTurn,
  listProjects,
  listThreads,
  listTurnsByThread,
  saveTurnOverride
} = require("../../electron/db");
const { runSessionDiagnosis } = require("../../electron/importer");
const { cleanupTestContext, createImportedTestContext } = require("./test-helpers");

test("importCodexSessions imports a minimal Codex fixture into projects, threads, turns, and items", () => {
  const context = createImportedTestContext();

  try {
    assert.equal(context.importResult.importedProjects, 1);
    assert.equal(context.importResult.importedThreads, 1);
    assert.equal(context.importResult.importedTurns, 1);
    assert.equal(context.importResult.importedItems, 5);
    assert.equal(context.importResult.errorFiles, 0);
    assert.equal(context.importResult.validationSummary.errorCount, 0);

    const projects = listProjects(context.database);
    assert.equal(projects.length, 1);
    assert.equal(projects[0].displayName, "Fixture Workspace");
    assert.equal(projects[0].sourceDisplayName, "Fixture Workspace");
    assert.equal(projects[0].threadCount, 1);
    assert.equal(projects[0].turnCount, 1);

    const threads = listThreads(context.database);
    assert.equal(threads.length, 1);
    assert.equal(threads[0].id, context.sessionId);
    assert.equal(threads[0].projectDisplayName, "Fixture Workspace");
    assert.equal(threads[0].title, "Card UI thread");
    assert.equal(threads[0].sourceTitle, "Card UI thread");
    assert.equal(threads[0].preview, "How do I build a card UI?");
    assert.equal(threads[0].turnCount, 1);
    assert.equal(threads[0].completedTurnCount, 1);

    const turns = listTurnsByThread(context.database, context.sessionId);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].id, context.turnId);
    assert.equal(turns[0].ordinal, 1);
    assert.equal(turns[0].status, "completed");
    assert.equal(turns[0].firstUserSnippet, "How do I build a card UI?");
    assert.equal(turns[0].firstAssistantSnippet, "Build it with cards and filters.");
    assert.equal(turns[0].searchUserText, "How do I build a card UI?");
    assert.equal(turns[0].searchFinalAnswerText, "Build it with cards and filters.");
    assert.equal(turns[0].modelName, "gpt-5.4");
    assert.equal(turns[0].reasoningEffort, "high");
    assert.equal(turns[0].inputTokens, 10);
    assert.equal(turns[0].cachedInputTokens, 3);
    assert.equal(turns[0].outputTokens, 5);
    assert.equal(turns[0].reasoningOutputTokens, 2);
    assert.equal(turns[0].totalTokens, 17);
    assert.equal(turns[0].tokenEventCount, 1);
    assert.equal(turns[0].itemCount, 5);

    const items = listItemsByTurn(context.database, context.turnId);
    assert.deepEqual(
      items.map((item) => ({
        kind: item.kind,
        role: item.role,
        textContent: item.textContent
      })),
      [
        {
          kind: "message:bootstrap_context",
          role: "user",
          textContent: "# AGENTS.md instructions\nDo not use this as a preview."
        },
        {
          kind: "message",
          role: "user",
          textContent: "How do I build a card UI?"
        },
        {
          kind: "message:commentary",
          role: "assistant",
          textContent: "Inspecting the codebase."
        },
        {
          kind: "reasoning",
          role: "assistant",
          textContent: ""
        },
        {
          kind: "message:final_answer",
          role: "assistant",
          textContent: "Build it with cards and filters."
        }
      ]
    );
  } finally {
    cleanupTestContext(context);
  }
});

test("importCodexSessions forces a full reparse for parser upgrades without clearing local overrides", () => {
  const context = createImportedTestContext();

  try {
    saveTurnOverride(context.database, context.turnId, {
      displayTitle: "Pinned local turn"
    });
    context.database
      .prepare("DELETE FROM app_meta WHERE key = ?")
      .run("codex_card_feed_importer_reparse_version");

    const result = importCodexSessions(context.database, {
      codexHome: context.codexHome
    });
    const turn = listTurnsByThread(context.database, context.sessionId)[0];

    assert.equal(result.rebuiltLibrary, false);
    assert.equal(result.forcedFileReparse, true);
    assert.equal(turn.displayTitle, "Pinned local turn");
    assert.equal(turn.modelName, "gpt-5.4");
    assert.equal(turn.reasoningEffort, "high");
  } finally {
    cleanupTestContext(context);
  }
});

test("runIntegrityCheck passes for the minimal imported fixture", () => {
  const context = createImportedTestContext();

  try {
    const report = runIntegrityCheck(context.database);

    assert.equal(report.summary.failedChecks, 0);
    assert.equal(report.summary.errorCount, 0);
    assert.equal(report.summary.warningCount, 0);
    assert.ok(report.checks.length > 0);
    assert.ok(report.checks.every((check) => check.status === "pass"));
  } finally {
    cleanupTestContext(context);
  }
});

test("runSessionDiagnosis reports a missing tracked source file after the source disappears", () => {
  const context = createImportedTestContext();

  try {
    fs.rmSync(context.sessionFilePath, { force: true });

    const report = runSessionDiagnosis(context.database, {
      codexHome: context.codexHome
    });

    assert.equal(report.summary.trackedFiles, 1);
    assert.equal(report.summary.dbThreads, 1);
    assert.equal(report.summary.sourceProblemCount, 1);
    assert.equal(report.summary.importGapCount, 0);
    assert.equal(report.summary.parseProblemCount, 0);
    assert.equal(report.duplicates.length, 0);
    assert.equal(report.sourceProblems.length, 1);
    assert.equal(report.sourceProblems[0].code, "tracked_source_not_found_in_current_scan");
    assert.equal(report.sourceProblems[0].sourcePath, context.sessionFilePath);
    assert.equal(report.sourceProblems[0].trackedThreadId, context.sessionId);
  } finally {
    cleanupTestContext(context);
  }
});

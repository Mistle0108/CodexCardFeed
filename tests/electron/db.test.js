const assert = require("node:assert/strict");
const test = require("node:test");
const {
  listProjects,
  listThreads,
  listTurnsByThread,
  saveProjectOverride,
  saveThreadOverride,
  saveTurnOverride
} = require("../../electron/db");
const { cleanupTestContext, createImportedTestContext } = require("./test-helpers");

test("project, thread, and turn overrides persist and clear through exported DB APIs", () => {
  const context = createImportedTestContext();

  try {
    const initialProject = listProjects(context.database)[0];
    const initialThread = listThreads(context.database)[0];
    const initialTurn = listTurnsByThread(context.database, context.sessionId)[0];

    saveProjectOverride(context.database, initialProject.id, {
      displayName: "Renamed Workspace",
      isPinned: true,
      tags: ["alpha", "beta"],
      notes: "Project note"
    });

    saveThreadOverride(context.database, initialThread.id, {
      displayTitle: "Renamed Thread",
      isPinned: true,
      tags: ["thread-tag"],
      notes: "Thread note"
    });

    saveTurnOverride(context.database, initialTurn.id, {
      displayTitle: "Renamed Turn",
      isPinned: true,
      tags: ["turn-tag"],
      notes: "Turn note"
    });

    const overriddenProject = listProjects(context.database)[0];
    const overriddenThread = listThreads(context.database)[0];
    const overriddenTurn = listTurnsByThread(context.database, context.sessionId)[0];

    assert.equal(overriddenProject.displayName, "Renamed Workspace");
    assert.equal(overriddenProject.sourceDisplayName, "Fixture Workspace");
    assert.equal(overriddenProject.isPinned, true);
    assert.deepEqual(overriddenProject.tags, ["alpha", "beta"]);
    assert.equal(overriddenProject.notes, "Project note");

    assert.equal(overriddenThread.title, "Renamed Thread");
    assert.equal(overriddenThread.sourceTitle, "Card UI thread");
    assert.equal(overriddenThread.isPinned, true);
    assert.deepEqual(overriddenThread.tags, ["thread-tag"]);
    assert.equal(overriddenThread.notes, "Thread note");

    assert.equal(overriddenTurn.displayTitle, "Renamed Turn");
    assert.equal(overriddenTurn.isPinned, true);
    assert.deepEqual(overriddenTurn.tags, ["turn-tag"]);
    assert.equal(overriddenTurn.notes, "Turn note");

    saveProjectOverride(context.database, initialProject.id, {
      displayName: null,
      isPinned: false,
      tags: [],
      notes: ""
    });

    saveThreadOverride(context.database, initialThread.id, {
      displayTitle: null,
      isPinned: false,
      tags: [],
      notes: ""
    });

    saveTurnOverride(context.database, initialTurn.id, {
      displayTitle: null,
      isPinned: false,
      tags: [],
      notes: ""
    });

    const clearedProject = listProjects(context.database)[0];
    const clearedThread = listThreads(context.database)[0];
    const clearedTurn = listTurnsByThread(context.database, context.sessionId)[0];

    assert.equal(clearedProject.displayName, initialProject.sourceDisplayName);
    assert.equal(clearedProject.isPinned, false);
    assert.deepEqual(clearedProject.tags, []);
    assert.equal(clearedProject.notes, "");

    assert.equal(clearedThread.title, initialThread.sourceTitle);
    assert.equal(clearedThread.isPinned, false);
    assert.deepEqual(clearedThread.tags, []);
    assert.equal(clearedThread.notes, "");

    assert.equal(clearedTurn.displayTitle, null);
    assert.equal(clearedTurn.isPinned, false);
    assert.deepEqual(clearedTurn.tags, []);
    assert.equal(clearedTurn.notes, "");
  } finally {
    cleanupTestContext(context);
  }
});

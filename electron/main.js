const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, dialog, shell } = require("electron");
const { createBackupBundle } = require("./backup");
const { createBackgroundTaskRunner, defaultWorkerScriptPath } = require("./background-tasks");
const {
  getDatabaseOverview,
  initializeDatabase,
  listProjects: listProjectRows,
  listThreads,
  listTurnsByThread,
  listItemsByTurn,
  searchTurns: searchTurnRows,
  saveProjectOverride: persistProjectOverride,
  saveThreadOverride: persistThreadOverride,
  saveTurnOverride: persistTurnOverride
} = require("./db");
const {
  getDefaultCodexHome,
  listSidebarWorkspaceRoots
} = require("./importer");
const { getDefaultDatabasePath, loadPathSettings, persistPathSettings } = require("./path-settings");
const { registerIpcHandlers } = require("./ipc");

let mainWindow = null;
let databaseState = null;
let pathSettings = null;
const backgroundTaskRunner = createBackgroundTaskRunner(defaultWorkerScriptPath);

function normalizePathForComparison(sourcePath) {
  const normalizedWorkspaceRoot = path.normalize(sourcePath);
  return process.platform === "win32"
    ? normalizedWorkspaceRoot.toLowerCase()
    : normalizedWorkspaceRoot;
}

function doesSourceSessionFileExist(sourceSessionPath) {
  if (typeof sourceSessionPath !== "string" || !sourceSessionPath.trim()) {
    return false;
  }

  try {
    return fs.existsSync(sourceSessionPath) && fs.statSync(sourceSessionPath).isFile();
  } catch {
    return false;
  }
}

function getCurrentCodexHome() {
  return pathSettings?.codexHome ?? getDefaultCodexHome();
}

function buildShellInfo() {
  return {
    productName: "CodexCardFeed",
    databasePath: databaseState.databasePath,
    defaultDatabasePath:
      pathSettings?.defaultDatabasePath ?? getDefaultDatabasePath(app.getPath("userData")),
    schemaVersion: databaseState.schemaVersion,
    codexHome: getCurrentCodexHome(),
    defaultCodexHome: pathSettings?.defaultCodexHome ?? getDefaultCodexHome(),
    overview: getDatabaseOverview(databaseState.database),
    runtime: {
      node: process.versions.node,
      chrome: process.versions.chrome,
      electron: process.versions.electron
    }
  };
}

function resolveConfiguredPath(inputValue, label) {
  if (typeof inputValue !== "string" || !inputValue.trim()) {
    throw new Error(`${label} cannot be empty.`);
  }

  return path.resolve(inputValue.trim());
}

function validateCodexHomePath(codexHome) {
  if (!fs.existsSync(codexHome) || !fs.statSync(codexHome).isDirectory()) {
    throw new Error("Codex source path must point to an existing directory.");
  }
}

function validateDatabasePath(databasePath) {
  if (fs.existsSync(databasePath) && fs.statSync(databasePath).isDirectory()) {
    throw new Error("Database path must point to a file, not a directory.");
  }
}

function updateCodexHome(nextCodexHome) {
  backgroundTaskRunner.assertIdle("Changing the Codex source path");

  const resolvedCodexHome = resolveConfiguredPath(nextCodexHome, "Codex source path");
  validateCodexHomePath(resolvedCodexHome);

  const nextPathSettings = {
    ...pathSettings,
    codexHome: resolvedCodexHome
  };

  persistPathSettings(nextPathSettings);
  pathSettings = nextPathSettings;
  return buildShellInfo();
}

function reopenDatabaseAtPath(nextDatabasePath) {
  backgroundTaskRunner.assertIdle("Changing the database path");

  const resolvedDatabasePath = resolveConfiguredPath(nextDatabasePath, "Database path");
  validateDatabasePath(resolvedDatabasePath);

  const currentDatabasePath = databaseState.databasePath;
  const nextPathSettings = {
    ...pathSettings,
    databasePath: resolvedDatabasePath
  };

  if (
    normalizePathForComparison(currentDatabasePath) ===
    normalizePathForComparison(resolvedDatabasePath)
  ) {
    persistPathSettings(nextPathSettings);
    pathSettings = nextPathSettings;
    return buildShellInfo();
  }

  fs.mkdirSync(path.dirname(resolvedDatabasePath), { recursive: true });
  databaseState.database.close();

  let nextDatabaseState = null;

  try {
    if (!fs.existsSync(resolvedDatabasePath) && fs.existsSync(currentDatabasePath)) {
      fs.copyFileSync(currentDatabasePath, resolvedDatabasePath);
    }

    nextDatabaseState = initializeDatabase(resolvedDatabasePath);
    persistPathSettings(nextPathSettings);

    databaseState = nextDatabaseState;
    pathSettings = nextPathSettings;
    return buildShellInfo();
  } catch (error) {
    if (nextDatabaseState && nextDatabaseState.database) {
      nextDatabaseState.database.close();
    }

    databaseState = initializeDatabase(currentDatabasePath);
    throw error;
  }
}

function openCodexThread(threadId) {
  if (typeof threadId !== "string" || !threadId.trim()) {
    throw new Error("Thread ID cannot be empty.");
  }

  return shell.openExternal(`codex://threads/${encodeURIComponent(threadId.trim())}`);
}

async function exportBackupBundle() {
  backgroundTaskRunner.assertIdle("Exporting a backup");

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a folder for the CodexCardFeed backup",
    buttonLabel: "Export backup here",
    properties: ["openDirectory", "createDirectory"]
  });

  if (selection.canceled || !selection.filePaths.length) {
    return {
      canceled: true,
      exportedAt: null,
      backupDirectory: null,
      databaseBackupPath: null,
      settingsBackupPath: null,
      manifestPath: null
    };
  }

  return createBackupBundle({
    database: databaseState.database,
    databasePath: databaseState.databasePath,
    schemaVersion: databaseState.schemaVersion,
    codexHome: getCurrentCodexHome(),
    pathSettings,
    destinationRoot: selection.filePaths[0]
  });
}

async function openBackupBundle() {
  backgroundTaskRunner.assertIdle("Opening a backup");

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a CodexCardFeed backup folder",
    buttonLabel: "Open backup",
    properties: ["openDirectory"]
  });

  if (selection.canceled || !selection.filePaths.length) {
    return {
      canceled: true,
      shellInfo: null,
      backupDirectory: null,
      databaseBackupPath: null,
      settingsBackupPath: null,
      manifestPath: null,
      exportedAt: null,
      suggestedCodexHome: null
    };
  }

  const resolvedBackup = resolveBackupBundle(selection.filePaths[0]);
  const nextShellInfo = reopenDatabaseAtPath(resolvedBackup.databaseBackupPath);

  return {
    canceled: false,
    shellInfo: nextShellInfo,
    ...resolvedBackup
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#efe7d4",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    return;
  }

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  pathSettings = loadPathSettings(app.getPath("userData"), getDefaultCodexHome());
  databaseState = initializeDatabase(pathSettings.databasePath);

  registerIpcHandlers({
    getShellInfo() {
      return buildShellInfo();
    },
    importSessions() {
      return backgroundTaskRunner.runImportSessions({
        databasePath: databaseState.databasePath,
        codexHome: getCurrentCodexHome()
      });
    },
    exportBackupBundle() {
      return exportBackupBundle();
    },
    openBackupBundle() {
      return openBackupBundle();
    },
    openCodexThread(threadId) {
      return openCodexThread(threadId);
    },
    saveProjectOverride(projectId, changes) {
      backgroundTaskRunner.assertIdle("Saving local metadata");
      return persistProjectOverride(databaseState.database, projectId, changes);
    },
    saveThreadOverride(threadId, changes) {
      backgroundTaskRunner.assertIdle("Saving local metadata");
      return persistThreadOverride(databaseState.database, threadId, changes);
    },
    saveTurnOverride(turnId, changes) {
      backgroundTaskRunner.assertIdle("Saving local metadata");
      return persistTurnOverride(databaseState.database, turnId, changes);
    },
    updateCodexHome(codexHome) {
      return updateCodexHome(codexHome);
    },
    resetCodexHome() {
      return updateCodexHome(pathSettings.defaultCodexHome);
    },
    updateDatabasePath(databasePath) {
      return reopenDatabaseAtPath(databasePath);
    },
    resetDatabasePath() {
      return reopenDatabaseAtPath(pathSettings.defaultDatabasePath);
    },
    runIntegrityCheck() {
      return backgroundTaskRunner.runIntegrityCheck({
        databasePath: databaseState.databasePath
      });
    },
    runSessionDiagnosis() {
      return backgroundTaskRunner.runSessionDiagnosis({
        databasePath: databaseState.databasePath,
        codexHome: getCurrentCodexHome()
      });
    },
    listProjects() {
      const sidebarWorkspaceRoots = new Set(
        listSidebarWorkspaceRoots(getCurrentCodexHome()).map(normalizePathForComparison)
      );

      return listProjectRows(databaseState.database).map((project) => {
        const normalizedProjectPath = normalizePathForComparison(project.sourcePath);
        const hasCurrentSourceSession = project.sourceSessionPaths.some((sourceSessionPath) =>
          doesSourceSessionFileExist(sourceSessionPath)
        );
        const projectStatus = sidebarWorkspaceRoots.has(normalizedProjectPath)
          ? "active"
          : hasCurrentSourceSession
            ? "historical"
            : "removed";

        return {
          ...project,
          projectStatus
        };
      });
    },
    listThreads(projectId) {
      return listThreads(databaseState.database, projectId ?? null);
    },
    listTurns(threadId) {
      return listTurnsByThread(databaseState.database, threadId);
    },
    listTurnItems(turnId) {
      return listItemsByTurn(databaseState.database, turnId);
    },
    searchTurns(query, options) {
      return searchTurnRows(databaseState.database, query, options);
    }
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (databaseState && databaseState.database) {
    databaseState.database.close();
  }
});

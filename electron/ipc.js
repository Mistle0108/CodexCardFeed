const { ipcMain } = require("electron");

function registerIpcHandlers({
  getShellInfo,
  importSessions,
  openCodexThread,
  exportBackupBundle,
  saveProjectOverride,
  saveThreadOverride,
  saveTurnOverride,
  updateCodexHome,
  resetCodexHome,
  updateDatabasePath,
  resetDatabasePath,
  runIntegrityCheck,
  runSessionDiagnosis,
  listProjects,
  listThreads,
  listTurns,
  listTurnItems
}) {
  ipcMain.handle("app:get-shell-info", () => {
    return getShellInfo();
  });

  ipcMain.handle("app:import-codex-sessions", async () => {
    return importSessions();
  });

  ipcMain.handle("app:open-codex-thread", (_event, threadId) => {
    return openCodexThread(threadId);
  });

  ipcMain.handle("app:export-backup-bundle", () => {
    return exportBackupBundle();
  });

  ipcMain.handle("app:save-thread-override", (_event, threadId, changes) => {
    return saveThreadOverride(threadId, changes);
  });

  ipcMain.handle("app:save-project-override", (_event, projectId, changes) => {
    return saveProjectOverride(projectId, changes);
  });

  ipcMain.handle("app:save-turn-override", (_event, turnId, changes) => {
    return saveTurnOverride(turnId, changes);
  });

  ipcMain.handle("app:update-codex-home", (_event, codexHome) => {
    return updateCodexHome(codexHome);
  });

  ipcMain.handle("app:reset-codex-home", () => {
    return resetCodexHome();
  });

  ipcMain.handle("app:update-database-path", (_event, databasePath) => {
    return updateDatabasePath(databasePath);
  });

  ipcMain.handle("app:reset-database-path", () => {
    return resetDatabasePath();
  });

  ipcMain.handle("library:run-integrity-check", () => {
    return runIntegrityCheck();
  });

  ipcMain.handle("library:run-session-diagnosis", () => {
    return runSessionDiagnosis();
  });

  ipcMain.handle("library:list-projects", () => {
    return listProjects();
  });

  ipcMain.handle("library:list-threads", (_event, projectId) => {
    return listThreads(projectId);
  });

  ipcMain.handle("library:list-turns", (_event, threadId) => {
    return listTurns(threadId);
  });

  ipcMain.handle("library:list-turn-items", (_event, turnId) => {
    return listTurnItems(turnId);
  });
}

module.exports = {
  registerIpcHandlers
};

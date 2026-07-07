const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexCardFeed", {
  getShellInfo() {
    return ipcRenderer.invoke("app:get-shell-info");
  },
  importCodexSessions() {
    return ipcRenderer.invoke("app:import-codex-sessions");
  },
  openCodexThread(threadId) {
    return ipcRenderer.invoke("app:open-codex-thread", threadId);
  },
  saveProjectOverride(projectId, changes) {
    return ipcRenderer.invoke("app:save-project-override", projectId, changes);
  },
  saveThreadOverride(threadId, changes) {
    return ipcRenderer.invoke("app:save-thread-override", threadId, changes);
  },
  saveTurnOverride(turnId, changes) {
    return ipcRenderer.invoke("app:save-turn-override", turnId, changes);
  },
  updateCodexHome(codexHome) {
    return ipcRenderer.invoke("app:update-codex-home", codexHome);
  },
  resetCodexHome() {
    return ipcRenderer.invoke("app:reset-codex-home");
  },
  updateDatabasePath(databasePath) {
    return ipcRenderer.invoke("app:update-database-path", databasePath);
  },
  resetDatabasePath() {
    return ipcRenderer.invoke("app:reset-database-path");
  },
  runIntegrityCheck() {
    return ipcRenderer.invoke("library:run-integrity-check");
  },
  runSessionDiagnosis() {
    return ipcRenderer.invoke("library:run-session-diagnosis");
  },
  listProjects() {
    return ipcRenderer.invoke("library:list-projects");
  },
  listThreads(projectId) {
    return ipcRenderer.invoke("library:list-threads", projectId);
  },
  listTurns(threadId) {
    return ipcRenderer.invoke("library:list-turns", threadId);
  },
  listTurnItems(turnId) {
    return ipcRenderer.invoke("library:list-turn-items", turnId);
  }
});

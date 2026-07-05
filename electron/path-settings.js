const fs = require("node:fs");
const path = require("node:path");

const DATABASE_FILE_NAME = "codex-card-feed.sqlite";
const PATH_SETTINGS_FILE_NAME = "codex-card-feed-settings.json";

function getDefaultDatabasePath(userDataPath) {
  return path.join(userDataPath, DATABASE_FILE_NAME);
}

function getPathSettingsFilePath(userDataPath) {
  return path.join(userDataPath, PATH_SETTINGS_FILE_NAME);
}

function resolveStoredPath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return path.resolve(value.trim());
}

function loadPathSettings(userDataPath, defaultCodexHome) {
  const settingsFilePath = getPathSettingsFilePath(userDataPath);
  const defaultDatabasePath = getDefaultDatabasePath(userDataPath);
  let storedSettings = {};

  if (fs.existsSync(settingsFilePath)) {
    try {
      storedSettings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    } catch {
      storedSettings = {};
    }
  }

  return {
    settingsFilePath,
    userDataPath,
    defaultCodexHome: path.resolve(defaultCodexHome),
    defaultDatabasePath: path.resolve(defaultDatabasePath),
    codexHome: resolveStoredPath(storedSettings.codexHome) ?? path.resolve(defaultCodexHome),
    databasePath:
      resolveStoredPath(storedSettings.databasePath) ?? path.resolve(defaultDatabasePath)
  };
}

function persistPathSettings(pathSettings) {
  const storedSettings = {};

  if (pathSettings.codexHome !== pathSettings.defaultCodexHome) {
    storedSettings.codexHome = pathSettings.codexHome;
  }

  if (pathSettings.databasePath !== pathSettings.defaultDatabasePath) {
    storedSettings.databasePath = pathSettings.databasePath;
  }

  fs.mkdirSync(path.dirname(pathSettings.settingsFilePath), { recursive: true });
  fs.writeFileSync(
    pathSettings.settingsFilePath,
    JSON.stringify(storedSettings, null, 2),
    "utf8"
  );
}

module.exports = {
  getDefaultDatabasePath,
  loadPathSettings,
  persistPathSettings
};

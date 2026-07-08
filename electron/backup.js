const fs = require("node:fs");
const path = require("node:path");

const { buildStoredPathSettings } = require("./path-settings");

function formatBackupDirectoryName(exportedAt) {
  const safeTimestamp = exportedAt.replace(/[:.]/g, "-");
  return `codex-card-feed-backup-${safeTimestamp}`;
}

function escapeSqliteString(value) {
  return value.replace(/'/g, "''");
}

function createBackupBundle({
  database,
  databasePath,
  schemaVersion,
  codexHome,
  pathSettings,
  destinationRoot
}) {
  const exportedAt = new Date().toISOString();
  const backupDirectory = path.join(destinationRoot, formatBackupDirectoryName(exportedAt));
  const databaseBackupPath = path.join(backupDirectory, "codex-card-feed.sqlite");
  const settingsBackupPath = path.join(backupDirectory, "codex-card-feed-settings.json");
  const manifestPath = path.join(backupDirectory, "backup-manifest.json");
  const storedPathSettings = buildStoredPathSettings(pathSettings);

  fs.mkdirSync(backupDirectory, { recursive: true });
  database.exec(`VACUUM INTO '${escapeSqliteString(databaseBackupPath)}'`);
  fs.writeFileSync(
    settingsBackupPath,
    JSON.stringify(storedPathSettings, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        exportedAt,
        productName: "CodexCardFeed",
        schemaVersion,
        sourceDatabasePath: databasePath,
        sourceCodexHome: codexHome,
        sourceSettingsFilePath: pathSettings.settingsFilePath,
        files: {
          database: path.basename(databaseBackupPath),
          settings: path.basename(settingsBackupPath),
          manifest: path.basename(manifestPath)
        }
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    canceled: false,
    exportedAt,
    backupDirectory,
    databaseBackupPath,
    settingsBackupPath,
    manifestPath
  };
}

module.exports = {
  createBackupBundle
};

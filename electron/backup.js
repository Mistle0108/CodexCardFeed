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

function readJsonFileIfPresent(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${label}.`);
  }
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

function resolveBackupBundle(backupDirectory) {
  const resolvedBackupDirectory = path.resolve(backupDirectory);

  if (
    !fs.existsSync(resolvedBackupDirectory) ||
    !fs.statSync(resolvedBackupDirectory).isDirectory()
  ) {
    throw new Error("Selected backup folder does not exist.");
  }

  const manifestPath = path.join(resolvedBackupDirectory, "backup-manifest.json");
  const manifest = readJsonFileIfPresent(manifestPath, "backup manifest");
  const databaseFileName =
    manifest?.files && typeof manifest.files.database === "string"
      ? manifest.files.database
      : "codex-card-feed.sqlite";
  const settingsFileName =
    manifest?.files && typeof manifest.files.settings === "string"
      ? manifest.files.settings
      : "codex-card-feed-settings.json";
  const databaseBackupPath = path.join(resolvedBackupDirectory, databaseFileName);
  const settingsBackupPath = path.join(resolvedBackupDirectory, settingsFileName);

  if (!fs.existsSync(databaseBackupPath) || !fs.statSync(databaseBackupPath).isFile()) {
    throw new Error("Selected backup folder does not contain codex-card-feed.sqlite.");
  }

  const hasSettingsFile =
    fs.existsSync(settingsBackupPath) && fs.statSync(settingsBackupPath).isFile();
  const suggestedCodexHome =
    typeof manifest?.sourceCodexHome === "string" && manifest.sourceCodexHome.trim()
      ? path.resolve(manifest.sourceCodexHome)
      : null;

  return {
    backupDirectory: resolvedBackupDirectory,
    databaseBackupPath,
    settingsBackupPath: hasSettingsFile ? settingsBackupPath : null,
    manifestPath:
      fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile() ? manifestPath : null,
    exportedAt: typeof manifest?.exportedAt === "string" ? manifest.exportedAt : null,
    suggestedCodexHome
  };
}

module.exports = {
  createBackupBundle,
  resolveBackupBundle
};

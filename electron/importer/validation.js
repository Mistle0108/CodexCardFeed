function incrementTypeCount(bucket, key) {
  if (!bucket) {
    return;
  }

  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}

function createValidationState() {
  return {
    warnings: [],
    errors: [],
    issueKeys: new Set(),
    observedTypes: {
      topLevel: new Map(),
      eventMsg: new Map(),
      responseItem: new Map()
    },
    stats: {
      sessionIndexLineCount: 0,
      validSessionIndexEntryCount: 0,
      invalidSessionIndexLineCount: 0,
      globalStateReadCount: 0
    }
  };
}

function addValidationIssue(validationState, severity, issue) {
  if (!validationState) {
    return;
  }

  const issueKey =
    issue.dedupeKey ??
    [
      severity,
      issue.scope ?? "",
      issue.filePath ?? "",
      issue.code ?? "",
      issue.lineNumber ?? "",
      issue.field ?? "",
      issue.typeName ?? ""
    ].join("|");

  if (validationState.issueKeys.has(issueKey)) {
    return;
  }

  validationState.issueKeys.add(issueKey);

  const entry = {
    scope: issue.scope ?? "import",
    filePath: issue.filePath ?? null,
    code: issue.code ?? "unknown_validation_issue",
    message: issue.message ?? "",
    lineNumber: issue.lineNumber ?? null
  };

  if (severity === "error") {
    validationState.errors.push(entry);
    return;
  }

  validationState.warnings.push(entry);
}

function addValidationWarning(validationState, issue) {
  addValidationIssue(validationState, "warning", issue);
}

function addValidationError(validationState, issue) {
  addValidationIssue(validationState, "error", issue);
}

function toTypeCountRows(typeMap) {
  return [...typeMap.entries()]
    .sort((left, right) => {
      if (left[1] !== right[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .map(([type, count]) => ({
      type,
      count
    }));
}

function buildValidationSummary(validationState) {
  return {
    warningCount: validationState.warnings.length,
    errorCount: validationState.errors.length,
    sessionIndex: {
      lineCount: validationState.stats.sessionIndexLineCount,
      validEntryCount: validationState.stats.validSessionIndexEntryCount,
      invalidLineCount: validationState.stats.invalidSessionIndexLineCount
    },
    globalState: {
      readCount: validationState.stats.globalStateReadCount
    },
    observedTypes: {
      topLevel: toTypeCountRows(validationState.observedTypes.topLevel),
      eventMsg: toTypeCountRows(validationState.observedTypes.eventMsg),
      responseItem: toTypeCountRows(validationState.observedTypes.responseItem)
    }
  };
}

function listValidationLogEntries(validationState) {
  return [
    ...validationState.warnings.map((entry) => ({
      ...entry,
      severity: "warning"
    })),
    ...validationState.errors.map((entry) => ({
      ...entry,
      severity: "error"
    }))
  ];
}

module.exports = {
  incrementTypeCount,
  createValidationState,
  addValidationWarning,
  addValidationError,
  buildValidationSummary,
  listValidationLogEntries
};

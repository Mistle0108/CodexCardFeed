type DiagnosticsModalProps = {
  isOpen: boolean;
  isIntegrityChecking: boolean;
  isSessionDiagnosisRunning: boolean;
  integrityReport: IntegrityReport | null;
  sessionDiagnosisReport: SessionDiagnosisReport | null;
  expandedIntegrityReferenceKeys: Record<string, boolean>;
  formatDateTime: (value: string | null) => string;
  formatInteger: (value: number) => string;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  formatTotalAndNewLabel: (totalCount: number, newCount: number, singular: string) => string;
  formatSuggestedActionLabel: (
    value: SessionDiagnosisIssue["suggestedAction"]
  ) => string;
  onClose: () => void;
  onRunIntegrityCheck: () => void | Promise<void>;
  onRunSessionDiagnosis: () => void | Promise<void>;
  onIntegrityReferenceToggle: (checkKey: string) => void;
  onOpenIntegritySample: (sampleRef: IntegritySampleRef) => void;
};

type DiagnosisIssueSectionProps = {
  title: string;
  issues: SessionDiagnosisIssue[];
  newCount: number;
  emptyMessage: string;
  formatDateTime: (value: string | null) => string;
  formatSuggestedActionLabel: (
    value: SessionDiagnosisIssue["suggestedAction"]
  ) => string;
  formatTotalAndNewLabel: (totalCount: number, newCount: number, singular: string) => string;
};

function DiagnosisIssueSection({
  title,
  issues,
  newCount,
  emptyMessage,
  formatDateTime,
  formatSuggestedActionLabel,
  formatTotalAndNewLabel
}: DiagnosisIssueSectionProps) {
  return (
    <section className="diagnosis-section">
      <div className="diagnosis-section-header">
        <strong>{title}</strong>
        <span className="mini-meta">
          {formatTotalAndNewLabel(issues.length, newCount, "issue")}
        </span>
      </div>

      {issues.length ? (
        <div className="diagnosis-issue-list">
          {issues.map((issue, issueIndex) => (
            <article
              className="diagnosis-issue-card"
              key={`${issue.code}:${issue.sourcePath ?? issueIndex}`}
            >
              <div className="diagnosis-issue-header">
                <div>
                  <strong>{issue.title}</strong>
                  <p className="diagnosis-issue-message">{issue.message}</p>
                </div>
                <div className="diagnosis-issue-pills">
                  <span
                    className={`integrity-severity-pill ${
                      issue.severity === "error" ? "is-error" : "is-warning"
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <span className="diagnosis-action-pill">
                    {formatSuggestedActionLabel(issue.suggestedAction)}
                  </span>
                </div>
              </div>
              <dl className="diagnosis-meta-grid">
                {issue.sourcePath ? (
                  <div>
                    <dt>Source</dt>
                    <dd>{issue.sourcePath}</dd>
                  </div>
                ) : null}
                {issue.parsedThreadId ? (
                  <div>
                    <dt>Parsed</dt>
                    <dd>{issue.parsedThreadId}</dd>
                  </div>
                ) : null}
                {issue.trackedThreadId ? (
                  <div>
                    <dt>Tracked</dt>
                    <dd>{issue.trackedThreadId}</dd>
                  </div>
                ) : null}
                {issue.trackedStatus ? (
                  <div>
                    <dt>Status</dt>
                    <dd>{issue.trackedStatus}</dd>
                  </div>
                ) : null}
                {issue.lastImportedAt ? (
                  <div>
                    <dt>Imported</dt>
                    <dd>{formatDateTime(issue.lastImportedAt)}</dd>
                  </div>
                ) : null}
                {issue.relatedThreadIds.length ? (
                  <div className="is-stacked">
                    <dt>Threads</dt>
                    <dd>
                      <ul className="detail-query-list">
                        {issue.relatedThreadIds.map((threadId) => (
                          <li key={`${issue.code}:${threadId}`}>{threadId}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
                {issue.lastError ? (
                  <div>
                    <dt>Last error</dt>
                    <dd>{issue.lastError}</dd>
                  </div>
                ) : null}
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state integrity-empty-state">{emptyMessage}</p>
      )}
    </section>
  );
}

export function DiagnosticsModal({
  isOpen,
  isIntegrityChecking,
  isSessionDiagnosisRunning,
  integrityReport,
  sessionDiagnosisReport,
  expandedIntegrityReferenceKeys,
  formatDateTime,
  formatInteger,
  formatCountLabel,
  formatTotalAndNewLabel,
  formatSuggestedActionLabel,
  onClose,
  onRunIntegrityCheck,
  onRunSessionDiagnosis,
  onIntegrityReferenceToggle,
  onOpenIntegritySample
}: DiagnosticsModalProps) {
  if (!isOpen) {
    return null;
  }

  const integrityFailedChecks =
    integrityReport?.checks.filter((check) => check.status === "fail") ?? [];
  const integrityPassedChecks =
    integrityReport?.checks.filter((check) => check.status === "pass") ?? [];
  const sessionDiagnosisIssues = sessionDiagnosisReport
    ? [
        ...sessionDiagnosisReport.duplicates,
        ...sessionDiagnosisReport.importGaps,
        ...sessionDiagnosisReport.sourceProblems,
        ...sessionDiagnosisReport.parseProblems
      ]
    : [];

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <section
        className="card modal-dialog diagnostics-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="workspace-kicker">Diagnostics</p>
            <h2>Data check and session diagnosis</h2>
            <p className="muted">
              Inspect DB consistency and Codex session import tracking in one place.
            </p>
          </div>
          <div className="modal-header-actions">
            <button
              className="secondary-button"
              disabled={isIntegrityChecking}
              onClick={() => void onRunIntegrityCheck()}
              type="button"
            >
              {isIntegrityChecking ? "Checking..." : "Data check"}
            </button>
            <button
              className="secondary-button"
              disabled={isSessionDiagnosisRunning}
              onClick={() => void onRunSessionDiagnosis()}
              type="button"
            >
              {isSessionDiagnosisRunning ? "Diagnosing..." : "Session diagnosis"}
            </button>
            <button className="modal-close" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="modal-scroll">
          <div className="detail-body">
            <section className="integrity-section">
              <div className="integrity-section-header">
                <div>
                  <strong>Data check</strong>
                  <p className="integrity-check-description">
                    {integrityReport
                      ? `Last checked ${formatDateTime(integrityReport.checkedAt)}`
                      : "Run a data check to inspect turn, thread, and token consistency."}
                  </p>
                </div>
              </div>

              {integrityReport ? (
                <dl className="integrity-summary-grid">
                  <div>
                    <dt>Total checks</dt>
                    <dd>{formatInteger(integrityReport.summary.totalChecks)}</dd>
                  </div>
                  <div>
                    <dt>Passed</dt>
                    <dd>{formatInteger(integrityReport.summary.passedChecks)}</dd>
                  </div>
                  <div>
                    <dt>Failed</dt>
                    <dd>{formatInteger(integrityReport.summary.failedChecks)}</dd>
                  </div>
                  <div>
                    <dt>New issues</dt>
                    <dd>{formatInteger(integrityReport.summary.newIssueCount)}</dd>
                  </div>
                  <div>
                    <dt>Errors</dt>
                    <dd>{formatInteger(integrityReport.summary.errorCount)}</dd>
                  </div>
                  <div>
                    <dt>Warnings</dt>
                    <dd>{formatInteger(integrityReport.summary.warningCount)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="empty-state integrity-empty-state">
                  No data check has been run yet.
                </p>
              )}
            </section>

            {integrityReport ? (
              <section className="integrity-section">
                <div className="integrity-section-header">
                  <strong>Issues</strong>
                  <span className="mini-meta">
                    {formatTotalAndNewLabel(
                      integrityFailedChecks.length,
                      integrityReport.summary.newIssueCount,
                      "check"
                    )}
                  </span>
                </div>

                {integrityFailedChecks.length ? (
                  <div className="integrity-check-list">
                    {integrityFailedChecks.map((check) => {
                      const hasNewReferences = check.newAffectedCount > 0;
                      const isReferenceListExpanded =
                        expandedIntegrityReferenceKeys[check.key] === true;
                      const visibleSampleRefs =
                        hasNewReferences && !isReferenceListExpanded
                          ? check.sampleRefs.slice(0, 5)
                          : check.sampleRefs;
                      const shouldShowReferenceToggle =
                        hasNewReferences && check.sampleRefs.length > 5;

                      return (
                        <article className="integrity-check-card" key={check.key}>
                          <div className="integrity-check-header">
                            <div>
                              <strong>{check.label}</strong>
                              <p className="integrity-check-description">
                                {check.description}
                              </p>
                            </div>
                            <div className="integrity-check-pills">
                              <span
                                className={`integrity-severity-pill ${
                                  check.severity === "error" ? "is-error" : "is-warning"
                                }`}
                              >
                                {check.severity}
                              </span>
                              <span className="count-pill">
                                {`Total ${formatInteger(check.affectedCount)}`}
                              </span>
                              <span className="count-pill count-pill-new">
                                {`New ${formatInteger(check.newAffectedCount)}`}
                              </span>
                            </div>
                          </div>
                          <p className="integrity-check-message">{check.message}</p>
                          {check.sampleRefs.length ? (
                            <div className="integrity-reference-block">
                              <p className="mini-meta integrity-reference-label">
                                {hasNewReferences
                                  ? `${formatCountLabel(
                                      check.newAffectedCount,
                                      "new reference"
                                    )} shown first`
                                  : "Sample references"}
                              </p>
                              <ul className="integrity-sample-list">
                                {visibleSampleRefs.map((sampleRef) => (
                                  <li
                                    key={[
                                      check.key,
                                      sampleRef.label,
                                      sampleRef.threadId ?? "none",
                                      sampleRef.turnId ?? "none"
                                    ].join(":")}
                                  >
                                    {sampleRef.threadId ? (
                                      <button
                                        className={`integrity-sample-link ${
                                          sampleRef.isNew ? "is-new" : ""
                                        }`}
                                        onClick={() => onOpenIntegritySample(sampleRef)}
                                        type="button"
                                      >
                                        {sampleRef.label}
                                      </button>
                                    ) : (
                                      <span
                                        className={
                                          sampleRef.isNew
                                            ? "integrity-sample-text is-new"
                                            : undefined
                                        }
                                      >
                                        {sampleRef.label}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              {shouldShowReferenceToggle ? (
                                <button
                                  className="detail-expand-toggle integrity-reference-toggle"
                                  onClick={() => onIntegrityReferenceToggle(check.key)}
                                  type="button"
                                >
                                  {isReferenceListExpanded
                                    ? "Show less"
                                    : `Show more (${formatInteger(
                                        check.sampleRefs.length - 5
                                      )})`}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-state integrity-empty-state">
                    No integrity issues were detected.
                  </p>
                )}
              </section>
            ) : null}

            {integrityReport ? (
              <section className="integrity-section">
                <div className="integrity-section-header">
                  <strong>Passed checks</strong>
                  <span className="mini-meta">
                    {formatCountLabel(integrityPassedChecks.length, "check")}
                  </span>
                </div>
                <div className="integrity-pass-list">
                  {integrityPassedChecks.map((check) => (
                    <article className="integrity-pass-row" key={check.key}>
                      <strong>{check.label}</strong>
                      <p className="mini-meta">{check.message}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="diagnosis-section">
              <div className="diagnosis-section-header">
                <div>
                  <strong>Session diagnosis</strong>
                  <p className="diagnosis-issue-message">
                    {sessionDiagnosisReport
                      ? `Last checked ${formatDateTime(sessionDiagnosisReport.checkedAt)}`
                      : "Run a session diagnosis to detect import gaps and source tracking problems."}
                  </p>
                </div>
              </div>

              {sessionDiagnosisReport ? (
                <section className="diagnosis-summary-panel">
                  <dl className="diagnosis-summary-grid">
                    <div>
                      <dt>Current files</dt>
                      <dd>{formatInteger(sessionDiagnosisReport.summary.scannedFiles)}</dd>
                    </div>
                    <div>
                      <dt>Tracked files</dt>
                      <dd>{formatInteger(sessionDiagnosisReport.summary.trackedFiles)}</dd>
                    </div>
                    <div>
                      <dt>DB threads</dt>
                      <dd>{formatInteger(sessionDiagnosisReport.summary.dbThreads)}</dd>
                    </div>
                    <div>
                      <dt>Issues</dt>
                      <dd>{formatInteger(sessionDiagnosisReport.summary.totalIssueCount)}</dd>
                    </div>
                    <div>
                      <dt>New issues</dt>
                      <dd>{formatInteger(sessionDiagnosisReport.summary.newTotalIssueCount)}</dd>
                    </div>
                    <div>
                      <dt>Import gaps</dt>
                      <dd>{formatInteger(sessionDiagnosisReport.summary.importGapCount)}</dd>
                    </div>
                    <div>
                      <dt>Duplicates</dt>
                      <dd>{formatInteger(sessionDiagnosisReport.summary.duplicateCount)}</dd>
                    </div>
                  </dl>

                  <dl className="diagnosis-path-grid">
                    <div>
                      <dt>Codex source</dt>
                      <dd>{sessionDiagnosisReport.codexHome}</dd>
                    </div>
                    <div>
                      <dt>Sessions root</dt>
                      <dd>{sessionDiagnosisReport.sessionsRoot}</dd>
                    </div>
                  </dl>
                </section>
              ) : (
                <p className="empty-state integrity-empty-state">
                  No session diagnosis has been run yet.
                </p>
              )}
            </section>

            {sessionDiagnosisReport ? (
              <>
                <DiagnosisIssueSection
                  emptyMessage="No import gaps were detected."
                  formatDateTime={formatDateTime}
                  formatSuggestedActionLabel={formatSuggestedActionLabel}
                  formatTotalAndNewLabel={formatTotalAndNewLabel}
                  issues={sessionDiagnosisReport.importGaps}
                  newCount={sessionDiagnosisReport.summary.newImportGapCount}
                  title="Import gaps"
                />
                <DiagnosisIssueSection
                  emptyMessage="No duplicate DB conflicts were detected."
                  formatDateTime={formatDateTime}
                  formatSuggestedActionLabel={formatSuggestedActionLabel}
                  formatTotalAndNewLabel={formatTotalAndNewLabel}
                  issues={sessionDiagnosisReport.duplicates}
                  newCount={sessionDiagnosisReport.summary.newDuplicateCount}
                  title="Duplicate conflicts"
                />
                <DiagnosisIssueSection
                  emptyMessage="No source tracking problems were detected."
                  formatDateTime={formatDateTime}
                  formatSuggestedActionLabel={formatSuggestedActionLabel}
                  formatTotalAndNewLabel={formatTotalAndNewLabel}
                  issues={sessionDiagnosisReport.sourceProblems}
                  newCount={sessionDiagnosisReport.summary.newSourceProblemCount}
                  title="Source problems"
                />
                <DiagnosisIssueSection
                  emptyMessage="No parse problems were detected."
                  formatDateTime={formatDateTime}
                  formatSuggestedActionLabel={formatSuggestedActionLabel}
                  formatTotalAndNewLabel={formatTotalAndNewLabel}
                  issues={sessionDiagnosisReport.parseProblems}
                  newCount={sessionDiagnosisReport.summary.newParseProblemCount}
                  title="Parse problems"
                />

                {sessionDiagnosisIssues.length === 0 ? (
                  <section className="diagnosis-section">
                    <div className="diagnosis-section-header">
                      <strong>Result</strong>
                    </div>
                    <p className="empty-state integrity-empty-state">
                      Current Codex source files and DB session tracking look consistent.
                    </p>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

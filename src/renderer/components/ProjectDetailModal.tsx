import type { KeyboardEvent as ReactKeyboardEvent } from "react";

type ProjectDetailModalProps = {
  selectedProject: ProjectListItem | null;
  isProjectTitleEditing: boolean;
  projectTitleDraft: string;
  isProjectMetadataCollapsed: boolean;
  projectTagInputDraft: string;
  projectTagsDraft: string[];
  projectNotesDraft: string;
  isSavingProjectOverride: boolean;
  canSaveProjectTitle: boolean;
  canResetProjectTitle: boolean;
  canAddProjectTag: boolean;
  canSaveProjectMemo: boolean;
  canClearProjectMemo: boolean;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  formatDateTime: (value: string | null) => string;
  onClose: () => void;
  onProjectTitleDraftChange: (value: string) => void;
  onStartProjectTitleEdit: () => void;
  onCancelProjectTitleEdit: () => void;
  onSaveProjectTitle: () => void | Promise<void>;
  onResetProjectTitle: () => void | Promise<void>;
  onToggleProjectPin: () => void | Promise<void>;
  onToggleProjectMetadataCollapsed: () => void;
  onAddProjectTag: () => void | Promise<void>;
  onRemoveProjectTag: (tag: string) => void | Promise<void>;
  onProjectTagInputChange: (value: string) => void;
  onProjectTagInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onProjectNotesDraftChange: (value: string) => void;
  onSaveProjectMemo: () => void | Promise<void>;
  onResetProjectMemoDraft: () => void;
  onClearProjectMemo: () => void | Promise<void>;
};

export function ProjectDetailModal({
  selectedProject,
  isProjectTitleEditing,
  projectTitleDraft,
  isProjectMetadataCollapsed,
  projectTagInputDraft,
  projectTagsDraft,
  projectNotesDraft,
  isSavingProjectOverride,
  canSaveProjectTitle,
  canResetProjectTitle,
  canAddProjectTag,
  canSaveProjectMemo,
  canClearProjectMemo,
  formatCountLabel,
  formatDateTime,
  onClose,
  onProjectTitleDraftChange,
  onStartProjectTitleEdit,
  onCancelProjectTitleEdit,
  onSaveProjectTitle,
  onResetProjectTitle,
  onToggleProjectPin,
  onToggleProjectMetadataCollapsed,
  onAddProjectTag,
  onRemoveProjectTag,
  onProjectTagInputChange,
  onProjectTagInputKeyDown,
  onProjectNotesDraftChange,
  onSaveProjectMemo,
  onResetProjectMemoDraft,
  onClearProjectMemo
}: ProjectDetailModalProps) {
  if (!selectedProject) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <section className="card modal-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="workspace-kicker">Project detail</p>
            <h2>{selectedProject.displayName}</h2>
            <p className="muted">Local project metadata and source details.</p>
          </div>
          <div className="modal-header-actions">
            <button className="modal-close" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <div className="modal-scroll">
          <div className="detail-body">
            <section className="detail-meta-panel">
              <div className="detail-management-bar">
                <div className="detail-management-copy">
                  <p className="management-kicker">Local project title</p>
                  {isProjectTitleEditing ? (
                    <input
                      className="management-title-input"
                      onChange={(event) => onProjectTitleDraftChange(event.target.value)}
                      placeholder={selectedProject.sourceDisplayName}
                      type="text"
                      value={projectTitleDraft}
                    />
                  ) : (
                    <strong className="detail-management-title">
                      {selectedProject.displayName}
                    </strong>
                  )}
                  {selectedProject.displayName !== selectedProject.sourceDisplayName ? (
                    <p className="management-subcopy muted">{`Original: ${selectedProject.sourceDisplayName}`}</p>
                  ) : (
                    <p className="management-subcopy muted">No custom project title stored.</p>
                  )}
                </div>
                <div className="detail-management-actions">
                  <button
                    className={`secondary-button ${selectedProject.isPinned ? "is-active" : ""}`}
                    disabled={isSavingProjectOverride}
                    onClick={() => void onToggleProjectPin()}
                    type="button"
                  >
                    {selectedProject.isPinned ? "Unpin" : "Pin"}
                  </button>
                  {isProjectTitleEditing ? (
                    <>
                      <button
                        className="secondary-button"
                        disabled={isSavingProjectOverride || !canSaveProjectTitle}
                        onClick={() => void onSaveProjectTitle()}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="secondary-button"
                        disabled={isSavingProjectOverride}
                        onClick={onCancelProjectTitleEdit}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button"
                      disabled={isSavingProjectOverride}
                      onClick={onStartProjectTitleEdit}
                      type="button"
                    >
                      Edit title
                    </button>
                  )}
                  {canResetProjectTitle ? (
                    <button
                      className="secondary-button"
                      disabled={isSavingProjectOverride}
                      onClick={() => void onResetProjectTitle()}
                      type="button"
                    >
                      Use original
                    </button>
                  ) : null}
                </div>
              </div>

              <section className="local-metadata-panel local-metadata-panel-detail">
                <div className="local-metadata-shell-header">
                  <div>
                    <p className="management-kicker">Local metadata</p>
                    <p className="muted">Tags and memo are stored only in CodexCardFeed.</p>
                  </div>
                  <button
                    aria-expanded={!isProjectMetadataCollapsed}
                    className="secondary-button"
                    onClick={onToggleProjectMetadataCollapsed}
                    type="button"
                  >
                    {isProjectMetadataCollapsed ? "Show" : "Hide"}
                  </button>
                </div>

                {!isProjectMetadataCollapsed ? (
                  <>
                    <div className="metadata-field">
                      <div className="metadata-section-header">
                        <label className="metadata-label" htmlFor="project-tags-input">
                          Tags
                        </label>
                        <div className="metadata-section-actions">
                          <button
                            className="secondary-button"
                            disabled={isSavingProjectOverride || !canAddProjectTag}
                            onClick={() => void onAddProjectTag()}
                            type="button"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <div className="metadata-input-row">
                        <input
                          id="project-tags-input"
                          className="metadata-input"
                          onChange={(event) => onProjectTagInputChange(event.target.value)}
                          onKeyDown={onProjectTagInputKeyDown}
                          placeholder="Add one tag and press Enter"
                          type="text"
                          value={projectTagInputDraft}
                        />
                      </div>
                      {projectTagsDraft.length ? (
                        <div className="tag-chip-list">
                          {projectTagsDraft.map((tag) => (
                            <span className="tag-chip" key={tag}>
                              <span>{tag}</span>
                              <button
                                aria-label={`Remove ${tag} tag`}
                                className="tag-chip-remove"
                                onClick={() => void onRemoveProjectTag(tag)}
                                type="button"
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">No local tags.</p>
                      )}
                    </div>

                    <div className="metadata-field">
                      <div className="metadata-section-header">
                        <label className="metadata-label" htmlFor="project-notes-input">
                          Memo
                        </label>
                        <div className="metadata-section-actions">
                          <button
                            className="secondary-button"
                            disabled={isSavingProjectOverride || !canSaveProjectMemo}
                            onClick={() => void onSaveProjectMemo()}
                            type="button"
                          >
                            Save memo
                          </button>
                          <button
                            className="secondary-button"
                            disabled={isSavingProjectOverride || !canSaveProjectMemo}
                            onClick={onResetProjectMemoDraft}
                            type="button"
                          >
                            Revert memo
                          </button>
                          {canClearProjectMemo ? (
                            <button
                              className="secondary-button"
                              disabled={isSavingProjectOverride}
                              onClick={() => void onClearProjectMemo()}
                              type="button"
                            >
                              Clear memo
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <textarea
                        id="project-notes-input"
                        className="metadata-textarea"
                        onChange={(event) => onProjectNotesDraftChange(event.target.value)}
                        placeholder="Write a local memo for this project."
                        rows={4}
                        value={projectNotesDraft}
                      />
                    </div>
                  </>
                ) : null}
              </section>

              <div className="detail-meta-header">
                <strong>{selectedProject.displayName}</strong>
                <div className="detail-meta-pills">
                  {selectedProject.isPinned ? <span className="pin-pill">Pinned</span> : null}
                  <span className="count-pill">
                    {formatCountLabel(selectedProject.threadCount, "thread")}
                  </span>
                  <span className="count-pill">
                    {formatCountLabel(selectedProject.turnCount, "turn")}
                  </span>
                </div>
              </div>

              <dl className="detail-meta">
                <div>
                  <dt>Status</dt>
                  <dd>{selectedProject.projectStatus}</dd>
                </div>
                <div>
                  <dt>Last activity</dt>
                  <dd>{formatDateTime(selectedProject.lastActivityAt)}</dd>
                </div>
                <div>
                  <dt>Source kind</dt>
                  <dd>{selectedProject.sourceKind}</dd>
                </div>
                <div>
                  <dt>Sessions</dt>
                  <dd>{formatCountLabel(selectedProject.sourceSessionPaths.length, "file")}</dd>
                </div>
                <div>
                  <dt>Source path</dt>
                  <dd>{selectedProject.sourcePath}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

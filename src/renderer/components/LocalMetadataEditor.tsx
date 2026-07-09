import type { KeyboardEvent as ReactKeyboardEvent } from "react";

type LocalMetadataEditorProps = {
  className?: string;
  isCollapsed: boolean;
  isSaving: boolean;
  canAddTag: boolean;
  canSaveMemo: boolean;
  canClearMemo: boolean;
  tagInputId: string;
  tagInputValue: string;
  tagInputPlaceholder: string;
  tags: string[];
  notesInputId: string;
  notesValue: string;
  notesPlaceholder: string;
  notesRows?: number;
  onToggleCollapsed: () => void;
  onTagInputChange: (value: string) => void;
  onTagInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onAddTag: () => void | Promise<void>;
  onRemoveTag: (tag: string) => void | Promise<void>;
  onNotesChange: (value: string) => void;
  onSaveMemo: () => void | Promise<void>;
  onResetMemoDraft: () => void;
  onClearMemo: () => void | Promise<void>;
};

export function LocalMetadataEditor({
  className,
  isCollapsed,
  isSaving,
  canAddTag,
  canSaveMemo,
  canClearMemo,
  tagInputId,
  tagInputValue,
  tagInputPlaceholder,
  tags,
  notesInputId,
  notesValue,
  notesPlaceholder,
  notesRows = 4,
  onToggleCollapsed,
  onTagInputChange,
  onTagInputKeyDown,
  onAddTag,
  onRemoveTag,
  onNotesChange,
  onSaveMemo,
  onResetMemoDraft,
  onClearMemo
}: LocalMetadataEditorProps) {
  const panelClassName = className
    ? `local-metadata-panel ${className}`
    : "local-metadata-panel";

  return (
    <section className={panelClassName}>
      <div className="local-metadata-shell-header">
        <div>
          <p className="management-kicker">Local metadata</p>
          <p className="muted">Tags and memo are stored only in CodexCardFeed.</p>
        </div>
        <button
          aria-expanded={!isCollapsed}
          className="secondary-button"
          onClick={onToggleCollapsed}
          type="button"
        >
          {isCollapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!isCollapsed ? (
        <>
          <div className="metadata-field">
            <div className="metadata-section-header">
              <label className="metadata-label" htmlFor={tagInputId}>
                Tags
              </label>
              <div className="metadata-section-actions">
                <button
                  className="secondary-button"
                  disabled={isSaving || !canAddTag}
                  onClick={() => void onAddTag()}
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="metadata-input-row">
              <input
                id={tagInputId}
                className="metadata-input"
                onChange={(event) => onTagInputChange(event.target.value)}
                onKeyDown={onTagInputKeyDown}
                placeholder={tagInputPlaceholder}
                type="text"
                value={tagInputValue}
              />
            </div>
            {tags.length ? (
              <div className="tag-chip-list">
                {tags.map((tag) => (
                  <span className="tag-chip" key={tag}>
                    <span>{tag}</span>
                    <button
                      aria-label={`Remove ${tag} tag`}
                      className="tag-chip-remove"
                      onClick={() => void onRemoveTag(tag)}
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
              <label className="metadata-label" htmlFor={notesInputId}>
                Memo
              </label>
              <div className="metadata-section-actions">
                <button
                  className="secondary-button"
                  disabled={isSaving || !canSaveMemo}
                  onClick={() => void onSaveMemo()}
                  type="button"
                >
                  Save memo
                </button>
                <button
                  className="secondary-button"
                  disabled={isSaving || !canSaveMemo}
                  onClick={onResetMemoDraft}
                  type="button"
                >
                  Revert memo
                </button>
                {canClearMemo ? (
                  <button
                    className="secondary-button"
                    disabled={isSaving}
                    onClick={() => void onClearMemo()}
                    type="button"
                  >
                    Clear memo
                  </button>
                ) : null}
              </div>
            </div>
            <textarea
              id={notesInputId}
              className="metadata-textarea"
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={notesPlaceholder}
              rows={notesRows}
              value={notesValue}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

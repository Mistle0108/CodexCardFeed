import type { ReactNode } from "react";

type SidebarLibraryContentProps = {
  isMetadataFilterActive: boolean;
  metadataTagFilter: string;
  isPinnedFilterActive: boolean;
  isMemoFilterActive: boolean;
  isProjectsCollapsed: boolean;
  isHistoricalCollapsed: boolean;
  isChatsCollapsed: boolean;
  isLibraryLoading: boolean;
  sidebarProjects: ProjectListItem[];
  activeProjects: ProjectListItem[];
  allHistoricalProjects: ProjectListItem[];
  historicalProjects: ProjectListItem[];
  chatThreads: ThreadListItem[];
  matchingChatThreads: ThreadListItem[];
  matchingProjectThreadsByProjectId: Record<string, ThreadListItem[]>;
  threadsByProjectId: Record<string, ThreadListItem[]>;
  expandedProjectIds: Record<string, boolean>;
  selectedThread: ThreadListItem | null;
  selectedThreadId: string | null;
  normalizedSidebarSearchTerms: string[];
  formatDateTime: (value: string | null) => string;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  formatFilteredCountLabel: (
    visibleCount: number,
    totalCount: number,
    singular: string,
    plural?: string
  ) => string;
  renderHighlightedText: (text: string, searchTerms: string[]) => ReactNode;
  getMatchingTagValues: (tags: string[], searchTerms: string[]) => string[];
  onMetadataTagFilterChange: (value: string) => void;
  onResetMetadataFilters: () => void;
  onTogglePinnedFilter: () => void;
  onToggleMemoFilter: () => void;
  onToggleProjectsCollapsed: () => void;
  onToggleHistoricalCollapsed: () => void;
  onToggleChatsCollapsed: () => void;
  onProjectToggle: (projectId: string) => void;
  onOpenProjectModal: (projectId: string) => void;
  onThreadSelect: (threadId: string) => void;
};

type ProjectSectionProps = {
  title: string;
  sectionClassName: string;
  projects: ProjectListItem[];
  totalProjects: ProjectListItem[];
  isCollapsed: boolean;
  isLoading: boolean;
  isMetadataFilterActive: boolean;
  matchingProjectThreadsByProjectId: Record<string, ThreadListItem[]>;
  threadsByProjectId: Record<string, ThreadListItem[]>;
  expandedProjectIds: Record<string, boolean>;
  selectedThread: ThreadListItem | null;
  selectedThreadId: string | null;
  normalizedSidebarSearchTerms: string[];
  formatDateTime: (value: string | null) => string;
  formatCountLabel: (count: number, singular: string, plural?: string) => string;
  formatFilteredCountLabel: (
    visibleCount: number,
    totalCount: number,
    singular: string,
    plural?: string
  ) => string;
  renderHighlightedText: (text: string, searchTerms: string[]) => ReactNode;
  getMatchingTagValues: (tags: string[], searchTerms: string[]) => string[];
  onToggleCollapsed: () => void;
  onProjectToggle: (projectId: string) => void;
  onOpenProjectModal: (projectId: string) => void;
  onThreadSelect: (threadId: string) => void;
  emptyMessage: string;
  showProjectStatusBadge: boolean;
};

function ProjectSection({
  title,
  sectionClassName,
  projects,
  totalProjects,
  isCollapsed,
  isLoading,
  isMetadataFilterActive,
  matchingProjectThreadsByProjectId,
  threadsByProjectId,
  expandedProjectIds,
  selectedThread,
  selectedThreadId,
  normalizedSidebarSearchTerms,
  formatDateTime,
  formatCountLabel,
  formatFilteredCountLabel,
  renderHighlightedText,
  getMatchingTagValues,
  onToggleCollapsed,
  onProjectToggle,
  onOpenProjectModal,
  onThreadSelect,
  emptyMessage,
  showProjectStatusBadge
}: ProjectSectionProps) {
  return (
    <section className={`sidebar-section ${sectionClassName} ${isCollapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-section-header">
        <div>
          <h2>{title}</h2>
          <p>{formatFilteredCountLabel(projects.length, totalProjects.length, "project")}</p>
        </div>
        <div className="sidebar-section-header-actions">
          {isLoading ? <span className="sidebar-pill">Loading</span> : null}
          <button
            aria-expanded={!isCollapsed}
            className="sidebar-collapse-toggle"
            onClick={onToggleCollapsed}
            type="button"
          >
            {isCollapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!isCollapsed && projects.length ? (
        <div className="sidebar-project-list">
          {projects.map((project) => {
            const visibleProjectThreads = isMetadataFilterActive
              ? (matchingProjectThreadsByProjectId[project.id] ?? [])
              : (threadsByProjectId[project.id] ?? []);
            const isProjectExpanded = isMetadataFilterActive
              ? visibleProjectThreads.length > 0
              : Boolean(expandedProjectIds[project.id]);
            const matchingProjectTags = getMatchingTagValues(
              project.tags,
              normalizedSidebarSearchTerms
            );

            return (
              <article className="sidebar-project-group" key={project.id}>
                <div className="sidebar-project-card">
                  <button
                    className={`sidebar-project-button ${
                      selectedThread?.projectId === project.id ? "is-active" : ""
                    }`}
                    onClick={() => onProjectToggle(project.id)}
                    type="button"
                  >
                    <div className="sidebar-project-heading">
                      <div className="sidebar-project-title-row">
                        <strong>
                          {renderHighlightedText(project.displayName, normalizedSidebarSearchTerms)}
                        </strong>
                        {project.isPinned ? <span className="sidebar-pin-badge">Pinned</span> : null}
                        {showProjectStatusBadge ? (
                          <span
                            className={`sidebar-status-badge ${
                              project.projectStatus === "removed"
                                ? "is-removed"
                                : "is-historical"
                            }`}
                          >
                            {project.projectStatus}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {matchingProjectTags.length ? (
                      <div className="sidebar-search-tag-list">
                        {matchingProjectTags.map((tag) => (
                          <span className="sidebar-search-tag" key={tag}>
                            {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="sidebar-item-meta">
                      <span>
                        {formatCountLabel(project.threadCount, "thread")} /{" "}
                        {formatCountLabel(project.turnCount, "turn")}
                      </span>
                      <span>{formatDateTime(project.lastActivityAt)}</span>
                    </div>
                  </button>
                  <div className="sidebar-project-actions">
                    <button
                      aria-label={`Manage ${project.displayName}`}
                      className="sidebar-project-action-button"
                      onClick={() => onOpenProjectModal(project.id)}
                      type="button"
                    >
                      ...
                    </button>
                  </div>
                </div>

                {isProjectExpanded ? (
                  <div className="sidebar-project-thread-list">
                    {visibleProjectThreads.map((thread) => {
                      const matchingThreadTags = getMatchingTagValues(
                        thread.tags,
                        normalizedSidebarSearchTerms
                      );

                      return (
                        <button
                          className={`sidebar-project-thread-button ${
                            selectedThreadId === thread.id ? "is-active" : ""
                          }`}
                          key={thread.id}
                          onClick={() => onThreadSelect(thread.id)}
                          type="button"
                        >
                          <span className="sidebar-thread-row">
                            <span className="sidebar-thread-title">
                              {renderHighlightedText(thread.title, normalizedSidebarSearchTerms)}
                            </span>
                            {thread.isPinned ? (
                              <span className="sidebar-pin-badge">Pinned</span>
                            ) : null}
                          </span>
                          {matchingThreadTags.length ? (
                            <span className="sidebar-thread-search-tags">
                              {matchingThreadTags.map((tag) => (
                                <span className="sidebar-search-tag" key={tag}>
                                  {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : !isCollapsed ? (
        <p className="sidebar-empty-state">{emptyMessage}</p>
      ) : null}
    </section>
  );
}

export function SidebarLibraryContent({
  isMetadataFilterActive,
  metadataTagFilter,
  isPinnedFilterActive,
  isMemoFilterActive,
  isProjectsCollapsed,
  isHistoricalCollapsed,
  isChatsCollapsed,
  isLibraryLoading,
  sidebarProjects,
  activeProjects,
  allHistoricalProjects,
  historicalProjects,
  chatThreads,
  matchingChatThreads,
  matchingProjectThreadsByProjectId,
  threadsByProjectId,
  expandedProjectIds,
  selectedThread,
  selectedThreadId,
  normalizedSidebarSearchTerms,
  formatDateTime,
  formatCountLabel,
  formatFilteredCountLabel,
  renderHighlightedText,
  getMatchingTagValues,
  onMetadataTagFilterChange,
  onResetMetadataFilters,
  onTogglePinnedFilter,
  onToggleMemoFilter,
  onToggleProjectsCollapsed,
  onToggleHistoricalCollapsed,
  onToggleChatsCollapsed,
  onProjectToggle,
  onOpenProjectModal,
  onThreadSelect
}: SidebarLibraryContentProps) {
  return (
    <div className="sidebar-scroll-area">
      <section className="path-panel sidebar-filter-panel">
        <section className="path-panel-item">
          <div className="path-panel-item-header">
            <strong>Filters</strong>
            {isMetadataFilterActive ? (
              <button className="sidebar-collapse-toggle" onClick={onResetMetadataFilters} type="button">
                Clear
              </button>
            ) : null}
          </div>
          <p className="sidebar-filter-copy">Applies to projects, chats, and thread lists.</p>
          <input
            className="path-panel-input sidebar-filter-input"
            onChange={(event) => onMetadataTagFilterChange(event.target.value)}
            placeholder="Search projects, threads, tags"
            type="text"
            value={metadataTagFilter}
          />
          <div className="sidebar-filter-actions">
            <button
              className={`sidebar-filter-chip ${isPinnedFilterActive ? "is-active" : ""}`}
              onClick={onTogglePinnedFilter}
              type="button"
            >
              Pinned
            </button>
            <button
              className={`sidebar-filter-chip ${isMemoFilterActive ? "is-active" : ""}`}
              onClick={onToggleMemoFilter}
              type="button"
            >
              Has memo
            </button>
          </div>
        </section>
      </section>

      <ProjectSection
        emptyMessage={
          isMetadataFilterActive
            ? "No projects match the current filters."
            : "No current Codex projects were found."
        }
        expandedProjectIds={expandedProjectIds}
        formatCountLabel={formatCountLabel}
        formatDateTime={formatDateTime}
        formatFilteredCountLabel={formatFilteredCountLabel}
        getMatchingTagValues={getMatchingTagValues}
        isCollapsed={isProjectsCollapsed}
        isLoading={isLibraryLoading}
        isMetadataFilterActive={isMetadataFilterActive}
        matchingProjectThreadsByProjectId={matchingProjectThreadsByProjectId}
        normalizedSidebarSearchTerms={normalizedSidebarSearchTerms}
        onOpenProjectModal={onOpenProjectModal}
        onProjectToggle={onProjectToggle}
        onThreadSelect={onThreadSelect}
        onToggleCollapsed={onToggleProjectsCollapsed}
        projects={sidebarProjects}
        renderHighlightedText={renderHighlightedText}
        sectionClassName="sidebar-projects"
        selectedThread={selectedThread}
        selectedThreadId={selectedThreadId}
        showProjectStatusBadge={false}
        threadsByProjectId={threadsByProjectId}
        title="Projects"
        totalProjects={activeProjects}
      />

      {allHistoricalProjects.length ? (
        <ProjectSection
          emptyMessage="No historical projects match the current filters."
          expandedProjectIds={expandedProjectIds}
          formatCountLabel={formatCountLabel}
          formatDateTime={formatDateTime}
          formatFilteredCountLabel={formatFilteredCountLabel}
          getMatchingTagValues={getMatchingTagValues}
          isCollapsed={isHistoricalCollapsed}
          isLoading={false}
          isMetadataFilterActive={isMetadataFilterActive}
          matchingProjectThreadsByProjectId={matchingProjectThreadsByProjectId}
          normalizedSidebarSearchTerms={normalizedSidebarSearchTerms}
          onOpenProjectModal={onOpenProjectModal}
          onProjectToggle={onProjectToggle}
          onThreadSelect={onThreadSelect}
          onToggleCollapsed={onToggleHistoricalCollapsed}
          projects={historicalProjects}
          renderHighlightedText={renderHighlightedText}
          sectionClassName="sidebar-historical"
          selectedThread={selectedThread}
          selectedThreadId={selectedThreadId}
          showProjectStatusBadge
          threadsByProjectId={threadsByProjectId}
          title="Historical"
          totalProjects={allHistoricalProjects}
        />
      ) : null}

      <section className={`sidebar-section sidebar-chats ${isChatsCollapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar-section-header">
          <div>
            <h2>Chats</h2>
            <p>{formatFilteredCountLabel(matchingChatThreads.length, chatThreads.length, "chat")}</p>
          </div>
          <div className="sidebar-section-header-actions">
            <button
              aria-expanded={!isChatsCollapsed}
              className="sidebar-collapse-toggle"
              onClick={onToggleChatsCollapsed}
              type="button"
            >
              {isChatsCollapsed ? "Show" : "Hide"}
            </button>
          </div>
        </div>

        {!isChatsCollapsed && matchingChatThreads.length ? (
          <div className="sidebar-chat-list">
            {matchingChatThreads.map((thread) => {
              const matchingThreadTags = getMatchingTagValues(
                thread.tags,
                normalizedSidebarSearchTerms
              );

              return (
                <button
                  key={thread.id}
                  className={`sidebar-chat-button ${selectedThreadId === thread.id ? "is-active" : ""}`}
                  onClick={() => onThreadSelect(thread.id)}
                  type="button"
                >
                  <div className="sidebar-chat-heading">
                    <strong>{renderHighlightedText(thread.title, normalizedSidebarSearchTerms)}</strong>
                    {thread.isPinned ? <span className="sidebar-pin-badge">Pinned</span> : null}
                  </div>
                  {matchingThreadTags.length ? (
                    <div className="sidebar-search-tag-list">
                      {matchingThreadTags.map((tag) => (
                        <span className="sidebar-search-tag" key={tag}>
                          {renderHighlightedText(tag, normalizedSidebarSearchTerms)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="sidebar-item-meta">
                    <span>{formatCountLabel(thread.turnCount, "turn")}</span>
                    <span>{formatDateTime(thread.updatedAt ?? thread.lastSeenAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : !isChatsCollapsed ? (
          <p className="sidebar-empty-state">
            {isMetadataFilterActive
              ? "No chats match the current filters."
              : "Import Codex sessions to load chats."}
          </p>
        ) : null}
      </section>
    </div>
  );
}

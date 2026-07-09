import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ItemPresentation } from "../../lib/turn-item-presentation";

type TurnDetailItemListProps = {
  items: TurnItem[];
  variant: "primary" | "additional";
  turnReasoningTokens: number | null;
  detailTextPreviewLength: number;
  expandedDetailItemIds: Record<string, boolean>;
  formatDateTime: (value: string | null) => string;
  getRoleClassName: (role: string) => string;
  getItemPresentation: (
    items: TurnItem[],
    itemIndex: number,
    turnReasoningTokens: number | null
  ) => ItemPresentation;
  isMarkdownDetailItem: (item: TurnItem) => boolean;
  onDetailItemToggle: (itemId: string) => void;
};

function renderPresentationMeta(itemId: string, presentation: ItemPresentation) {
  if (!presentation.meta.length) {
    return null;
  }

  return (
    <dl className="detail-item-meta">
      {presentation.meta.map((entry) => (
        <div
          className={Array.isArray(entry.value) ? "is-stacked" : undefined}
          key={`${itemId}:${entry.label}`}
        >
          <dt>{entry.label}</dt>
          <dd>
            {Array.isArray(entry.value) ? (
              <ul className="detail-query-list">
                {entry.value.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
            ) : (
              entry.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TurnDetailItemList({
  items,
  variant,
  turnReasoningTokens,
  detailTextPreviewLength,
  expandedDetailItemIds,
  formatDateTime,
  getRoleClassName,
  getItemPresentation,
  isMarkdownDetailItem,
  onDetailItemToggle
}: TurnDetailItemListProps) {
  const isPrimary = variant === "primary";

  return (
    <div className={`detail-items ${isPrimary ? "" : "detail-items-hidden"}`.trim()}>
      {items.map((item, itemIndex) => {
        const presentation = getItemPresentation(items, itemIndex, turnReasoningTokens);
        const isExpandableText =
          isPrimary &&
          Boolean(presentation.textContent && presentation.textContent.length > detailTextPreviewLength);
        const isDetailItemExpanded = expandedDetailItemIds[item.id] === true;
        const isMarkdownItem = isPrimary && isMarkdownDetailItem(item);

        return (
          <article className="detail-item" key={item.id}>
            <div className="detail-item-header">
              <div className="detail-item-badges">
                <span className={`role-badge ${getRoleClassName(item.role)}`}>{item.role}</span>
                <span className={`item-type-badge ${presentation.categoryClassName}`}>
                  {presentation.categoryLabel}
                </span>
                <span className="kind-badge">{item.kind}</span>
              </div>
              <time className="mini-meta">{formatDateTime(item.createdAt)}</time>
            </div>

            <div className="detail-item-content">
              <p className="detail-item-summary">{presentation.summary}</p>
              {renderPresentationMeta(item.id, presentation)}
              {presentation.textContent ? (
                isMarkdownItem ? (
                  <div
                    className={`detail-markdown ${
                      isExpandableText && !isDetailItemExpanded ? "is-collapsed" : ""
                    }`}
                  >
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => (
                          <a
                            className="detail-markdown-link"
                            href={href}
                            onClick={(event) => event.preventDefault()}
                            title={href ?? undefined}
                          >
                            {children}
                          </a>
                        )
                      }}
                      remarkPlugins={[remarkGfm]}
                    >
                      {presentation.textContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre className="detail-text">{presentation.textContent}</pre>
                )
              ) : null}
              {isExpandableText ? (
                <button
                  className="detail-expand-toggle"
                  onClick={() => onDetailItemToggle(item.id)}
                  type="button"
                >
                  {isDetailItemExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

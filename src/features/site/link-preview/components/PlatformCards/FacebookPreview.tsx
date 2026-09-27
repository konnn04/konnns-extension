import type { LinkMetadata } from "../../types";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toUpperCase();
  } catch {
    return url.toUpperCase();
  }
}

export function FacebookPreview({ data }: { data: LinkMetadata }) {
  const domain = extractDomain(data.url);

  return (
    <div className="lp-card lp-card--facebook">
      <div className="lp-card__header">
        <svg className="lp-brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        <span className="lp-card__platform-name">Facebook</span>
      </div>

      <div className="lp-fb-post">
        <div className="lp-fb-post__header">
          <div className="lp-fb-post__avatar">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="lp-fb-post__user-info">
            <span className="lp-fb-post__username">Fayaz Ahmed</span>
            <span className="lp-fb-post__timestamp">
              Just Now · <span className="lp-fb-post__globe" title="Public">🌐</span>
            </span>
          </div>
          <button type="button" className="lp-fb-post__menu-btn" aria-label="Post actions">
            •••
          </button>
        </div>

        <div className="lp-fb-post__body">
          <a href={data.url} target="_blank" rel="noreferrer" className="lp-fb-post__url">
            {data.url}
          </a>
        </div>

        <div className="lp-fb-post__preview-box">
          {data.image ? (
            <div className="lp-fb-post__img-wrap">
              <img
                src={data.image}
                alt={data.imageAlt || data.title}
                className="lp-fb-post__img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="lp-fb-post__img-placeholder">
              <span>No image provided</span>
            </div>
          )}

          <div className="lp-fb-post__link-details">
            <div className="lp-fb-post__domain-row">
              <span className="lp-fb-post__domain">{domain}</span>
              <span className="lp-fb-post__info-icon">ⓘ</span>
            </div>
            <span className="lp-fb-post__title">{data.title || "Untitled Link"}</span>
            {data.description && (
              <span className="lp-fb-post__desc">{data.description}</span>
            )}
          </div>
        </div>

        <div className="lp-fb-post__actions">
          <button type="button" className="lp-fb-post__action-btn">
            <span>👍</span> Like
          </button>
          <button type="button" className="lp-fb-post__action-btn">
            <span>💬</span> Comment
          </button>
          <button type="button" className="lp-fb-post__action-btn">
            <span>↗</span> Send
          </button>
          <button type="button" className="lp-fb-post__action-btn">
            <span>↪</span> Share
          </button>
        </div>

        <div className="lp-fb-post__comment-bar">
          <div className="lp-fb-post__comment-avatar" />
          <div className="lp-fb-post__comment-input">Comment as Fayaz Ahmed</div>
        </div>
      </div>
    </div>
  );
}

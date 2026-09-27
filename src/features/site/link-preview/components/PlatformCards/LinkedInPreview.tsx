import type { LinkMetadata } from "../../types";

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function LinkedInPreview({ data }: { data: LinkMetadata }) {
  const hostname = extractHostname(data.url);

  return (
    <div className="lp-card lp-card--linkedin">
      <div className="lp-card__header">
        <svg className="lp-brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2">
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
        </svg>
        <span className="lp-card__platform-name">LinkedIn</span>
      </div>

      <div className="lp-linkedin-post">
        <div className="lp-linkedin-post__header">
          <div className="lp-linkedin-post__avatar">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div className="lp-linkedin-post__user">
            <span className="lp-linkedin-post__name">John Doe • You</span>
            <span className="lp-linkedin-post__headline">Software Architect & Product Lead</span>
            <span className="lp-linkedin-post__time">1w • 🌐</span>
          </div>
          <button type="button" className="lp-linkedin-post__menu">•••</button>
        </div>

        <div className="lp-linkedin-post__body">
          Excited to share this link with my network:
        </div>

        <div className="lp-linkedin-card">
          {data.image ? (
            <div className="lp-linkedin-card__img-wrap">
              <img
                src={data.image}
                alt={data.imageAlt || data.title}
                className="lp-linkedin-card__img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          ) : (
            <div className="lp-linkedin-card__img-placeholder">
              <span>No image provided</span>
            </div>
          )}

          <div className="lp-linkedin-card__details">
            <span className="lp-linkedin-card__title">{data.title || "Untitled Link"}</span>
            <span className="lp-linkedin-card__domain">{hostname}</span>
          </div>
        </div>

        <div className="lp-linkedin-post__actions">
          <button type="button" className="lp-linkedin-btn">👍 Like</button>
          <button type="button" className="lp-linkedin-btn">💬 Comment</button>
          <button type="button" className="lp-linkedin-btn">🔁 Repost</button>
          <button type="button" className="lp-linkedin-btn">📤 Send</button>
        </div>
      </div>
    </div>
  );
}

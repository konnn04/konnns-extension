import type { LinkMetadata } from "../../types";

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function TelegramPreview({ data }: { data: LinkMetadata }) {
  const hostname = extractHostname(data.url);

  return (
    <div className="lp-card lp-card--telegram">
      <div className="lp-card__header">
        <svg className="lp-brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="#24A1DE">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.458c.538-.196 1.006.128.832.943z" />
        </svg>
        <span className="lp-card__platform-name">Telegram</span>
      </div>

      <div className="lp-telegram-container">
        <div className="lp-telegram-bubble">
          <a href={data.url} target="_blank" rel="noreferrer" className="lp-telegram-bubble__link">
            {data.url}
          </a>

          <div className="lp-telegram-embed">
            <span className="lp-telegram-embed__site">{data.siteName || hostname}</span>
            <span className="lp-telegram-embed__title">{data.title || "Untitled Link"}</span>

            {data.description && (
              <p className="lp-telegram-embed__desc">{data.description}</p>
            )}

            {data.image && (
              <div className="lp-telegram-embed__img-wrap">
                <img
                  src={data.image}
                  alt={data.imageAlt || data.title}
                  className="lp-telegram-embed__img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div className="lp-telegram-bubble__time">12:05 PM</div>
        </div>
      </div>
    </div>
  );
}

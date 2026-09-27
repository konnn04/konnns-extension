import type { LinkMetadata } from "../../types";

export function DiscordPreview({ data }: { data: LinkMetadata }) {
  const accentColor = data.themeColor || "#5865F2";

  return (
    <div className="lp-card lp-card--discord">
      <div className="lp-card__header">
        <svg className="lp-brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
        <span className="lp-card__platform-name">Discord</span>
      </div>

      <div className="lp-discord-msg">
        <div className="lp-discord-msg__url-row">
          <a href={data.url} target="_blank" rel="noreferrer" className="lp-discord-msg__link">
            {data.url}
          </a>
        </div>

        <div className="lp-discord-embed" style={{ borderLeftColor: accentColor }}>
          {data.siteName && (
            <span className="lp-discord-embed__provider">{data.siteName}</span>
          )}

          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="lp-discord-embed__title"
          >
            {data.title || "Untitled Link"}
          </a>

          {data.description && (
            <p className="lp-discord-embed__desc">{data.description}</p>
          )}

          {data.image && (
            <div className="lp-discord-embed__img-wrap">
              <img
                src={data.image}
                alt={data.imageAlt || data.title}
                className="lp-discord-embed__img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        <div className="lp-discord-msg__reactions">
          <span className="lp-discord-reaction">👍 4</span>
          <span className="lp-discord-reaction">❤️ 7</span>
        </div>
      </div>
    </div>
  );
}

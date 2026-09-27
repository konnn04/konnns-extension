import type { LinkMetadata } from "../../types";

function extractBreadcrumbs(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return u.hostname;
    return `${u.hostname} › ${parts.join(" › ")}`;
  } catch {
    return url;
  }
}

export function GooglePreview({ data }: { data: LinkMetadata }) {
  const breadcrumb = extractBreadcrumbs(data.url);
  const displayTitle = data.title || "No title provided";
  const displayDesc = data.description || "No description provided for this page.";

  return (
    <div className="lp-card lp-card--google">
      <div className="lp-card__header">
        <svg className="lp-brand-icon" viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span className="lp-card__platform-name">Google Search</span>
      </div>

      <div className="lp-google-serp">
        <div className="lp-google-serp__meta">
          {data.favicon ? (
            <img
              src={data.favicon}
              alt=""
              className="lp-google-serp__favicon"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <span className="lp-google-serp__favicon-fallback" />
          )}
          <div className="lp-google-serp__source">
            <span className="lp-google-serp__site-name">{data.siteName || "Website"}</span>
            <span className="lp-google-serp__breadcrumb">{breadcrumb}</span>
          </div>
        </div>

        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="lp-google-serp__title"
        >
          {displayTitle}
        </a>

        <p className="lp-google-serp__snippet">{displayDesc}</p>
      </div>
    </div>
  );
}

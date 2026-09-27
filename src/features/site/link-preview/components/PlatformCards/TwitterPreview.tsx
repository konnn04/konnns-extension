import { useState } from "react";
import type { LinkMetadata } from "../../types";

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function TwitterPreview({ data }: { data: LinkMetadata }) {
  const [overrideCard, setOverrideCard] = useState<"summary_large_image" | "summary" | null>(null);
  const cardType = overrideCard ?? data.twitterCard ?? (data.image ? "summary_large_image" : "summary");
  const hostname = extractHostname(data.url);
  const isLarge = cardType === "summary_large_image";

  return (
    <div className="lp-card lp-card--twitter">
      <div className="lp-card__header">
        <svg className="lp-brand-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span className="lp-card__platform-name">Twitter / X</span>

        <div className="lp-card__mode-switch">
          <button
            type="button"
            className={`lp-pill-btn ${isLarge ? "lp-pill-btn--active" : ""}`}
            onClick={() => setOverrideCard("summary_large_image")}
          >
            Large
          </button>
          <button
            type="button"
            className={`lp-pill-btn ${!isLarge ? "lp-pill-btn--active" : ""}`}
            onClick={() => setOverrideCard("summary")}
          >
            Compact
          </button>
        </div>
      </div>

      <div className={`lp-twitter-card ${isLarge ? "lp-twitter-card--large" : "lp-twitter-card--compact"}`}>
        {isLarge ? (
          <>
            {data.image ? (
              <div className="lp-twitter-card__image-wrap">
                <img
                  src={data.image}
                  alt={data.imageAlt || data.title}
                  className="lp-twitter-card__image"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="lp-twitter-card__overlay">
                  <span className="lp-twitter-card__overlay-title">{data.title || hostname}</span>
                </div>
              </div>
            ) : (
              <div className="lp-twitter-card__image-placeholder">
                <span>No image provided</span>
              </div>
            )}
            <div className="lp-twitter-card__domain-bar">
              <span className="lp-twitter-card__domain">From {data.url || hostname}</span>
            </div>
          </>
        ) : (
          <div className="lp-twitter-card__compact-inner">
            {data.image ? (
              <img
                src={data.image}
                alt=""
                className="lp-twitter-card__compact-thumb"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div className="lp-twitter-card__compact-thumb-fallback">
                <span>No img</span>
              </div>
            )}
            <div className="lp-twitter-card__compact-details">
              <span className="lp-twitter-card__compact-domain">{hostname}</span>
              <span className="lp-twitter-card__compact-title">{data.title || "Untitled"}</span>
              {data.description && (
                <span className="lp-twitter-card__compact-desc">{data.description}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

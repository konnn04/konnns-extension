import type { LinkMetadata } from "../../types";

export function WhatsAppPreview({ data }: { data: LinkMetadata }) {
  return (
    <div className="lp-card lp-card--whatsapp">
      <div className="lp-card__header">
        <svg className="lp-brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="#25D366">
          <path d="M12.031 0C5.393 0 .008 5.385.008 12.023c0 2.12.553 4.188 1.603 6.007L0 24l6.143-1.61a12.012 12.012 0 0 0 5.888 1.534h.005c6.634 0 12.02-5.385 12.02-12.024A11.96 11.96 0 0 0 12.031 0zm0 21.92h-.004a9.98 9.98 0 0 1-5.088-1.39l-.365-.216-3.776.99.998-3.68-.238-.378a9.96 9.96 0 0 1-1.528-5.223c0-5.514 4.486-10 10.005-10 2.67 0 5.18 1.04 7.07 2.93a9.94 9.94 0 0 1 2.93 7.07c0 5.515-4.486 10-10.004 10zm5.485-7.487c-.3-.15-1.776-.876-2.05-.976-.275-.1-.475-.15-.675.15s-.775.976-.95 1.176-.35.225-.65.075a8.19 8.19 0 0 1-2.41-1.488 9.03 9.03 0 0 1-1.668-2.076c-.175-.3-.02-.462.13-.612.136-.134.3-.35.45-.525s.2-.3.3-.5.05-.375-.025-.525c-.075-.15-.675-1.625-.925-2.225-.243-.585-.49-.505-.675-.515-.175-.01-.375-.01-.575-.01s-.525.075-.8.375c-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.115 3.23 5.125 4.53.716.31 1.275.495 1.71.635.72.23 1.375.197 1.892.12.577-.086 1.776-.726 2.026-1.426.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z" />
        </svg>
        <span className="lp-card__platform-name">WhatsApp</span>
      </div>

      <div className="lp-whatsapp-container">
        <div className="lp-whatsapp-bubble">
          <div className="lp-whatsapp-preview">
            {data.image && (
              <div className="lp-whatsapp-preview__img-wrap">
                <img
                  src={data.image}
                  alt={data.imageAlt || data.title}
                  className="lp-whatsapp-preview__img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            )}

            <div className="lp-whatsapp-preview__info">
              <span className="lp-whatsapp-preview__title">{data.title || "Untitled Link"}</span>
              {data.description && (
                <p className="lp-whatsapp-preview__desc">{data.description}</p>
              )}
              <span className="lp-whatsapp-preview__url">{data.url} ↗</span>
            </div>
          </div>

          <div className="lp-whatsapp-bubble__footer">
            <span className="lp-whatsapp-bubble__time">12:05 PM</span>
            <span className="lp-whatsapp-bubble__ticks">✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

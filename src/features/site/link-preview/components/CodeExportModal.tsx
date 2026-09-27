import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import type { LinkMetadata } from "../types";
import { Button, Modal } from "@/shared/ui";

interface CodeExportModalProps {
  open: boolean;
  onClose: () => void;
  metadata: LinkMetadata;
}

function escapeHtml(str?: string): string {
  if (!str) return "";
  return str.replace(/"/g, "&quot;");
}

export function generateMetaTagsHtml(data: LinkMetadata): string {
  const lines: string[] = [
    "<!-- Primary Meta Tags -->",
    `<title>${escapeHtml(data.title)}</title>`,
    `<meta name="title" content="${escapeHtml(data.title)}" />`,
    `<meta name="description" content="${escapeHtml(data.description)}" />`,
  ];

  if (data.canonical) {
    lines.push(`<link rel="canonical" href="${escapeHtml(data.canonical)}" />`);
  }
  if (data.themeColor) {
    lines.push(`<meta name="theme-color" content="${escapeHtml(data.themeColor)}" />`);
  }

  lines.push("");
  lines.push("<!-- Open Graph / Facebook -->");
  lines.push(`<meta property="og:type" content="${escapeHtml(data.type || "website")}" />`);
  lines.push(`<meta property="og:url" content="${escapeHtml(data.url)}" />`);
  lines.push(`<meta property="og:title" content="${escapeHtml(data.title)}" />`);
  lines.push(`<meta property="og:description" content="${escapeHtml(data.description)}" />`);
  if (data.siteName) {
    lines.push(`<meta property="og:site_name" content="${escapeHtml(data.siteName)}" />`);
  }
  if (data.image) {
    lines.push(`<meta property="og:image" content="${escapeHtml(data.image)}" />`);
    if (data.imageWidth) {
      lines.push(`<meta property="og:image:width" content="${data.imageWidth}" />`);
    }
    if (data.imageHeight) {
      lines.push(`<meta property="og:image:height" content="${data.imageHeight}" />`);
    }
    if (data.imageAlt) {
      lines.push(`<meta property="og:image:alt" content="${escapeHtml(data.imageAlt)}" />`);
    }
  }

  lines.push("");
  lines.push("<!-- Twitter -->");
  lines.push(`<meta name="twitter:card" content="${data.twitterCard || "summary_large_image"}" />`);
  lines.push(`<meta name="twitter:url" content="${escapeHtml(data.url)}" />`);
  lines.push(`<meta name="twitter:title" content="${escapeHtml(data.title)}" />`);
  lines.push(`<meta name="twitter:description" content="${escapeHtml(data.description)}" />`);
  if (data.image) {
    lines.push(`<meta name="twitter:image" content="${escapeHtml(data.image)}" />`);
  }
  if (data.twitterSite) {
    lines.push(`<meta name="twitter:site" content="${escapeHtml(data.twitterSite)}" />`);
  }
  if (data.twitterCreator) {
    lines.push(`<meta name="twitter:creator" content="${escapeHtml(data.twitterCreator)}" />`);
  }

  return lines.join("\n");
}

export function CodeExportModal({ open, onClose, metadata }: CodeExportModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const snippet = generateMetaTagsHtml(metadata);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("linkPreview.exportModal.title")}
      width="min(92vw, 680px)"
    >
      <div className="lp-export-modal">
        <p className="lp-export-modal__desc">{t("linkPreview.exportModal.desc")}</p>

        <div className="lp-export-modal__code-wrap">
          <pre className="lp-export-modal__code">
            <code>{snippet}</code>
          </pre>
        </div>

        <div className="lp-export-modal__actions">
          <Button variant="primary" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? t("linkPreview.copied") : t("linkPreview.copyCode")}</span>
          </Button>
          <Button variant="subtle" onClick={onClose}>
            {t("linkPreview.close")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

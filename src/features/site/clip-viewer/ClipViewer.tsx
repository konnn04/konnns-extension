import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download, ExternalLink } from "lucide-react";
import { useHashRoute } from "@/core/router/useHashRoute";
import { readHandoff } from "@/core/handoff";
import { estimateTokens, type MarkdownPayload } from "@/shared/utils/markdownResult";
import { Button } from "@/shared/ui";
import "./clip-viewer.css";

export default function ClipViewer() {
  const { t } = useTranslation();
  const { segments } = useHashRoute();
  const id = segments[1];

  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [clip, setClip] = useState<MarkdownPayload | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) {
      setState("missing");
      return;
    }
    let live = true;
    void readHandoff<MarkdownPayload>(id).then((payload) => {
      if (!live) return;
      if (!payload) {
        setState("missing");
        return;
      }
      setClip(payload);
      setText(payload.markdown);
      setState("ready");
    });
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  if (state === "loading") return <div className="clip clip--muted">{t("clip.loading")}</div>;
  if (state === "missing" || !clip)
    return (
      <div className="clip clip--muted">
        <p>{t("clip.missing")}</p>
      </div>
    );

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileNameOf(clip.title ?? "clip")}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="clip">
      <header className="clip__head">
        <div className="clip__meta">
          <h1 className="clip__title">{clip.title ?? t("site.apps.clip-viewer.name")}</h1>
          {clip.url && (
            <a className="clip__source" href={clip.url} target="_blank" rel="noreferrer">
              <ExternalLink size={12} />
              {clip.url}
            </a>
          )}
        </div>
        <div className="clip__actions">
          <Button variant="primary" onClick={() => void copy()}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? t("popup.copied") : t("popup.copy")}
          </Button>
          <Button onClick={download}>
            <Download size={15} />
            {t("popup.download")}
          </Button>
        </div>
      </header>

      <div className="clip__stats">
        <span>{t("popup.words", { count: countWords(text) })}</span>
        <span>·</span>
        <span>{t("popup.tokensApprox", { count: estimateTokens(text) })}</span>
        <span>·</span>
        <span>{t("clip.chars", { count: text.length })}</span>
      </div>

      <textarea
        className="clip__editor"
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        aria-label={t("clip.editorLabel")}
      />
    </div>
  );
}

function countWords(text: string): number {
  const words = text.trim().match(/\S+/g);
  return words ? words.length : 0;
}

const RESERVED_CHARS = new Set(["<", ">", ":", '"', "|", "?", "*", "/", "\\"]);

function fileNameOf(title: string): string {
  const cleaned = [...title]
    .map((c) => (RESERVED_CHARS.has(c) || c < " " ? "-" : c))
    .join("")
    .trim();
  return (cleaned || "clip").slice(0, 80);
}

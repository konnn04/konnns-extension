import { useEffect, useState } from "react";
import { getRedirectUriAsync } from "./index";

/** Read-only display of the extension's OAuth redirect URI to whitelist. */
export function RedirectUriField({ label, path }: { label: string; path?: string }) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRedirectUriAsync(path).then((u) => {
      if (!cancelled) setUri(u);
    });
    return () => { cancelled = true; };
  }, [path]);

  return (
    <div className="ui-field">
      <span className="ui-field__label">{label}</span>
      <code
        style={{
          display: "block",
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          fontSize: 12,
          wordBreak: "break-all",
          fontFamily: "var(--font-mono)",
        }}
      >
        {uri ?? "—"}
      </code>
    </div>
  );
}

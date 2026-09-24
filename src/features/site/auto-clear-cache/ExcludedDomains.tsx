import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { TextInput } from "@/shared/ui";

/** Add/remove excluded domains — docs/roadmap/06 §2 step 4. Only cookies/cache actually honor this (see the note rendered under the list); history/form data/download list have no per-domain exclusion at the platform level. */
export function ExcludedDomains({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const add = () => {
    const domain = draft.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (domain && !value.includes(domain)) onChange([...value, domain]);
    setDraft("");
  };

  return (
    <div className="acc__excluded">
      <div className="acc__excluded-input">
        <TextInput
          value={draft}
          placeholder={t("autoClearCache.excludedPlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>
      {value.length > 0 && (
        <ul className="acc__excluded-list">
          {value.map((d) => (
            <li key={d} className="acc__excluded-tag">
              {d}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== d))} aria-label={t("common.delete")}>
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="acc__excluded-note">{t("autoClearCache.excludedNote")}</p>
    </div>
  );
}

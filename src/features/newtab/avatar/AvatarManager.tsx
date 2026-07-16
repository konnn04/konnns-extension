import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, IconButton } from "@/shared/ui";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { getAvatarUrl, useAvatarStore, type AvatarMeta } from "./store";

const FEATURE_ID = "avatar";

function AvatarThumb({ item }: { item: AvatarMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let current: string | null = null;
    void getAvatarUrl(item.id).then((u) => {
      current = u;
      setUrl(u);
    });
    return () => {
      if (current) URL.revokeObjectURL(current);
    };
  }, [item.id]);
  return url ? <img src={url} alt={item.name} /> : null;
}

/** Avatar library shown in Settings (custom section under the schema form). */
export function AvatarManager() {
  const { t } = useTranslation();
  const { items, loaded, load, addFile, remove } = useAvatarStore();
  const values = useFeatureValues(FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const activeId = (values.activeId as string) ?? "";
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  return (
    <div className="avatar-manager">
      <Button size="sm" onClick={() => fileRef.current?.click()}>
        <Upload size={15} /> {t("avatar.upload")}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,image/gif"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setError(null);
          try {
            setValue(FEATURE_ID, "activeId", await addFile(f));
          } catch {
            setError(t("avatar.tooLarge"));
          }
        }}
      />
      {error && <div className="ui-field__error">{error}</div>}

      <div className="avatar-manager__grid">
        {items.map((item) => (
          <div
            key={item.id}
            className={`avatar-item ${activeId === item.id ? "avatar-item--active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => setValue(FEATURE_ID, "activeId", item.id)}
            onKeyDown={(e) => e.key === "Enter" && setValue(FEATURE_ID, "activeId", item.id)}
          >
            <AvatarThumb item={item} />
            <IconButton
              label={t("common.delete")}
              className="avatar-item__delete"
              onClick={(e) => {
                e.stopPropagation();
                if (activeId === item.id) setValue(FEATURE_ID, "activeId", "");
                void remove(item.id);
              }}
            >
              <Trash2 size={14} />
            </IconButton>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="ui-field__desc">{t("avatar.empty")}</p>}
    </div>
  );
}

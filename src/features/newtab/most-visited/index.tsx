import { useCallback, useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { defineSchema } from "@/core/settings-engine/schema";
import { Button, Skeleton } from "@/shared/ui";
import {
  faviconFor,
  getTopSites,
  hasTopSitesPermission,
  requestTopSitesPermission,
  type TopSite,
} from "./api";
import "./most-visited.css";

export const MOST_VISITED_FEATURE_ID = "most-visited";

const mostVisitedSchema = defineSchema({
  count: { type: "slider", label: "mostVisited.count", min: 4, max: 12, step: 1, default: 8 },
});

function Favicon({ site }: { site: TopSite }) {
  const [failed, setFailed] = useState(false);
  const src = faviconFor(site.url);
  if (!src || failed) {
    return <span className="mv-item__letter">{(site.title || site.url)[0]?.toUpperCase() ?? "?"}</span>;
  }
  return (
    <img className="mv-item__icon" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}

function MostVisited() {
  const { t } = useTranslation();
  const values = useFeatureValues(MOST_VISITED_FEATURE_ID);
  const count = typeof values.count === "number" ? values.count : 8;
  const [state, setState] = useState<"checking" | "no-permission" | "ready">("checking");
  const [sites, setSites] = useState<TopSite[]>([]);

  const load = useCallback(async (n: number) => {
    setSites(await getTopSites(n));
    setState("ready");
  }, []);

  useEffect(() => {
    void (async () => {
      if (await hasTopSitesPermission()) void load(count);
      else setState("no-permission");
    })();
  }, [count, load]);

  if (state === "no-permission") {
    return (
      <div className="most-visited__perm">
        <span>{t("mostVisited.permissionNeeded")}</span>
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            if (await requestTopSitesPermission()) void load(count);
          }}
        >
          {t("bookmarks.grant")}
        </Button>
      </div>
    );
  }

  if (state === "checking") {
    return (
      <div className="most-visited" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} width={68} height={60} radius="var(--radius-md)" />
        ))}
      </div>
    );
  }

  return (
    <div className="most-visited">
      {sites.map((s) => (
        <a key={s.url} className="mv-item" href={s.url} title={s.title}>
          <Favicon site={s} />
          <span className="mv-item__label">{s.title || s.url}</span>
        </a>
      ))}
    </div>
  );
}

registerFeature({
  id: MOST_VISITED_FEATURE_ID,
  zone: "center",
  nameKey: "features.most-visited",
  icon: LayoutGrid,
  defaultEnabled: false,
  settingsSchema: mostVisitedSchema,
  component: MostVisited,
  order: 3, // below the search bar
});

export default MostVisited;

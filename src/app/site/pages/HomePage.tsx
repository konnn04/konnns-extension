import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { getVisibleSiteApps, type SiteAppCategory } from "@/core/site-registry";

/**
 * Home of the Custom Site — the page the popup's big button lands on.
 * Pure projection of the Site App Registry, grouped by category.
 */

const CATEGORY_ORDER: SiteAppCategory[] = ["media", "text", "dev", "other"];

export function HomePage() {
  const { t } = useTranslation();
  const all = useMemo(() => getVisibleSiteApps(), []);
  const [query, setQuery] = useState("");

  /**
   * Matches the NAME and the DESCRIPTION, both translated, so searching works
   * in whichever language the labels are showing rather than against the
   * internal ids. Accents are folded, because typing "am thanh" should still
   * find "Sửa âm thanh".
   */
  const apps = useMemo(() => {
    const needle = fold(query);
    if (!needle) return all;
    return all.filter((app) =>
      `${fold(t(app.nameKey))} ${fold(t(app.descKey))}`.includes(needle),
    );
  }, [all, query, t]);

  const groups = useMemo(() => {
    const byCategory = new Map<SiteAppCategory, typeof apps>();
    for (const app of apps) {
      const key = app.category ?? "other";
      byCategory.set(key, [...(byCategory.get(key) ?? []), app]);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map(
      (c) => [c, byCategory.get(c)!] as const,
    );
  }, [apps]);

  return (
    <div className="home">
      <div className="home__hero">
        <h1 className="home__title">{t("site.home.heading")}</h1>
        <p className="home__sub">{t("site.home.sub")}</p>
      </div>

      {all.length > 0 && (
        <div className="home__search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            placeholder={t("site.home.searchPlaceholder")}
            aria-label={t("site.home.search")}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" aria-label={t("common.cancel")} onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {apps.length === 0 && (
        <p className="home__empty">
          {query ? t("site.home.noMatch", { query }) : t("site.home.empty")}
        </p>
      )}

      {groups.map(([category, list]) => (
        <section key={category} className="home__group">
          <h2 className="home__group-title">{t(`site.categories.${category}`)}</h2>
          <div className="home__grid">
            {list.map((app) => (
              <a key={app.id} className="home__card" href={`#${app.path}`}>
                <span className="home__card-icon">
                  <app.icon size={22} />
                </span>
                <span className="home__card-name">{t(app.nameKey)}</span>
                <span className="home__card-desc">{t(app.descKey)}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Lower-case and strip accents, so "am thanh" matches "âm thanh". */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

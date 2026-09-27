import { useEffect, useState } from "react";
import {
  BookOpen,
  Bug,
  ExternalLink,
  GitCommit,
  Github,
  HeartHandshake,
  Star,
  Tag,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { browser } from "wxt/browser";
import { Button } from "@/shared/ui";

import { swr } from "@/core/net";
import pkg from "../../../../package.json";
import {
  CONTRIBUTE_CACHE_KEY,
  CONTRIBUTE_CACHE_TTL,
  GITHUB_ISSUES_URL,
  GITHUB_RELEASES_URL,
  GITHUB_REPO_URL,
  fetchCommits,
  fetchContributors,
  fetchReleases,
  type CommitItem,
  type Contributor,
  type ReleaseItem,
} from "./contribute-data";
import "./contribute-panel.css";

/** null = still loading, [] = loaded but nothing (or the fetch failed with no cache) */
function useGitHubList<T>(namespace: string, fetcher: () => Promise<T[]>): { list: T[] | null; failed: boolean } {
  const [list, setList] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void swr({
      namespace,
      key: CONTRIBUTE_CACHE_KEY,
      ttlMs: CONTRIBUTE_CACHE_TTL,
      fetcher,
      onData: (data) => {
        if (alive) setList(data);
      },
      onError: (_err, hadCache) => {
        if (!alive || hadCache) return;
        setFailed(true);
        setList([]);
      },
    });
    return () => {
      alive = false;
    };
    // fetcher is a module-level function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);
  return { list, failed };
}

type MarkdownRenderer = (source: string) => string;

/** markdown-it + DOMPurify are loaded on demand — only this panel needs them */
function useMarkdownRenderer(): MarkdownRenderer | null {
  const [render, setRender] = useState<MarkdownRenderer | null>(null);
  useEffect(() => {
    let alive = true;
    void import("@/shared/utils/renderMarkdown").then((m) => {
      if (alive) setRender(() => m.renderMarkdown);
    });
    return () => {
      alive = false;
    };
  }, []);
  return render;
}


export function ContributePanel() {
  const { t, i18n } = useTranslation();
  const [version, setVersion] = useState(pkg.version ?? "0.3.0");
  const contributors = useGitHubList<Contributor>("contribute.contributors", fetchContributors);
  const commits = useGitHubList<CommitItem>("contribute.commits", fetchCommits);
  const releases = useGitHubList<ReleaseItem>("contribute.releases", fetchReleases);
  const [viewMode, setViewMode] = useState<"releases" | "commits">("releases");
  const renderMd = useMarkdownRenderer();

  useEffect(() => {
    try {
      const manifest = browser?.runtime?.getManifest?.();
      if (manifest?.version) {
        setVersion(manifest.version);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="contribute-panel">
      <div className="contribute-hero">
        <div className="contribute-hero__icon-wrap">
          <img src="/icons/128.png" alt="My NewTab Icon" className="contribute-hero__icon" />
        </div>
        <div className="contribute-hero__info">
          <div className="contribute-hero__title-row">
            <h2 className="contribute-hero__title">My NewTab</h2>
            <span className="contribute-hero__version">v{version}</span>
          </div>
          <p className="contribute-hero__desc">{t("settings.contributeDesc")}</p>
        </div>
      </div>

      <div className="contribute-actions">
        <Button
          size="sm"
          variant="primary"
          onClick={() => window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer")}
        >
          <Github size={15} />
          {t("settings.openGithub")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            window.open(GITHUB_ISSUES_URL, "_blank", "noopener,noreferrer")
          }
        >
          <Bug size={15} />
          {t("settings.reportIssue")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.open(GITHUB_REPO_URL, "_blank", "noopener,noreferrer")}
        >
          <Star size={15} />
          {t("settings.starGithub")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            window.open(`${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`, "_blank", "noopener,noreferrer")
          }
        >
          <BookOpen size={15} />
          {t("settings.contributeGuide")}
        </Button>
      </div>

      <div className="settings-section">
        <div className="contribute-section__header">
          <h3 className="settings-section__title">
            <Users size={16} />
            {t("settings.contributors")}
            {contributors.list && contributors.list.length > 0 ? ` (${contributors.list.length})` : ""}
          </h3>
          <span className="contribute-section__sub">{t("settings.contributorsDesc")}</span>
        </div>

        {contributors.list === null ? (
          <p className="ui-field__desc">{t("settings.loadingContributors")}</p>
        ) : contributors.failed ? (
          <p className="ui-field__desc">{t("settings.githubUnavailable")}</p>
        ) : (
          <div className="contribute-grid">
            {contributors.list.map((c) => (
              <a
                key={c.id}
                href={c.html_url}
                target="_blank"
                rel="noreferrer"
                className="contribute-card"
              >
                <img
                  src={c.avatar_url}
                  alt={c.login}
                  className="contribute-card__avatar"
                  loading="lazy"
                />
                <div className="contribute-card__meta">
                  <span className="contribute-card__name">@{c.login}</span>
                  <span className="contribute-card__badge">
                    {c.contributions} {t("settings.commitsCount")}
                  </span>
                </div>
                <ExternalLink size={13} className="contribute-card__ext" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="contribute-section__header">
          <div className="contribute-section__title-row">
            <h3 className="settings-section__title">
              <HeartHandshake size={16} />
              {t("settings.recentChanges")}
            </h3>
            <div className="contribute-toggle">
              <button
                type="button"
                className={`contribute-toggle__btn ${viewMode === "releases" ? "contribute-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("releases")}
              >
                <Tag size={13} />
                {t("settings.releases")}
              </button>
              <button
                type="button"
                className={`contribute-toggle__btn ${viewMode === "commits" ? "contribute-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("commits")}
              >
                <GitCommit size={13} />
                {t("settings.commits")}
              </button>
            </div>
          </div>
          <span className="contribute-section__sub">{t("settings.recentChangesDesc")}</span>
        </div>

        {viewMode === "releases" ? (
          releases.list === null ? (
            <p className="ui-field__desc">{t("settings.loadingChanges")}</p>
          ) : releases.list.length === 0 ? (
            <p className="ui-field__desc">
              {t(releases.failed ? "settings.githubUnavailable" : "settings.noReleases")}{" "}
              <a href={GITHUB_RELEASES_URL} target="_blank" rel="noreferrer">
                {t("settings.allReleases")}
              </a>
            </p>
          ) : (
            <>
              <div className="contribute-timeline">
                {releases.list.map((rel) => (
                  <div key={rel.version} className="contribute-timeline__item">
                    <div className="contribute-timeline__dot-wrap">
                      <div
                        className={`contribute-timeline__dot ${rel.isLatest ? "contribute-timeline__dot--latest" : ""}`}
                      />
                      <div className="contribute-timeline__line" />
                    </div>
                    <div className="contribute-timeline__content">
                      <div className="contribute-timeline__header">
                        <a
                          className="contribute-timeline__version"
                          href={rel.url}
                          target="_blank"
                          rel="noreferrer"
                          title={rel.title}
                        >
                          {rel.version}
                        </a>
                        {rel.isLatest && (
                          <span className="contribute-timeline__badge">{t("settings.latest")}</span>
                        )}
                        {rel.prerelease && (
                          <span className="contribute-timeline__badge contribute-timeline__badge--pre">
                            {t("settings.prerelease")}
                          </span>
                        )}
                        <span className="contribute-timeline__date">{formatDate(rel.date)}</span>
                      </div>
                      {!rel.body ? (
                        <div className="contribute-md contribute-md--plain">{rel.title ?? t("settings.newUpdate")}</div>
                      ) : renderMd ? (
                        <div
                          className="contribute-md"
                          // sanitized by DOMPurify inside renderMarkdown
                          dangerouslySetInnerHTML={{ __html: renderMd(rel.body) }}
                        />
                      ) : (
                        <div className="contribute-md contribute-md--plain">{rel.body}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <a className="contribute-timeline__all" href={GITHUB_RELEASES_URL} target="_blank" rel="noreferrer">
                {t("settings.allReleases")} <ExternalLink size={12} />
              </a>
            </>
          )
        ) : commits.list === null ? (
          <p className="ui-field__desc">{t("settings.loadingChanges")}</p>
        ) : commits.list.length === 0 ? (
          <p className="ui-field__desc">{t(commits.failed ? "settings.githubUnavailable" : "settings.noCommits")}</p>
        ) : (
          <div className="contribute-commits">
            {commits.list.map((c) => (
              <a
                key={c.sha}
                href={c.html_url}
                target="_blank"
                rel="noreferrer"
                className="contribute-commit-item"
              >
                <div className="contribute-commit-item__left">
                  <GitCommit size={15} className="contribute-commit-item__icon" />
                  <div className="contribute-commit-item__info">
                    <span className="contribute-commit-item__msg">
                      {c.commit.message.split("\n")[0]}
                    </span>
                    <span className="contribute-commit-item__meta">
                      {c.author?.login ? `@${c.author.login}` : c.commit.author.name} •{" "}
                      {formatDate(c.commit.author.date)}
                    </span>
                  </div>
                </div>
                <span className="contribute-commit-item__sha">{c.sha.slice(0, 7)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

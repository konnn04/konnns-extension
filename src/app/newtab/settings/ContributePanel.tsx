import { useEffect, useState } from "react";
import {
  BookOpen,
  Bug,
  ExternalLink,
  GitCommit,
  Github,
  HeartHandshake,
  Sparkles,
  Star,
  Tag,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { browser } from "wxt/browser";
import { Button } from "@/shared/ui";

import pkg from "../../../../package.json";

interface Contributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

interface CommitItem {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author?: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
}

const GITHUB_REPO_URL = pkg.homepage ?? "https://github.com/konnn04/konnns-extension";
const GITHUB_ISSUES_URL =
  (typeof pkg.bugs === "object" && pkg.bugs?.url ? pkg.bugs.url : null) ?? `${GITHUB_REPO_URL}/issues`;
const REPO_PATH = GITHUB_REPO_URL.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
const CONTRIBUTORS_API = `https://api.github.com/repos/${REPO_PATH}/contributors`;
const COMMITS_API = `https://api.github.com/repos/${REPO_PATH}/commits?per_page=8`;

const FALLBACK_CONTRIBUTORS: Contributor[] = [
  {
    id: 1,
    login: "konnn04",
    avatar_url: "https://avatars.githubusercontent.com/u/1000000?v=4",
    html_url: "https://github.com/konnn04",
    contributions: 68,
  },
];

const RELEASE_CHANGES = [
  {
    version: "v0.2.1",
    date: "2026-08-21",
    isLatest: true,
    items: [
      "Spotify: Hỗ trợ bài đã phát gần nhất khi không có nhạc đang phát (fallback recently-played) & nút mở trực tiếp Spotify.",
      "Spotify: Hỗ trợ layout responsive (chiều ngang / chiều dọc / compact).",
      "Thanh Bookmark: Hỗ trợ duyệt thư mục lồng đệ quy đa cấp, hiệu ứng lướt ngang mượt mà kèm nút Quay lại.",
      "Cài đặt: Bổ sung mục Đóng góp & Giới thiệu (Contribute & About) ngay tab đầu tiên.",
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-08-18",
    items: [
      "Thêm công cụ MusicBox phát nhạc offline / file âm thanh cục bộ kèm widget góc màn hình.",
      "Cải tiến Quản lý công việc (Tasks) với deadline chi tiết và bộ chọn ngày DatePicker.",
      "Thêm bộ lọc định dạng hình nền (ảnh tĩnh, video, động) và huy hiệu thumbnail.",
      "Thêm thống kê ngôn ngữ lập trình và top repo GitHub.",
      "Hỗ trợ đảo vị trí thanh công cụ / panel và chế độ chồng lấn dock.",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-08-01",
    items: [
      "Khởi tạo dự án NewTab với kiến trúc WXT + React + TypeScript.",
      "Hệ thống Theme đa dạng (12 themes), font chữ tùy biến và hiệu ứng kính mờ (glassmorphism).",
      "Đồng hồ, thời tiết, thanh tìm kiếm đa công cụ, ghi chú, mã QR, Pomodoro và thanh bookmark.",
    ],
  },
];

export function ContributePanel() {
  const { t, i18n } = useTranslation();
  const [version, setVersion] = useState("0.2.1");
  const [contributors, setContributors] = useState<Contributor[]>(FALLBACK_CONTRIBUTORS);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(true);
  const [loadingCommits, setLoadingCommits] = useState(true);
  const [viewMode, setViewMode] = useState<"releases" | "commits">("releases");

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

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(CONTRIBUTORS_API);
        if (res.ok) {
          const data: Contributor[] = await res.json();
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            setContributors(data);
          }
        }
      } catch {
        /* use fallback */
      } finally {
        if (!cancelled) setLoadingContributors(false);
      }

      try {
        const res = await fetch(COMMITS_API);
        if (res.ok) {
          const data: CommitItem[] = await res.json();
          if (!cancelled && Array.isArray(data) && data.length > 0) {
            setCommits(data);
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingCommits(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
    };
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
          <Sparkles size={28} className="contribute-hero__icon" />
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
            {t("settings.contributors")} ({contributors.length})
          </h3>
          <span className="contribute-section__sub">{t("settings.contributorsDesc")}</span>
        </div>

        {loadingContributors ? (
          <p className="ui-field__desc">{t("settings.loadingContributors")}</p>
        ) : (
          <div className="contribute-grid">
            {contributors.map((c) => (
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
          <div className="contribute-timeline">
            {RELEASE_CHANGES.map((rel) => (
              <div key={rel.version} className="contribute-timeline__item">
                <div className="contribute-timeline__dot-wrap">
                  <div
                    className={`contribute-timeline__dot ${rel.isLatest ? "contribute-timeline__dot--latest" : ""}`}
                  />
                  <div className="contribute-timeline__line" />
                </div>
                <div className="contribute-timeline__content">
                  <div className="contribute-timeline__header">
                    <span className="contribute-timeline__version">{rel.version}</span>
                    {rel.isLatest && (
                      <span className="contribute-timeline__badge">Latest</span>
                    )}
                    <span className="contribute-timeline__date">{rel.date}</span>
                  </div>
                  <ul className="contribute-timeline__list">
                    {rel.items.map((it, idx) => (
                      <li key={idx} className="contribute-timeline__li">
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        ) : loadingCommits ? (
          <p className="ui-field__desc">{t("settings.loadingChanges")}</p>
        ) : commits.length === 0 ? (
          <p className="ui-field__desc">No recent commits found.</p>
        ) : (
          <div className="contribute-commits">
            {commits.map((c) => (
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

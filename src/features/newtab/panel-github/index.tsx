import { useCallback, useEffect, useState } from "react";
import { Bell, BookMarked, Flame, Github, Star, UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { useOnlineStatus, swr } from "@/core/net";
import { emit } from "@/core/event-bus";
import { notify } from "@/core/notification-engine";
import { Button, ReloadButton, Segmented, Skeleton } from "@/shared/ui";
import {
  fetchNotifications,
  fetchProfile,
  fetchTrending,
  type GitHubNotification,
  type GitHubProfile,
  type TrendingRepo,
  type TrendingWindow,
} from "./api";
import { githubSettingsSchema } from "./settings.schema";
import { ContribGraph } from "./ContribGraph";
import "./github.css";

export const GITHUB_FEATURE_ID = "panel-github";

function PanelGitHub() {
  const { t } = useTranslation();
  const values = useFeatureValues(GITHUB_FEATURE_ID);
  const online = useOnlineStatus();
  const token = ((values.token as string) ?? "").trim();
  const showTrending = values.showTrending === true;

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [profile, setProfile] = useState<GitHubProfile | null>(null);
  const [notifs, setNotifs] = useState<GitHubNotification[]>([]);
  const [trendWindow, setTrendWindow] = useState<TrendingWindow>("week");
  const [trending, setTrending] = useState<TrendingRepo[]>([]);

  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (showTrending && token) void fetchTrending(token, trendWindow).then(setTrending);
    else setTrending([]);
  }, [showTrending, token, trendWindow, online]);

  const load = useCallback(
    async (force?: boolean) => {
      if (!token) {
        setStatus("idle");
        setProfile(null);
        return;
      }
      if (status !== "success") setStatus("loading");

      await swr<GitHubProfile>({
        namespace: "github",
        key: "me",
        ttlMs: 60 * 60 * 1000, // contribution graph caches ~1h (docs/phase-3 §2)
        force,
        fetcher: () => fetchProfile(token),
        onData: (data) => {
          setProfile(data);
          setStatus("success");
        },
        onError: (_e, hadCache) => {
          if (!hadCache && !profile) setStatus("error");
        },
      });

      // notifications — fresher; raise an in-app/OS notification when count rises
      const list = await fetchNotifications(token);
      setNotifs(list);
      const count = list.length;
      const prev = Number(localStorage.getItem("github.lastUnread") ?? "0");
      if (count > prev) {
        void notify({ source: GITHUB_FEATURE_ID, type: "info", title: "GitHub", body: `${count} ${t("github.unread")}` });
      }
      localStorage.setItem("github.lastUnread", String(count));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, online]);

  const forceReload = async () => {
    setReloading(true);
    await load(true);
    if (showTrending && token) setTrending(await fetchTrending(token, trendWindow));
    setReloading(false);
  };

  if (!token) {
    return (
      <div className="news__perm">
        <p className="ui-field__desc">{t("github.notConnected")}</p>
        <Button variant="primary" onClick={() => emit("settings:open", { featureId: GITHUB_FEATURE_ID })}>
          {t("github.openSettings")}
        </Button>
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div>
        <Skeleton width="70%" height={56} radius="var(--radius-md)" />
        <div style={{ height: 16 }} />
        <Skeleton width="100%" height={72} />
      </div>
    );
  }

  if (status === "error" || !profile) {
    return <p className="ui-field__desc">{t("github.error")}</p>;
  }

  return (
    <div className="gh">
      <div className="gh__reload">
        <ReloadButton busy={reloading} label={t("common.retry")} onClick={() => void forceReload()} />
      </div>
      <div className="gh__profile">
        <img className="gh__avatar" src={profile.avatarUrl} alt={profile.login} />
        <div>
          <div className="gh__name">{profile.name ?? profile.login}</div>
          <div className="gh__login">@{profile.login}</div>
          {profile.bio && <div className="gh__bio">{profile.bio}</div>}
        </div>
      </div>

      <div className="gh__lines">
        <span className="gh__line">
          <Users size={14} /> {t("github.followers")}: <b>{profile.followers}</b>
        </span>
        <span className="gh__line">
          <UserPlus size={14} /> {t("github.following")}: <b>{profile.following}</b>
        </span>
        <span className="gh__line">
          <BookMarked size={14} /> {t("github.repos")}: <b>{profile.repos}</b>
        </span>
      </div>

      <div className="gh__section-title">
        {profile.totalContributions} {t("github.contributions")}
      </div>
      <ContribGraph weeks={profile.weeks} />

      {profile.recentRepos?.length > 0 && (
        <>
          <div className="gh__section-title" style={{ marginTop: "var(--space-4)" }}>
            {t("github.recentRepos")}
          </div>
          <div className="gh__list">
            {profile.recentRepos.map((r) => (
              <a
                key={r.name}
                className="gh__repo"
                href={r.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <div className="gh__repo-head">
                  <span className="gh__repo-name">{r.name}</span>
                  {r.stars > 0 && (
                    <span className="gh__repo-stars">
                      <Star size={12} /> {r.stars}
                    </span>
                  )}
                </div>
                {r.description && <div className="gh__repo-desc">{r.description}</div>}
                {r.language && <span className="gh__repo-lang">{r.language}</span>}
              </a>
            ))}
          </div>
        </>
      )}

      {notifs.length > 0 && (
        <>
          <div className="gh__section-title" style={{ marginTop: "var(--space-4)" }}>
            <Bell size={13} style={{ verticalAlign: "-2px" }} /> {notifs.length} {t("github.unread")}
          </div>
          <div className="gh__list">
            {notifs.map((n) => (
              <a
                key={n.id}
                className="gh__notif"
                href={n.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <div className="gh__notif-title">{n.title}</div>
                <div className="gh__notif-repo">{n.repo}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {showTrending && (
        <>
          <div className="gh__section-title" style={{ marginTop: "var(--space-4)" }}>
            <Flame size={13} style={{ verticalAlign: "-2px" }} /> {t("github.trending")}
          </div>
          <div style={{ marginBottom: "var(--space-2)" }}>
            <Segmented
              value={trendWindow}
              onChange={(v) => setTrendWindow(v as TrendingWindow)}
              options={[
                { value: "day", label: t("github.day") },
                { value: "week", label: t("github.week") },
                { value: "month", label: t("github.month") },
              ]}
            />
          </div>
          <div className="gh__list">
            {trending.map((r) => (
              <a key={r.name} className="gh__repo" href={r.url} target="_blank" rel="noreferrer noopener">
                <div className="gh__repo-head">
                  <span className="gh__repo-name">{r.name}</span>
                  <span className="gh__repo-stars">
                    <Star size={12} /> {r.stars.toLocaleString()}
                  </span>
                </div>
                {r.description && <div className="gh__repo-desc">{r.description}</div>}
                {r.language && <span className="gh__repo-lang">{r.language}</span>}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

registerFeature({
  id: GITHUB_FEATURE_ID,
  zone: "left-sidebar",
  nameKey: "features.panel-github",
  icon: Github,
  defaultEnabled: false,
  requiresNetwork: true,
  notifiable: true,
  settingsSchema: githubSettingsSchema,
  component: PanelGitHub,
  order: 3,
});

export default PanelGitHub;

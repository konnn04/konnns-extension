import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { useFeatureValues } from "@/core/settings-engine/settingsStore";
import { useOnlineStatus } from "@/core/net";
import { emit } from "@/core/event-bus";
import { Button, IconButton } from "@/shared/ui";
import { RedirectUriField } from "@/core/oauth/RedirectUriField";
import { useElementSize } from "@/shared/utils/useElementSize";
import {
  connectSpotify,
  control,
  disconnectSpotify,
  getNowPlaying,
  getValidToken,
  type NowPlaying,
  type PlaybackAction,
} from "./api";
import { spotifySettingsSchema } from "./settings.schema";
import "./spotify.css";

export const SPOTIFY_FEATURE_ID = "panel-spotify";

function PanelSpotify() {
  const { t } = useTranslation();
  const values = useFeatureValues(SPOTIFY_FEATURE_ID);
  const online = useOnlineStatus();
  const clientId = ((values.clientId as string) ?? "").trim();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [np, setNp] = useState<NowPlaying | null>(null);
  const [progress, setProgress] = useState(0);
  const tokenRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setConnected(false);
      return;
    }
    const token = await getValidToken(clientId);
    tokenRef.current = token;
    setConnected(!!token);
    if (!token) return;
    try {
      const data = await getNowPlaying(token);
      setNp(data);
      setProgress(data?.progressMs ?? 0);
    } catch {
      /* keep */
    }
  }, [clientId]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 5000);
    return () => window.clearInterval(id);
  }, [refresh, online]);

  useEffect(() => {
    if (!np?.isPlaying) return;
    const id = window.setInterval(() => {
      setProgress((p) => Math.min(np.durationMs, p + 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [np]);

  const doControl = async (action: PlaybackAction) => {
    if (tokenRef.current) {
      const ok = await control(tokenRef.current, action, np?.uri);
      if (!ok && action === "play" && np?.spotifyUrl) {
        // If playback failed (e.g. no active device), offer opening Spotify
        window.open(np.spotifyUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(refresh, 500);
    }
  };

  const openSpotify = () => {
    if (np?.spotifyUrl) {
      window.open(np.spotifyUrl, "_blank", "noopener,noreferrer");
    } else {
      window.open("https://open.spotify.com", "_blank", "noopener,noreferrer");
    }
  };

  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const isNarrow = size.width > 0 && size.width < 220;
  const isWide = size.width >= 270;

  // View is status-only — connect/disconnect lives in Settings
  if (!clientId || connected === false) {
    return (
      <div className="sp__connect">
        <p className="ui-field__desc">{t("spotify.notConnected")}</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => emit("settings:open", { featureId: SPOTIFY_FEATURE_ID })}
        >
          {t("github.openSettings")}
        </Button>
      </div>
    );
  }

  if (!np) {
    return <p className="ui-field__desc">{t("spotify.nothingPlaying")}</p>;
  }

  const pct = np.durationMs > 0 ? (progress / np.durationMs) * 100 : 0;
  const layoutClass = isNarrow ? "sp--narrow" : isWide ? "sp--horizontal" : "sp--vertical";

  return (
    <div className={`sp ${layoutClass}`} ref={sizeRef}>
      <div className="sp__player">
        <div
          className="sp__art"
          style={np.albumArt ? { backgroundImage: `url(${np.albumArt})` } : undefined}
          onClick={openSpotify}
          title={t("spotify.openInSpotify")}
          role="button"
          tabIndex={0}
        >
          {isNarrow && (
            <div className="sp__art-overlay" onClick={(e) => e.stopPropagation()}>
              <IconButton label="Previous" onClick={() => void doControl("previous")}>
                <SkipBack size={16} />
              </IconButton>
              <IconButton
                label={np.isPlaying ? "Pause" : "Play"}
                onClick={() => void doControl(np.isPlaying ? "pause" : "play")}
              >
                {np.isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </IconButton>
              <IconButton label="Next" onClick={() => void doControl("next")}>
                <SkipForward size={16} />
              </IconButton>
            </div>
          )}
        </div>

        <div className="sp__meta">
          <div className="sp__header-row">
            {np.isRecentlyPlayed && (
              <span className="sp__badge">{t("spotify.recentlyPlayed")}</span>
            )}
            <button
              type="button"
              className="sp__link-btn"
              onClick={openSpotify}
              title={t("spotify.openInSpotify")}
              aria-label={t("spotify.openInSpotify")}
            >
              <ExternalLink size={13} />
            </button>
          </div>

          <div
            className="sp__title"
            onClick={openSpotify}
            title={`${np.title} (${t("spotify.openInSpotify")})`}
          >
            {np.title}
          </div>
          <div className="sp__artist">{np.artist}</div>

          <div className="sp__progress">
            <div className="sp__progress-fill" style={{ width: `${pct}%` }} />
          </div>

          {!isNarrow && (
            <div className="sp__controls">
              <IconButton label="Previous" onClick={() => void doControl("previous")}>
                <SkipBack size={isWide ? 16 : 18} />
              </IconButton>
              <IconButton
                label={np.isPlaying ? "Pause" : "Play"}
                onClick={() => void doControl(np.isPlaying ? "pause" : "play")}
              >
                {np.isPlaying ? <Pause size={isWide ? 20 : 22} /> : <Play size={isWide ? 20 : 22} />}
              </IconButton>
              <IconButton label="Next" onClick={() => void doControl("next")}>
                <SkipForward size={isWide ? 16 : 18} />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Settings section: redirect URI + connect/disconnect (kept out of the view). */
function SpotifySettings() {
  const { t } = useTranslation();
  const values = useFeatureValues(SPOTIFY_FEATURE_ID);
  const clientId = ((values.clientId as string) ?? "").trim();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (clientId) void getValidToken(clientId).then((tok) => setConnected(!!tok));
  }, [clientId]);

  return (
    <div className="settings-section">
      <RedirectUriField label={t("spotify.redirectUri")} path="spotify" />
      {clientId &&
        (connected ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void disconnectSpotify().then(() => setConnected(false))}
          >
            {t("spotify.disconnect")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={async () => {
              if (await connectSpotify(clientId)) setConnected(true);
            }}
          >
            {t("spotify.connect")}
          </Button>
        ))}
      <p className="ui-field__desc">{t("spotify.premiumNote")}</p>
    </div>
  );
}

registerFeature({
  id: SPOTIFY_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.panel-spotify",
  icon: Music,
  defaultEnabled: false,
  requiresNetwork: true,
  settingsSchema: spotifySettingsSchema,
  settingsExtra: SpotifySettings,
  component: PanelSpotify,
  order: 4,
});

export default PanelSpotify;

import {
  clearToken,
  createPkce,
  getRedirectUri,
  isExpired,
  launchWebAuthFlow,
  loadToken,
  parseCallback,
  saveToken,
  type StoredToken,
} from "@/core/oauth";


const SPOTIFY_REDIRECT_PATH = "spotify";

const AUTH = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

export interface NowPlaying {
  isPlaying: boolean;
  title: string;
  artist: string;
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
}

const verifierStore = new Map<string, string>();

export async function connectSpotify(clientId: string): Promise<boolean> {
  const { verifier, challenge } = await createPkce();
  const redirectUri = getRedirectUri(SPOTIFY_REDIRECT_PATH);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SCOPES,
  });

  const redirect = await launchWebAuthFlow(`${AUTH}?${params}`);
  const code = parseCallback(redirect).get("code");
  if (!code) return false;
  verifierStore.set(clientId, verifier);

  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) return false;
  const json = await res.json();
  await saveToken("spotify", {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return true;
}

async function refresh(clientId: string, token: StoredToken): Promise<StoredToken | null> {
  if (!token.refreshToken) return null;
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
      client_id: clientId,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const next: StoredToken = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? token.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  await saveToken("spotify", next);
  return next;
}

export async function getValidToken(clientId: string): Promise<string | null> {
  let token = await loadToken("spotify");
  if (!token) return null;
  if (isExpired(token)) token = await refresh(clientId, token);
  return token?.accessToken ?? null;
}

export async function disconnectSpotify(): Promise<void> {
  await clearToken("spotify");
}

export async function getNowPlaying(token: string): Promise<NowPlaying | null> {
  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204 || res.status === 202) return null; 
  if (!res.ok) throw new Error(`spotify ${res.status}`);
  const json = await res.json();
  if (!json?.item) return null;
  return {
    isPlaying: json.is_playing,
    title: json.item.name,
    artist: (json.item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
    albumArt: json.item.album?.images?.[0]?.url ?? null,
    progressMs: json.progress_ms ?? 0,
    durationMs: json.item.duration_ms ?? 0,
  };
}

export type PlaybackAction = "play" | "pause" | "next" | "previous";

export async function control(token: string, action: PlaybackAction): Promise<void> {
  const method = action === "next" || action === "previous" ? "POST" : "PUT";
  await fetch(`https://api.spotify.com/v1/me/player/${action}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

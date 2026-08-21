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
  "user-read-recently-played",
].join(" ");

export interface NowPlaying {
  isPlaying: boolean;
  isRecentlyPlayed?: boolean;
  title: string;
  artist: string;
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  spotifyUrl?: string;
  uri?: string;
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

export async function getRecentlyPlayed(token: string): Promise<NowPlaying | null> {
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const item = json?.items?.[0]?.track;
    if (!item) return null;
    return {
      isPlaying: false,
      isRecentlyPlayed: true,
      title: item.name ?? "",
      artist: (item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
      albumArt: item.album?.images?.[0]?.url ?? null,
      progressMs: 0,
      durationMs: item.duration_ms ?? 0,
      spotifyUrl: item.external_urls?.spotify,
      uri: item.uri,
    };
  } catch {
    return null;
  }
}

export async function getNowPlaying(token: string): Promise<NowPlaying | null> {
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204 || res.status === 202) {
      return await getRecentlyPlayed(token);
    }
    if (!res.ok) {
      return await getRecentlyPlayed(token);
    }
    const json = await res.json();
    if (!json?.item) {
      return await getRecentlyPlayed(token);
    }
    return {
      isPlaying: json.is_playing ?? false,
      isRecentlyPlayed: false,
      title: json.item.name ?? "",
      artist: (json.item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
      albumArt: json.item.album?.images?.[0]?.url ?? null,
      progressMs: json.progress_ms ?? 0,
      durationMs: json.item.duration_ms ?? 0,
      spotifyUrl: json.item.external_urls?.spotify,
      uri: json.item.uri,
    };
  } catch {
    return await getRecentlyPlayed(token);
  }
}

export type PlaybackAction = "play" | "pause" | "next" | "previous";

export async function control(token: string, action: PlaybackAction, uri?: string): Promise<boolean> {
  const method = action === "next" || action === "previous" ? "POST" : "PUT";
  const body = action === "play" && uri ? JSON.stringify({ uris: [uri] }) : undefined;
  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player/${action}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}

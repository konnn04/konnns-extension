import { browser } from "wxt/browser";

/**
 * Cross-browser OAuth helper (docs/01-tech-stack §6 + phase-3). Wraps
 * browser.identity.launchWebAuthFlow so Chrome/Firefox share one internal API,
 * with PKCE utilities and session-scoped token storage (docs NFR: access tokens
 * in storage.session, not raw IndexedDB).
 */

/**
 * Get the extension's OAuth redirect URI.
 * @param path Optional path to differentiate providers (e.g. "spotify", "google-calendar").
 *             Chrome catches all redirects to https://<ext-id>.chromiumapp.org/*
 */
export function getRedirectUri(path = ""): string {
  const base = browser.identity.getRedirectURL();
  return path ? `${base}${path}` : base;
}

/**
 * Async version that fetches the redirect URI from the background script.
 * Use this in pages that may not have direct access to browser.identity
 * (e.g. newtab page in wxt dev mode served from localhost).
 */
export async function getRedirectUriAsync(path = ""): Promise<string> {
  try {
    return getRedirectUri(path);
  } catch {
    return browser.runtime.sendMessage({ type: "getRedirectUri", path });
  }
}

/** Runs the interactive auth flow, returns the final redirect URL. */
export async function launchWebAuthFlow(authUrl: string, interactive = true): Promise<string> {
  const result = await browser.identity.launchWebAuthFlow({ url: authUrl, interactive });
  if (!result) throw new Error("auth flow cancelled");
  return result;
}

function base64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64url(bytes).slice(0, len);
}

/** PKCE code_verifier + code_challenge (S256). */
export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomString(64);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

export function parseCallback(redirectUrl: string): URLSearchParams {
  const url = new URL(redirectUrl);
  // params can arrive in the query (?code=) or the fragment (#access_token=)
  const params = new URLSearchParams(url.search);
  if (url.hash) {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    hashParams.forEach((v, k) => params.set(k, v));
  }
  return params;
}

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  scope?: string;
}

/** storage.session keeps access tokens out of long-lived storage. */
function session() {
  return browser.storage.session ?? browser.storage.local;
}

export async function saveToken(key: string, token: StoredToken): Promise<void> {
  await session().set({ [`oauth:${key}`]: token });
}

export async function loadToken(key: string): Promise<StoredToken | null> {
  const res = await session().get(`oauth:${key}`);
  return (res[`oauth:${key}`] as StoredToken) ?? null;
}

export async function clearToken(key: string): Promise<void> {
  await session().remove(`oauth:${key}`);
}

export function isExpired(token: StoredToken, skewMs = 60_000): boolean {
  return token.expiresAt !== undefined && Date.now() > token.expiresAt - skewMs;
}

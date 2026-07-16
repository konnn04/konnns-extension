import { browser } from "wxt/browser";

export interface PermissionSpec {
  permissions?: string[];
  origins?: string[];
}

type ChromePermissions = {
  permissions?: {
    request?: (p: PermissionSpec, cb: (granted: boolean) => void) => void;
  };
};

// the polyfill types narrow `permissions` to a manifest-permission union; our
// callers pass plain strings (incl. runtime-optional ones), so widen here.
type PolyfillSpec = Parameters<typeof browser.permissions.contains>[0];

/**
 * Gesture-safe permission request.
 *
 * The promisified `browser.permissions.request` from webextension-polyfill can
 * lose the user-gesture on Chromium, so the browser silently refuses to show
 * the grant prompt. Calling the raw `chrome.permissions.request` callback form
 * keeps the gesture chain intact. We fall back to the polyfill on Firefox.
 */
export function requestPermissions(perms: PermissionSpec): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const chromeApi = (globalThis as { chrome?: ChromePermissions }).chrome;
      if (chromeApi?.permissions?.request) {
        chromeApi.permissions.request(perms, (granted) => resolve(!!granted));
        return;
      }
      void browser.permissions
        .request(perms as PolyfillSpec)
        .then((granted) => resolve(!!granted))
        .catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

export async function hasPermissions(perms: PermissionSpec): Promise<boolean> {
  try {
    return await browser.permissions.contains(perms as PolyfillSpec);
  } catch {
    return false;
  }
}

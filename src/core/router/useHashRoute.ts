import { useCallback, useEffect, useState } from "react";

/**
 * Minimal hash router for the Custom Site — docs/site/00-tong-quan.md §3.
 *
 * Deliberately not react-router: the project has no router at all today (the
 * NewTab navigates with plain state) and the site needs three things — read the
 * current path, navigate, go back. ~40 lines beats a dependency.
 *
 * Shape: site.html#/audio?foo=bar  →  { path: "/audio", query: { foo: "bar" } }
 */

export interface Route {
  /** always starts with "/" */
  path: string;
  /** path split on "/" with empties removed: "/clip/abc" → ["clip", "abc"] */
  segments: string[];
  query: Record<string, string>;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart = ""] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const query: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(queryPart)) query[k] = v;
  return { path: path.replace(/\/+$/, "") || "/", segments: path.split("/").filter(Boolean), query };
}

export function navigate(path: string, opts?: { replace?: boolean }): void {
  const hash = `#${path.startsWith("/") ? path : `/${path}`}`;
  if (opts?.replace) {
    history.replaceState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = hash;
  }
}

export function useHashRoute(): Route & { navigate: typeof navigate; back: () => void } {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const back = useCallback(() => {
    if (history.length > 1) history.back();
    else navigate("/", { replace: true });
  }, []);

  return { ...route, navigate, back };
}

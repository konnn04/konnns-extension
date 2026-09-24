import { browser } from "wxt/browser";

/**
 * Must run before anything imports "@excalidraw/excalidraw" — docs/roadmap/03
 * §5. Excalidraw resolves its own font files (Virgil, Cascadia Code, …)
 * against `window.EXCALIDRAW_ASSET_PATH` at the moment it loads a font, and
 * defaults to a relative path that resolves to nothing useful inside an
 * extension page. `public/excalidraw-assets/` mirrors the package's own
 * `dist/prod/fonts/` layout exactly (a straight copy), so the relative paths
 * baked into Excalidraw's code (`./fonts/Virgil/Virgil.woff2`, etc.) resolve
 * correctly once this base is set.
 */
function assetBaseUrl(): string {
  try {
    return browser.runtime.getURL("excalidraw-assets/" as never);
  } catch {
    return "/excalidraw-assets/";
  }
}

(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = assetBaseUrl();

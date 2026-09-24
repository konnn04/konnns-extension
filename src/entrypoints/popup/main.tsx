import React from "react";
import ReactDOM from "react-dom/client";
// Base styles FIRST. The dev server injects CSS as <style> tags in module
// evaluation order, so importing a component (and its stylesheet) above these
// would let global.css override the page's own rules — a mismatch with the
// production build, where the bundler emits base styles first.
import "@/core/i18n";
import "@/styles/tokens.css";
import "@/styles/global.css";
import PopupApp from "@/app/popup/PopupApp";

// Register site apps so the popup can list them (components stay lazy, so no
// app's bundle is pulled in just to show its name).
import "@/features/site";
// Register popup-native widgets (Audio Mixer, …) — these are NOT lazy, they
// live and die within the popup itself, see core/popup-widget-registry.
import "@/features/popup";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);

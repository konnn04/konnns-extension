import React from "react";
import ReactDOM from "react-dom/client";
// Base styles FIRST — see the note in entrypoints/popup/main.tsx: dev injects
// CSS in module evaluation order, production emits base styles first, and only
// this ordering makes the two agree.
import "@/core/i18n";
import "@/styles/tokens.css";
import "@/styles/global.css";
import SiteApp from "@/app/site/SiteApp";

// Register every site app (side-effect imports populate the Site App Registry)
import "@/features/site";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SiteApp />
  </React.StrictMode>,
);

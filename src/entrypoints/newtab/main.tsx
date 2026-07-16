import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/app/newtab/App";
import "@/core/i18n";
import "@/styles/tokens.css";
import "@/styles/global.css";

// Register all features (side-effect imports populate the Feature Registry)
import "@/features/newtab";

// Reduce the risk of the browser evicting IndexedDB data (wallpapers...)
navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

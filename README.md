<div align="center">
  <h1>My NewTab</h1>
  <p>A highly personalized browser extension that transforms your new tab into a powerful dashboard with convenient tools at your fingertips.</p>

  <a href="https://github.com/konnn04/konnns-extension/actions"><img src="https://img.shields.io/github/actions/workflow/status/konnn04/konnns-extension/ci.yml?branch=main&label=CI&logo=github" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/konnn04/konnns-extension?label=License" alt="License"></a>
  <img src="https://img.shields.io/badge/Chrome%20MV3-4285F4?logo=googlechrome&logoColor=white" alt="Chrome MV3">
  <img src="https://img.shields.io/badge/Firefox%20MV3-FF7139?logo=firefoxbrowser&logoColor=white" alt="Firefox MV3">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/WXT-00A98F?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTYgMkwyIDh2MTZsMTQgNiAxNC02VjhMMTYgMnoiIGZpbGw9IiMwMEE5OEYiLz48cGF0aCBkPSJNMTYgMTR2MTBsMTQtNlY4TDE2IDE0eiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==&logoColor=white" alt="WXT">
</div>

---

A browser extension that gives you a beautiful, fully customizable new tab page. Replace the boring default with a personal dashboard -- search, clock, weather, wallpaper, bookmarks, and side panels for GitHub, Spotify, calendar, news, Pomodoro, tasks, and notes. More entrypoints (popup, side panel) coming soon.

## Features

### New Tab

The new tab page is the main entrypoint -- a full-featured dashboard that replaces your browser's default.

- **Search** -- multi-engine bar with bang shortcuts (`!g`, `!yt`, `!gh`, ...)
- **Clock & Weather** -- 3 clock styles, live weather with offline cache
- **Wallpaper** -- image/video/URL, crossfade, auto-pause when hidden
- **Bookmark Bar** -- Chrome bookmarks API, dock-style animation
- **GitHub Panel** -- profile, contribution heatmap, unread notifications
- **Spotify Panel** -- OAuth PKCE, mini-player with controls
- **Calendar Panel** -- month view, lunar calendar, Google Calendar integration
- **News Panel** -- multi-source RSS with thumbnails
- **Pomodoro Timer** -- background alarms, OS-level notifications
- **Tasks & Notes** -- CRUD todo with drag-drop, rich text with autosave
- **Theme Engine** -- 5 themes, light/dark, glass effects, parallax
- **i18n** -- Vietnamese and English
- **Backup & Restore** -- export/import settings as zip

### Popup

Quick-access popup from the browser toolbar. (Coming soon)

### Side Panel

Persistent side panel for quick tool access. (Coming soon)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

### Install & Run

```bash
pnpm install
pnpm dev        # Chrome (HMR)
pnpm dev:firefox
```

### Build & Load

```bash
pnpm build                # .output/chrome-mv3
pnpm build:firefox        # .output/firefox-mv3
```

1. Go to `chrome://extensions` (or `about:debugging` in Firefox)
2. Enable Developer mode
3. Click "Load unpacked" and select the output folder

### TypeScript Check

```bash
pnpm compile    # tsc --noEmit
```

## Third-Party Mentions

This project uses the following open-source libraries and services:

| Library/Service | Purpose | License |
|---|---|---|
| [React](https://react.dev/) | UI framework | MIT |
| [TypeScript](https://www.typescriptlang.org/) | Language | Apache 2.0 |
| [WXT](https://wxt.dev/) | Extension framework | MIT |
| [Zustand](https://github.com/pmndrs/zustand) | State management | MIT |
| [Dexie.js](https://dexie.org/) | IndexedDB wrapper | Apache 2.0 |
| [Framer Motion](https://www.framer.com/motion/) | Animations | MIT |
| [Lucide](https://lucide.dev/) | UI icons | ISC |
| [react-i18next](https://react.i18next.com/) | Internationalization | MIT |
| [fflate](https://github.com/101arrowz/fflate) | ZIP compression (backup) | MIT |
| [Open-Meteo](https://open-meteo.com/) | Weather data (free API) | free |
| [Picsum](https://picsum.photos/) | Random wallpaper images (free API) | free |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with HMR (Chrome) |
| `pnpm dev:firefox` | Start dev server with HMR (Firefox) |
| `pnpm build` | Build for production (Chrome) |
| `pnpm build:firefox` | Build for production (Firefox) |
| `pnpm compile` | Run TypeScript type checker |
| `pnpm zip` | Package extension for distribution |
| `pnpm lint-staged` | Run staged file checks (used by pre-commit hook) |

## Architecture

```
src/
  entrypoints/       # Extension entry points (newtab, background SW)
  core/              # Shared core modules
    feature-registry/   # Self-registering feature system
    settings-engine/    # Schema-driven settings forms
    theme-engine/       # Design tokens and theming
    layout-engine/      # Sidebar/panel/window managers
    notification-engine/# In-app + OS-level notifications
    oauth/              # Cross-browser OAuth with PKCE
    storage/            # Dexie schema + backup
    i18n/               # Translation files
  features/           # Each feature in its own folder
  shared/             # Reusable UI kit and icons
  styles/             # Design tokens and global CSS
  app/                # Shell (layout, modals, onboarding)
docs/                 # Detailed documentation
```

Each feature self-registers via `registerFeature()` so the core never needs to hardcode a feature list.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our commit convention, development workflow, and code style.

## License

This project is licensed under the MIT License -- see the [LICENSE](LICENSE) file for details.

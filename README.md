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

A browser extension built around three surfaces: a fully customizable **New Tab** dashboard, a **Custom Site** of small in-browser apps, and **embedded tools** that run on the page you are reading -- with a toolbar popup tying them together.

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

The launcher on the browser toolbar: one button to open the Custom Site home, the list of site apps, and the embedded tools that can run on the current tab. It inherits the theme, font and language chosen on the New Tab.

### Custom Site

A page of its own (`site.html`) hosting small apps, with a home grid and a left rail generated from the Site App Registry. Everything runs locally -- no file ever leaves the browser.

- **Audio Editor** -- Audacity-style editing: L/R waveform, drag selection, split into segments, trim/delete/silence/reverse, fade with four curves, gain, normalize, and a voice-enhancement chain (rumble cut, noise gate, compressor, presence EQ). Exports WAV (16/24-bit, 32-bit float) or MP3, mono or stereo -- and every segment at once as a zip.
- **Video Editor** -- a multi-track timeline: typed tracks (video/audio/text/effect), clips that never overlap, trim, split, slip, ripple delete, snapping and marquee select. Crop, colour, opacity, fades, captions with outlines, and blur or solid boxes for covering anything sensitive. Preview and export share one render pipeline, so the file matches the screen. Exports MP4/WebM/GIF via [mediabunny](https://mediabunny.dev/) (WebCodecs).
- **Image Editor** -- layer-based editing on [Fabric.js](http://fabricjs.com/): brush, shapes, text, crop, redact, filters, and paste from clipboard.
- **Whiteboard** -- infinite canvas powered by a self-hosted [Excalidraw](https://excalidraw.com/).
- **PDF -> Text** -- text extraction with [pdf.js](https://mozilla.github.io/pdf.js/), falling back to OCR ([tesseract.js](https://tesseract.projectnaptha.com/)) for scanned pages. English and Vietnamese.
- **Markdown -> PDF** -- live preview and real paper output: paper size, orientation, margins and page numbers, paginated by measuring the content rather than leaving it to the browser.
- **QR Code Generator** -- many content types, logo, colours, styled modules.
- **Web Time Tracker** -- per-site time, tracked in the background with idle detection, shown as a dashboard.
- **Auto Clear Cache** -- scheduled clean-up of cache, cookies and history by rule.
- **Clip Viewer** -- quick look at whatever was handed over from another surface.

See [docs/site/00-tong-quan.md](docs/site/00-tong-quan.md).

### Embedded Tools

Tools injected into the page you are reading, **on demand**: no `<all_urls>` content script and no scary permission prompt at install -- just `activeTab` + `scripting` at the moment you press the button.

- **Page to Markdown** -- extracts the main content as clean Markdown to feed an AI, using [Defuddle](https://github.com/kepano/defuddle) (the library behind Obsidian Web Clipper). Front matter, selection-only or whole-page modes, and optional link stripping to save tokens.

See [docs/embed/00-tong-quan.md](docs/embed/00-tong-quan.md).

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
| [mediabunny](https://mediabunny.dev/) | Video/audio decode, mux and encode (WebCodecs) | MPL-2.0 |
| [Fabric.js](http://fabricjs.com/) | Canvas layers for the Image Editor | MIT |
| [Excalidraw](https://excalidraw.com/) | Whiteboard canvas (self-hosted assets) | MIT |
| [pdf.js](https://mozilla.github.io/pdf.js/) | PDF parsing and rendering | Apache 2.0 |
| [tesseract.js](https://tesseract.projectnaptha.com/) | OCR fallback for scanned PDFs | Apache 2.0 |
| [gifenc](https://github.com/mattdesl/gifenc) | GIF quantization and encoding | MIT |
| [CodeMirror 6](https://codemirror.net/) | Markdown editor | MIT |
| [markdown-it](https://github.com/markdown-it/markdown-it) | Markdown rendering | MIT |
| [DOMPurify](https://github.com/cure53/DOMPurify) | HTML sanitising | MPL-2.0 |
| [Defuddle](https://github.com/kepano/defuddle) | Main-content extraction for Page to Markdown | MIT |
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
| `pnpm lint` | Run ESLint |
| `pnpm lint-staged` | Run staged file checks (used by pre-commit hook) |

## Architecture

```
src/
  entrypoints/       # One per browser surface
    newtab/             # New Tab page
    popup/              # Toolbar launcher
    site/               # Custom Site (site.html)
    embed.content/      # On-demand content script
    background.ts       # Service worker + message router
  core/              # Shared core modules
    feature-registry/   # Self-registering New Tab features
    site-registry/      # Self-registering Custom Site apps
    embed-registry/     # Self-registering embedded tools
    messaging/          # Typed messages + on-demand injection
    handoff/            # Pass a payload between surfaces
    audio/              # Decode, DSP, enhance, WAV/MP3 export
    router/             # Minimal hash router for the site
    settings-engine/    # Schema-driven settings forms
    theme-engine/       # Design tokens and theming
    layout-engine/      # Sidebar/panel/window managers
    notification-engine/# In-app + OS-level notifications
    oauth/              # Cross-browser OAuth with PKCE
    storage/            # Dexie schema + backup
    i18n/               # Translation files
  features/          # One folder per surface, then per feature.
    newtab/             #   A tool is a folder you can delete; ESLint blocks
    site/               #   cross-tool imports in site/, embed/ and popup/.
    embed/
    popup/
  shared/            # Reusable UI kit, icons and pure utils
  styles/            # Design tokens and global CSS
  app/               # Shells: newtab/, popup/, site/
docs/                # Detailed documentation
```

Each feature self-registers via `registerFeature()`, `registerSiteApp()` or `registerEmbedTool()`, so nothing in the core ever hardcodes a list. Adding one means creating a folder and adding a single import line to that surface barrel. See [docs/architecture.md](docs/architecture.md).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our commit convention, development workflow, and code style.

## License

This project is licensed under the MIT License -- see the [LICENSE](LICENSE) file for details.

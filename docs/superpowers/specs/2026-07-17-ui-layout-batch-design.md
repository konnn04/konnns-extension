# UI/Layout Batch Improvements — Design Spec

Date: 2026-07-17

## Context

Nine independent UI/UX improvements requested for the newtab dashboard, spanning settings, side docks/panels, tool widgets, the GitHub panel, and the wallpaper manager. All settings plug into the existing generic settings system (`defineSchema` in each feature's `settings.schema.ts`, auto-rendered by `SettingsForm`, read via `useFeatureValues`) — no new settings-UI plumbing is needed anywhere in this spec.

## 1. Dock always-show toggle

- New Core setting `alwaysShowDocks` (toggle, default `false`).
- `LeftSidebar.tsx` and `RightSidebar.tsx` both read it; when `true`, `railVisible` is forced `true` regardless of hover state.
- Single toggle controls both docks (per user decision).

## 2. Left panel height + border-radius

- New Core settings: `panelHeight` (slider, 50vh–100vh, default 100vh), `panelRadius` (slider, 0–24px, default 0).
- Applied as CSS custom properties (`--panel-height`, `--panel-radius`) consumed by `.left-sidebar`/`.left-panel` in `left-sidebar.css`, replacing the hardcoded `height: 100%` and absent radius.

## 3. Global UI scale / font size / compact mode

- New "Appearance" section, Core settings:
  - `uiScale` (slider 80–130%, default 100%) — multiplies spacing design tokens via a root CSS var.
  - `fontScale` (slider 80–130%, default 100%) — independent multiplier on root `font-size`, decoupled from `uiScale`.
  - `compactMode` (toggle, default `false`) — sets a `data-compact` attribute on `<html>`; a compact CSS preset tightens `--space-*` tokens.
- Implemented against the existing design-token CSS variables (no new sizing system).

## 4. Swap panel/tool sides

- New Core setting `swapSidebars` (toggle, default `false` = panel left / tools right, i.e. today's behavior).
- Zone assignment (`"left-sidebar"` / `"right-sidebar"`) stays a static per-feature declaration; `LeftSidebar`/`RightSidebar` become swap-aware wrappers that pick which zone to render based on this setting, so the physical side is presentation-only.

## 5. Dock/tool-window overlap mode

- New setting `dockOverlapMode`: `"shift"` (current: docked tool windows push the rail outward by `DOCK_WIDTH × count`) vs `"overlay"` (windows sit flush at the outer edge, stacked above the panel via z-index, no reflow).
- `RightSidebar.tsx`'s existing shift logic (today right-side-only, using `right` offset) is generalized to work on whichever side hosts tools after a swap (#4).
- Add a CSS `transition` on `.tool-window`'s position properties (`left`/`right`/`top`/`width`), which today jump instantly — fixes both the overlap-mode switch and general dock/undock jank, tying into #9.

## 6. JS-driven responsive tool widgets

- New shared hook `useElementSize` (ResizeObserver-based) in `src/shared/utils/`.
- Applied to widgets that currently only have CSS-only (non-responsive, no media queries) layouts: `panel-spotify` (below a width threshold, secondary playback controls collapse into a hover-reveal overlay on the album art), `tool-pomodoro` (below a width threshold, labels and the settings button hide, showing icon-only controls), and the same threshold-based simplification pattern applied to `tool-tasks`, `tool-notes`, `tool-qr`, `tool-emoji`, `tool-english`, `tool-translate` where they currently overflow at narrow dock widths.

## 7. GitHub panel enhancements

- New toggle `showRecentRepos` (default `true`, preserves current behavior) — gates the recent-repos list that is currently always shown.
- New toggle `showLanguageStats` (default `false`) with an `excludedLanguages` and `excludedRepos` multi-select — computes language-share percentages client-side from the already-fetched repo list, rendered as a horizontal bar chart in the panel.
- Hover tooltips (date + commit count) added to the existing `ContribGraph` cells.
- Out of scope: "rank" computation (S/A/B/C tier à la github-readme-stats) — decided against per its API cost and estimation error; language stats + charts + hover info is the full scope of this item.

## 8. Wallpaper random mode + media-type badges

- `randomMode` boolean toggle replaced by a `select`: `off` / `images` / `videos` / `all`, filtering the shuffle pool in `WallpaperManager.tsx` accordingly. Existing persisted boolean values migrate: `true → "all"`, `false → "off"`.
- Each `Thumb` gets a small badge: play icon for video, "GIF" text badge for gif, no badge for static image — derived from the media type/extension already stored per wallpaper item.

## 9. Dock/panel fade transitions

- `left-rail`/`right-rail` hover fade already works correctly (existing CSS transition) — confirmed via code audit, no change needed there.
- The actual instant jumps are: (a) `.tool-window` docked positioning (no transition today — fixed by #5), and (b) the bookmark bar's `showMode: "always"/"hover"` visibility switch, which needs a `transition: opacity/transform` added consistent with the `--dur-panel` timing token already used elsewhere in the codebase.

## Non-goals

- No redesign of the settings UI framework — everything rides the existing generic schema/form system.
- No GitHub "rank" scoring (see #7).
- No changes to bookmark dock orientation modes (already implemented) beyond the transition fix in #9.

## Testing approach

Each item is a self-contained UI change; verified manually via the `run`/`verify` workflow in the dev server (WXT), checking both default and swapped/toggled states. No new automated test infra required beyond existing `tsc --noEmit` / `eslint` checks.

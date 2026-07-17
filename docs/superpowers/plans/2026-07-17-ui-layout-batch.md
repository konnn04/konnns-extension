# UI/Layout Batch Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship nine independent UI/layout improvements to the newtab dashboard: dock always-show toggle, panel height/radius, global UI scale, sidebar swap, dock overlap mode, JS-driven responsive tool widgets, GitHub panel stats, wallpaper random-mode select, and dock fade transitions.

**Architecture:** Every new setting is added to an existing `settings.schema.ts` (or `coreSettings.ts` for global ones) using the established `defineSchema`/`FieldDef` system — the generic `SettingsForm` renders it automatically, no new settings-UI code needed. Settings values are read via `useFeatureValues` and applied either as CSS custom properties on `document.documentElement` (following the existing `useTheme.ts` pattern) or as component logic branches. No test framework exists in this repo (`tsc --noEmit` + `eslint` are the only checks); verification is manual via the WXT dev server, following the project's existing convention.

**Tech Stack:** WXT + React 18 + TypeScript, Zustand stores, Dexie (IndexedDB) persistence, plain CSS with custom-property design tokens (`src/styles/tokens.css`), lucide-react icons, i18next.

## Global Constraints

- All new settings use `defineSchema` from `src/core/settings-engine/schema.ts` — do not hand-roll settings UI.
- All new i18n strings need entries in **both** `src/core/i18n/locales/en.json` and `src/core/i18n/locales/vi.json` (this is a Vietnamese-first product — do not skip `vi.json`).
- Never hardcode colors/spacing — consume `src/styles/tokens.css` custom properties (project rule, `docs/core-he-thong/01`).
- No test framework exists; do not invent one. Verify each task by running `pnpm compile` (tsc), `pnpm lint`, and a manual check via `pnpm dev` in the browser.
- Follow existing file co-location: a feature's component, CSS, and `settings.schema.ts` live together under `src/features/newtab/<feature>/`.

---

### Task 1: Dock always-show toggle

**Files:**
- Modify: `src/app/newtab/settings/coreSettings.ts` (add to `coreGeneralSchema`)
- Modify: `src/app/newtab/sidebar/LeftSidebar.tsx:31` (`railVisible` computation)
- Modify: `src/app/newtab/sidebar/RightSidebar.tsx:59` (`railVisible` computation)
- Modify: `src/core/i18n/locales/en.json`, `src/core/i18n/locales/vi.json`

**Interfaces:**
- Produces: `core.alwaysShowDocks: boolean` (via `useFeatureValues(CORE_FEATURE_ID)`), consumed by both sidebars.

- [ ] **Step 1: Add the setting to the core schema**

In `src/app/newtab/settings/coreSettings.ts`, add to `coreGeneralSchema` (after `restoreWindows`, before `soundEnabled`):

```ts
  alwaysShowDocks: {
    type: "toggle",
    label: "settings.alwaysShowDocks",
    description: "settings.alwaysShowDocksDesc",
    default: false,
  },
```

- [ ] **Step 2: Add i18n strings**

In `src/core/i18n/locales/en.json`, inside `"settings"`, add:
```json
"alwaysShowDocks": "Always show side docks",
"alwaysShowDocksDesc": "Keep the left and right docks visible without hovering",
```

In `src/core/i18n/locales/vi.json`, inside `"settings"`, add:
```json
"alwaysShowDocks": "Luôn hiện dock 2 bên",
"alwaysShowDocksDesc": "Giữ dock trái/phải luôn hiển thị mà không cần rê chuột",
```

- [ ] **Step 3: Wire into LeftSidebar**

In `src/app/newtab/sidebar/LeftSidebar.tsx`, the component already computes `core = useFeatureValues(CORE_FEATURE_ID)` at line 22. Change line 31:

```ts
  // rail is visible when a panel is open, hovering, or "always show" is on
  const alwaysShow = core.alwaysShowDocks === true;
  const railVisible = alwaysShow || hovering || open.length > 0;
```

- [ ] **Step 4: Wire into RightSidebar**

In `src/app/newtab/sidebar/RightSidebar.tsx`, `core` is already read at line 30. Change line 59:

```ts
  const alwaysShow = core.alwaysShowDocks === true;
  const railVisible = alwaysShow || hovering || open.length > 0;
```

- [ ] **Step 5: Verify**

Run: `pnpm compile && pnpm lint`
Expected: no errors.

Run `pnpm dev`, open the extension's new tab, open Settings → General, toggle "Always show side docks" on. Both rails should stay visible without hovering; toggle off and confirm hover-to-reveal still works.

- [ ] **Step 6: Commit**

```bash
git add src/app/newtab/settings/coreSettings.ts src/app/newtab/sidebar/LeftSidebar.tsx src/app/newtab/sidebar/RightSidebar.tsx src/core/i18n/locales/en.json src/core/i18n/locales/vi.json
git commit -m "feat: add always-show toggle for side docks"
```

---

### Task 2: Left panel height + border-radius settings

**Files:**
- Modify: `src/app/newtab/settings/coreSettings.ts`
- Modify: `src/core/theme-engine/useTheme.ts`
- Modify: `src/app/newtab/sidebar/left-sidebar.css`
- Modify: `src/core/i18n/locales/en.json`, `src/core/i18n/locales/vi.json`

**Interfaces:**
- Produces: CSS custom properties `--panel-height` (e.g. `"85vh"`) and `--panel-radius` (e.g. `"14px"`) on `:root`, consumed by `.left-sidebar` / `.left-panel`.

- [ ] **Step 1: Add settings to core schema**

In `coreSettingsSchemaRef`'s `coreGeneralSchema` in `coreSettings.ts`, add after `sidebarWidth`:

```ts
  panelHeight: {
    type: "slider",
    label: "settings.panelHeight",
    description: "settings.panelHeightDesc",
    min: 50,
    max: 100,
    step: 1,
    default: 100,
  },
  panelRadius: {
    type: "slider",
    label: "settings.panelRadius",
    min: 0,
    max: 24,
    step: 1,
    default: 0,
  },
```

- [ ] **Step 2: Add i18n strings**

`en.json` → `settings`:
```json
"panelHeight": "Panel height",
"panelHeightDesc": "Height of the left panel, as a percentage of the viewport",
"panelRadius": "Panel corner radius",
```

`vi.json` → `settings`:
```json
"panelHeight": "Chiều cao panel",
"panelHeightDesc": "Chiều cao panel trái, tính theo phần trăm chiều cao màn hình",
"panelRadius": "Độ bo góc panel",
```

- [ ] **Step 3: Apply as CSS variables in the theme engine**

In `src/core/theme-engine/useTheme.ts`, extend the existing appearance-controls effect (lines 61-72). Add alongside the existing reads:

```ts
  const panelHeight = typeof core.panelHeight === "number" ? core.panelHeight : 100;
  const panelRadius = typeof core.panelRadius === "number" ? core.panelRadius : 0;
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--wallpaper-dim", String(bgDim / 100));
    root.setProperty("--wallpaper-blur", `${bgBlur}px`);
    root.setProperty("--panel-alpha", String(panelAlpha / 100));
    root.setProperty("--glass-blur", `${panelBlur}px`);
    root.setProperty("--panel-height", `${panelHeight}vh`);
    root.setProperty("--panel-radius", `${panelRadius}px`);
  }, [bgDim, bgBlur, panelAlpha, panelBlur, panelHeight, panelRadius]);
```

(Add `panelHeight`/`panelRadius` to the existing `const bgDim = ...` block above it, following the same `typeof core.X === "number" ? core.X : default` pattern.)

- [ ] **Step 4: Add fallback tokens and consume in CSS**

In `src/styles/tokens.css`, add near the other appearance-controls (after `--glass-blur: 16px;`):

```css
  --panel-height: 100vh;
  --panel-radius: 0px;
```

In `src/app/newtab/sidebar/left-sidebar.css`, update `.left-sidebar` (was `bottom: 0` fixed-full-height) and `.left-panel`:

```css
.left-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  height: var(--panel-height);
  z-index: 40;
  display: flex;
  align-items: stretch;
  pointer-events: none;
}
```
(remove the old `bottom: 0;` line — `height` replaces it)

```css
.left-panel {
  position: relative;
  max-width: 84vw;
  height: 100%;
  padding: var(--space-4);
  overflow-y: auto;
  background: var(--glass-bg-strong);
  border-right: 1px solid var(--border);
  border-radius: 0 var(--panel-radius) var(--panel-radius) 0;
  box-shadow: var(--shadow-elevated);
  backdrop-filter: blur(var(--glass-blur));
  pointer-events: auto;
}
```

- [ ] **Step 5: Verify**

Run: `pnpm compile && pnpm lint`

Run `pnpm dev`, open Settings → General, drag "Panel height" to 60 — open a left-sidebar panel (e.g. Bookmarks/GitHub) and confirm it now stops 40vh short of the bottom. Drag "Panel corner radius" to 24 and confirm the panel's right edge is now rounded.

- [ ] **Step 6: Commit**

```bash
git add src/app/newtab/settings/coreSettings.ts src/core/theme-engine/useTheme.ts src/styles/tokens.css src/app/newtab/sidebar/left-sidebar.css src/core/i18n/locales/en.json src/core/i18n/locales/vi.json
git commit -m "feat: add left panel height and corner-radius settings"
```

---

### Task 3: Global UI scale, font scale, compact mode

**Files:**
- Modify: `src/app/newtab/settings/coreSettings.ts` (`coreAppearanceSchema`)
- Modify: `src/core/theme-engine/useTheme.ts`
- Modify: `src/styles/tokens.css`
- Modify: `src/core/i18n/locales/en.json`, `src/core/i18n/locales/vi.json`

**Interfaces:**
- Produces: `--ui-scale` (multiplier, e.g. `1.1`) and root `font-size` set directly (not a CSS var multiply, since `font-size` on `html` cascades naturally via `rem`), plus `data-compact="true"` attribute on `<html>`.

- [ ] **Step 1: Add settings to `coreAppearanceSchema`**

In `coreSettings.ts`, add to `coreAppearanceSchema` (after `bgEffectColor`):

```ts
  uiScale: {
    type: "slider",
    label: "settings.uiScale",
    description: "settings.uiScaleDesc",
    min: 80,
    max: 130,
    step: 5,
    default: 100,
  },
  fontScale: {
    type: "slider",
    label: "settings.fontScale",
    description: "settings.fontScaleDesc",
    min: 80,
    max: 130,
    step: 5,
    default: 100,
  },
  compactMode: {
    type: "toggle",
    label: "settings.compactMode",
    description: "settings.compactModeDesc",
    default: false,
  },
```

- [ ] **Step 2: Add i18n strings**

`en.json` → `settings`:
```json
"uiScale": "Interface scale",
"uiScaleDesc": "Overall size of spacing, icons, and controls",
"fontScale": "Font size",
"fontScaleDesc": "Overall text size, independent of interface scale",
"compactMode": "Compact mode",
"compactModeDesc": "Reduce padding and spacing across the interface"
```

`vi.json` → `settings`:
```json
"uiScale": "Quy mô giao diện",
"uiScaleDesc": "Kích thước tổng thể của khoảng cách, biểu tượng và điều khiển",
"fontScale": "Kích thước font",
"fontScaleDesc": "Kích thước chữ tổng thể, độc lập với quy mô giao diện",
"compactMode": "Chế độ gọn",
"compactModeDesc": "Giảm padding và khoảng cách trong toàn bộ giao diện"
```

- [ ] **Step 3: Apply via the theme engine**

In `useTheme.ts`, add a new effect after the existing appearance-controls effect:

```ts
  const uiScale = typeof core.uiScale === "number" ? core.uiScale : 100;
  const fontScale = typeof core.fontScale === "number" ? core.fontScale : 100;
  const compactMode = core.compactMode === true;
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ui-scale", String(uiScale / 100));
    root.style.fontSize = `${(16 * fontScale) / 100}px`;
    root.dataset.compact = compactMode ? "true" : "false";
  }, [uiScale, fontScale, compactMode]);
```

- [ ] **Step 4: Consume `--ui-scale` and add the compact preset in tokens.css**

In `src/styles/tokens.css`, add the fallback and scale the spacing scale by the new variable. Replace the existing spacing block:

```css
  /* Spacing scale (multiplied by --ui-scale, set at runtime) */
  --ui-scale: 1;
  --space-1: calc(4px * var(--ui-scale));
  --space-2: calc(8px * var(--ui-scale));
  --space-3: calc(12px * var(--ui-scale));
  --space-4: calc(16px * var(--ui-scale));
  --space-5: calc(24px * var(--ui-scale));
  --space-6: calc(32px * var(--ui-scale));
  --space-7: calc(48px * var(--ui-scale));
```

Then add a compact-mode override block at the end of the file (after the `prefers-reduced-motion` block):

```css
/* Compact mode: tighter spacing, independent of --ui-scale */
html[data-compact="true"] {
  --space-1: calc(2px * var(--ui-scale));
  --space-2: calc(4px * var(--ui-scale));
  --space-3: calc(6px * var(--ui-scale));
  --space-4: calc(10px * var(--ui-scale));
  --space-5: calc(14px * var(--ui-scale));
  --space-6: calc(20px * var(--ui-scale));
  --space-7: calc(30px * var(--ui-scale));
}
```

- [ ] **Step 5: Verify**

Run: `pnpm compile && pnpm lint`

Run `pnpm dev`. In Settings → Appearance: drag "Interface scale" to 130 and confirm spacing/paddings across panels visibly grow (font size unaffected). Reset to 100, drag "Font size" to 130 and confirm only text grows. Toggle "Compact mode" and confirm paddings tighten.

- [ ] **Step 6: Commit**

```bash
git add src/app/newtab/settings/coreSettings.ts src/core/theme-engine/useTheme.ts src/styles/tokens.css src/core/i18n/locales/en.json src/core/i18n/locales/vi.json
git commit -m "feat: add UI scale, font scale, and compact mode settings"
```

---

### Task 4: Swap panel/tool sides

**Files:**
- Modify: `src/app/newtab/settings/coreSettings.ts`
- Modify: `src/app/newtab/sidebar/LeftSidebar.tsx`
- Modify: `src/app/newtab/sidebar/RightSidebar.tsx`
- Modify: `src/app/newtab/sidebar/left-sidebar.css`
- Modify: `src/app/newtab/sidebar/right-sidebar.css`
- Modify: `src/core/i18n/locales/en.json`, `src/core/i18n/locales/vi.json`

**Interfaces:**
- Produces: `core.swapSidebars: boolean`. Each sidebar component gets a `side: "left" | "right"` derived value and renders itself anchored to that physical side via a `--side` modifier class, while continuing to render its own fixed zone (`LeftSidebar` always renders `"left-sidebar"` zone features = panels; `RightSidebar` always renders `"right-sidebar"` zone features = tools). Only the physical anchor flips.

**Design note:** rather than swapping which zone each component reads (which would force the Panel-style UI to imitate the Window-manager UI or vice versa), we keep each component's UX fixed to its zone and only flip which physical edge it's anchored to. This satisfies "swap tool and panel sides" (physically) with a much smaller diff.

- [ ] **Step 1: Add the setting**

In `coreGeneralSchema` (`coreSettings.ts`), add after `sidebarMode`:

```ts
  swapSidebars: {
    type: "toggle",
    label: "settings.swapSidebars",
    description: "settings.swapSidebarsDesc",
    default: false,
  },
```

- [ ] **Step 2: Add i18n strings**

`en.json` → `settings`:
```json
"swapSidebars": "Swap panel and tool sides",
"swapSidebarsDesc": "Move panels to the right and tools to the left (default: panels left, tools right)"
```

`vi.json` → `settings`:
```json
"swapSidebars": "Đổi vị trí panel và tool",
"swapSidebarsDesc": "Chuyển panel sang phải và tool sang trái (mặc định: panel trái, tool phải)"
```

- [ ] **Step 3: Make LeftSidebar side-aware**

In `LeftSidebar.tsx`, read the setting and derive `side`. Replace the return block's outer wrapper classes (lines 33-40 area) to add a modifier when swapped:

```ts
  const swapped = core.swapSidebars === true;
```

Change the JSX root:
```tsx
      <div className={`left-sidebar__hover-zone ${swapped ? "left-sidebar__hover-zone--swapped" : ""}`} onMouseEnter={() => setHovering(true)} />
      <div
        className={`left-sidebar ${swapped ? "left-sidebar--swapped" : ""}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
```
(`core` is already destructured at line 22; add `swapped` right after it.)

- [ ] **Step 4: Make RightSidebar side-aware**

In `RightSidebar.tsx`, same pattern — `core` already read at line 30. Add:
```ts
  const swapped = core.swapSidebars === true;
```

Update the hover-zone and rail JSX (lines 67-70):
```tsx
      <div className={`right-sidebar__hover-zone ${swapped ? "right-sidebar__hover-zone--swapped" : ""}`} onMouseEnter={() => setHovering(true)} />
      <div
        className={`right-rail ${railVisible ? "right-rail--visible" : ""} ${swapped ? "right-rail--swapped" : ""}`}
        style={swapped ? { left: railRight } : { right: railRight }}
```

And in `WindowFrame`, `win.mode === "docked"` positioning (line 187) needs the same side flip. Pass `swapped` down as a prop:

```tsx
        return (
          <WindowFrame
            key={id}
            feature={feature}
            win={win}
            dockIndex={dockedOrder.indexOf(id)}
            dockCount={dockedOrder.length}
            swapped={swapped}
          />
        );
```

Update `WindowFrame`'s signature and docked-mode branch:
```ts
function WindowFrame({
  feature,
  win,
  dockIndex,
  dockCount,
  swapped,
}: {
  feature: FeatureDefinition;
  win: ToolWindowState;
  dockIndex: number;
  dockCount: number;
  swapped: boolean;
}) {
```
```ts
  if (win.mode === "docked") {
    style = swapped
      ? { left: dockIndex * dockWidth, width: dockWidth, zIndex: win.zIndex }
      : { right: dockIndex * dockWidth, width: dockWidth, zIndex: win.zIndex };
  } else if (win.mode === "maximized") {
```

Also add `tool-window--swapped` to the className so CSS can mirror the header/resize-handle corner:
```tsx
    <div
      className={`tool-window tool-window--${win.mode} ${swapped ? "tool-window--swapped" : ""}`}
      style={style}
      onMouseDown={() => focus(feature.id)}
    >
```

- [ ] **Step 5: Mirror CSS for the swapped state**

In `left-sidebar.css`, add at the end:

```css
/* Swapped: anchor to the right edge instead of left */
.left-sidebar--swapped {
  left: auto;
  right: 0;
}
.left-sidebar--swapped .left-rail {
  border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  border-left: 1px solid var(--border);
  border-right: none;
  transform: translateX(100%);
}
.left-sidebar--swapped .left-rail--visible {
  transform: translateX(0);
}
.left-sidebar--swapped .left-panel {
  border-right: none;
  border-left: 1px solid var(--border);
  border-radius: var(--panel-radius) 0 0 var(--panel-radius);
}
.left-sidebar__hover-zone--swapped {
  left: auto;
  right: 0;
}
```

In `right-sidebar.css`, add at the end:

```css
/* Swapped: anchor the rail/hover-zone to the left edge instead of right */
.right-sidebar__hover-zone--swapped {
  right: auto;
  left: 0;
}
.right-rail--swapped {
  right: auto;
  left: 0;
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  border-left: none;
  border-right: 1px solid var(--border);
  transform: translate(-100%, -50%);
}
.right-rail--swapped.right-rail--visible {
  transform: translate(0, -50%);
}
.tool-window--swapped.tool-window--docked {
  border-radius: 0;
}
```

- [ ] **Step 6: Verify**

Run: `pnpm compile && pnpm lint`

Run `pnpm dev`, toggle "Swap panel and tool sides" in Settings → General. Confirm the left rail (panels — e.g. Bookmarks) now appears on the right edge, and the right rail (tools — e.g. Pomodoro) now appears on the left edge, including docked tool windows anchoring to the left.

- [ ] **Step 7: Commit**

```bash
git add src/app/newtab/settings/coreSettings.ts src/app/newtab/sidebar/LeftSidebar.tsx src/app/newtab/sidebar/RightSidebar.tsx src/app/newtab/sidebar/left-sidebar.css src/app/newtab/sidebar/right-sidebar.css src/core/i18n/locales/en.json src/core/i18n/locales/vi.json
git commit -m "feat: add setting to swap panel and tool sidebar sides"
```

---

### Task 5: Dock/tool-window overlap mode (shift vs overlay) + position transition

**Files:**
- Modify: `src/app/newtab/settings/coreSettings.ts`
- Modify: `src/app/newtab/sidebar/RightSidebar.tsx`
- Modify: `src/app/newtab/sidebar/right-sidebar.css`
- Modify: `src/core/i18n/locales/en.json`, `src/core/i18n/locales/vi.json`

**Interfaces:**
- Produces: `core.dockOverlapMode: "shift" | "overlay"`, consumed by `RightSidebar`'s `railRight`/docked-window offset computation.

- [ ] **Step 1: Add the setting**

In `coreGeneralSchema`, add after `swapSidebars` (from Task 4):

```ts
  dockOverlapMode: {
    type: "select",
    label: "settings.dockOverlapMode",
    description: "settings.dockOverlapModeDesc",
    options: [
      { value: "shift", label: "settings.dockOverlapShift" },
      { value: "overlay", label: "settings.dockOverlapOverlay" },
    ],
    default: "shift",
  },
```

- [ ] **Step 2: Add i18n strings**

`en.json` → `settings`:
```json
"dockOverlapMode": "Docked window overlap",
"dockOverlapModeDesc": "How docked tool windows avoid the edge trigger rail",
"dockOverlapShift": "Shift rail outward (default)",
"dockOverlapOverlay": "Overlay above the panel"
```

`vi.json` → `settings`:
```json
"dockOverlapMode": "Kiểu chồng lấn cửa sổ dock",
"dockOverlapModeDesc": "Cách các cửa sổ tool đã dock né rail biểu tượng",
"dockOverlapShift": "Đẩy rail ra ngoài (mặc định)",
"dockOverlapOverlay": "Nằm chồng lên trên panel"
```

- [ ] **Step 3: Wire into RightSidebar**

In `RightSidebar.tsx`, `core` already read at line 30. Replace the `railRight` computation (lines 60-63):

```ts
  const dockedOrder = open.filter((id) => windows[id]?.mode === "docked");
  const DOCK_WIDTH = 360;
  const overlapMode = (core.dockOverlapMode as string) ?? "shift";
  // "shift": rail moves outward so it never overlaps docked windows (current
  // behavior). "overlay": rail stays flush at the edge, layered above docked
  // windows via z-index instead of being pushed.
  const railRight = overlapMode === "shift" ? dockedOrder.length * DOCK_WIDTH : 0;
```

And in `WindowFrame`'s docked-mode style branch, when `overlapMode === "overlay"` all docked windows should stack flush at the edge (offset 0) instead of being staggered by `dockIndex`. Pass `overlapMode` down as a prop alongside `swapped`:

```tsx
            overlapMode={overlapMode}
```

```ts
function WindowFrame({
  feature,
  win,
  dockIndex,
  dockCount,
  swapped,
  overlapMode,
}: {
  feature: FeatureDefinition;
  win: ToolWindowState;
  dockIndex: number;
  dockCount: number;
  swapped: boolean;
  overlapMode: string;
}) {
```

```ts
  if (win.mode === "docked") {
    const offset = overlapMode === "overlay" ? 0 : dockIndex * dockWidth;
    style = swapped
      ? { left: offset, width: dockWidth, zIndex: win.zIndex }
      : { right: offset, width: dockWidth, zIndex: win.zIndex };
  } else if (win.mode === "maximized") {
```

- [ ] **Step 4: Add position transitions (fixes the instant-jump issue, item 9)**

In `right-sidebar.css`, add a `transition` to `.tool-window` (it currently has none on position/size properties):

```css
.tool-window {
  position: fixed;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background: var(--glass-bg-strong);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-elevated);
  backdrop-filter: blur(var(--glass-blur));
  overflow: hidden;
  transition:
    left var(--dur-panel) var(--ease-out),
    right var(--dur-panel) var(--ease-out),
    width var(--dur-panel) var(--ease-out);
}
```

Do not transition `top`/`height`/`inset` here — those change during active drag/resize (`startDrag`/`startResize` in `RightSidebar.tsx`) and animating them would make dragging feel laggy. Only `left`/`right`/`width` change from the overlap-mode/dock-index/swap logic above, which are the values that currently jump.

- [ ] **Step 5: Verify**

Run: `pnpm compile && pnpm lint`

Run `pnpm dev`. Open two tool windows (e.g. Pomodoro, Notes) and dock both. In Settings, switch "Docked window overlap" between "Shift" and "Overlay" and confirm: shift mode staggers docked windows side-by-side pushing the rail out; overlay mode stacks them flush at the edge (rail no longer moves) with a smooth slide rather than an instant jump when switching.

- [ ] **Step 6: Commit**

```bash
git add src/app/newtab/settings/coreSettings.ts src/app/newtab/sidebar/RightSidebar.tsx src/app/newtab/sidebar/right-sidebar.css src/core/i18n/locales/en.json src/core/i18n/locales/vi.json
git commit -m "feat: add dock overlap mode setting and smooth tool-window position transitions"
```

---

### Task 6: Shared `useElementSize` hook + responsive Spotify and Pomodoro widgets

**Files:**
- Create: `src/shared/utils/useElementSize.ts`
- Modify: `src/features/newtab/panel-spotify/index.tsx`
- Modify: `src/features/newtab/panel-spotify/spotify.css`
- Modify: `src/features/newtab/tool-pomodoro/index.tsx`
- Modify: `src/features/newtab/tool-pomodoro/pomodoro.css`

**Interfaces:**
- Produces: `useElementSize<T extends HTMLElement>(): [React.RefObject<T>, { width: number; height: number }]`, a ResizeObserver-based hook other widgets can reuse in later tasks.

- [ ] **Step 1: Write the shared hook**

Create `src/shared/utils/useElementSize.ts`:

```ts
import { useEffect, useRef, useState } from "react";

/** Tracks an element's content-box size via ResizeObserver (CSS media queries
 * can't see container width, only viewport width — dock/panel widths are
 * independent of the viewport). */
export function useElementSize<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  { width: number; height: number },
] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}
```

- [ ] **Step 2: Apply to Spotify — collapse controls into a hover-reveal overlay below 220px**

In `src/features/newtab/panel-spotify/index.tsx`, import the hook and wrap the player:

```ts
import { useElementSize } from "@/shared/utils/useElementSize";
```

Inside `PanelSpotify`, after the early returns (right before `const pct = ...`):

```ts
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const narrow = size.width > 0 && size.width < 220;
```

Update the root JSX to attach the ref and a modifier class:

```tsx
  return (
    <div className={`sp ${narrow ? "sp--narrow" : ""}`} ref={sizeRef}>
      <div className="sp__player">
        <div
          className="sp__art"
          style={np.albumArt ? { backgroundImage: `url(${np.albumArt})` } : undefined}
        >
          {narrow && (
            <div className="sp__art-overlay">
              <IconButton label="Previous" onClick={() => void doControl("previous")}>
                <SkipBack size={16} />
              </IconButton>
              <IconButton
                label={np.isPlaying ? "Pause" : "Play"}
                onClick={() => void doControl(np.isPlaying ? "pause" : "play")}
              >
                {np.isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </IconButton>
              <IconButton label="Next" onClick={() => void doControl("next")}>
                <SkipForward size={16} />
              </IconButton>
            </div>
          )}
        </div>
        <div className="sp__meta">
          <div className="sp__title">{np.title}</div>
          <div className="sp__artist">{np.artist}</div>
          <div className="sp__progress">
            <div className="sp__progress-fill" style={{ width: `${pct}%` }} />
          </div>
          {!narrow && (
            <div className="sp__controls">
              <IconButton label="Previous" onClick={() => void doControl("previous")}>
                <SkipBack size={18} />
              </IconButton>
              <IconButton
                label={np.isPlaying ? "Pause" : "Play"}
                onClick={() => void doControl(np.isPlaying ? "pause" : "play")}
              >
                {np.isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </IconButton>
              <IconButton label="Next" onClick={() => void doControl("next")}>
                <SkipForward size={18} />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 3: CSS for the narrow overlay**

In `src/features/newtab/panel-spotify/spotify.css`, add:

```css
.sp__art {
  position: relative;
}
.sp__art-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity var(--dur-hover) ease-out;
}
.sp__art:hover .sp__art-overlay {
  opacity: 1;
}
.sp--narrow .sp__art-overlay :is(button, .icon-button) {
  color: #fff;
}
```

(If `.sp__art` already has rules elsewhere in the file, merge `position: relative;` into the existing block rather than duplicating the selector.)

- [ ] **Step 4: Apply to Pomodoro — hide duration labels and steppers below 240px**

In `src/features/newtab/tool-pomodoro/index.tsx`, import the hook:

```ts
import { useElementSize } from "@/shared/utils/useElementSize";
```

Inside `ToolPomodoro`, before `if (!state) return null;` add nothing (hook must run unconditionally — place it right after `const config: PomodoroConfig = {...}` block, before `const lastPhase = useRef...`):

```ts
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const narrow = size.width > 0 && size.width < 240;
```

Update the root div and gate the durations section:

```tsx
  return (
    <div className={`pomo ${narrow ? "pomo--narrow" : ""}`} ref={sizeRef}>
```

```tsx
      {!narrow && (
        <div className="pomo__durations">
          <DurationStepper
            label={t("pomodoro.work")}
            value={config.workMin}
            onChange={(v) => setValue(POMODORO_FEATURE_ID, "workMin", v)}
          />
          <DurationStepper
            label={t("pomodoro.short")}
            value={config.shortMin}
            onChange={(v) => setValue(POMODORO_FEATURE_ID, "shortMin", v)}
          />
          <DurationStepper
            label={t("pomodoro.long")}
            value={config.longMin}
            onChange={(v) => setValue(POMODORO_FEATURE_ID, "longMin", v)}
          />
        </div>
      )}
```

Also collapse the main button's text label to icon-only when narrow:

```tsx
        <Button
          variant="primary"
          className="pomo__main-btn"
          onClick={() => (state.running ? void pause().then(sync) : void onStart())}
        >
          {state.running ? <Pause size={18} /> : <Play size={18} />}
          {!narrow && (state.running ? t("pomodoro.pause") : t("pomodoro.start"))}
        </Button>
```

- [ ] **Step 5: Verify**

Run: `pnpm compile && pnpm lint`

Run `pnpm dev`. Open the Pomodoro tool window as a floating window and resize it below ~240px width — confirm duration steppers disappear and the start/pause button shrinks to icon-only, with no horizontal overflow. Repeat for Spotify below ~220px — confirm playback controls disappear from the meta row and appear as a hover overlay on the album art instead.

- [ ] **Step 6: Commit**

```bash
git add src/shared/utils/useElementSize.ts src/features/newtab/panel-spotify/index.tsx src/features/newtab/panel-spotify/spotify.css src/features/newtab/tool-pomodoro/index.tsx src/features/newtab/tool-pomodoro/pomodoro.css
git commit -m "feat: add ResizeObserver-based responsive layouts for Spotify and Pomodoro widgets"
```

---

### Task 7: GitHub panel — recent-repos toggle, language stats, hover tooltips

**Files:**
- Modify: `src/features/newtab/panel-github/settings.schema.ts`
- Modify: `src/features/newtab/panel-github/api.ts`
- Modify: `src/features/newtab/panel-github/index.tsx`
- Modify: `src/features/newtab/panel-github/ContribGraph.tsx`
- Modify: `src/features/newtab/panel-github/github.css`
- Modify: `src/core/i18n/locales/en.json`, `src/core/i18n/locales/vi.json`

**Interfaces:**
- Produces: `RecentRepo.language` already exists (per-repo primary language, `api.ts:15,105`); `fetchLanguageStats(token)` — new function returning `Array<{ name: string; bytes: number }>` sorted descending, computed from up to 20 most-recently-pushed repos' primary languages weighted by repo count (simple approximation, no per-repo language-breakdown API call to keep this to one extra GraphQL round trip).

- [ ] **Step 1: Add settings**

In `src/features/newtab/panel-github/settings.schema.ts`, add after `showTrending`:

```ts
  showRecentRepos: {
    type: "toggle",
    label: "github.showRecentRepos",
    default: true,
  },
  showLanguageStats: {
    type: "toggle",
    label: "github.showLanguageStats",
    description: "github.showLanguageStatsDesc",
    default: false,
  },
  excludedLanguages: {
    type: "text",
    label: "github.excludedLanguages",
    description: "github.excludedLanguagesDesc",
    placeholder: "github.excludedLanguagesPlaceholder",
    showIf: (v) => v.showLanguageStats === true,
  },
```

(Comma-separated text field is used instead of a multi-select because the schema system's `SelectField` only supports a single value — see `src/core/settings-engine/schema.ts:37-41`. Parsing a comma-separated list keeps this within the existing field types rather than extending the schema engine.)

- [ ] **Step 2: Add i18n strings**

`en.json` → `github`:
```json
"showRecentRepos": "Show recent repos",
"showLanguageStats": "Show language stats",
"showLanguageStatsDesc": "Language breakdown computed from your most recently pushed repos",
"excludedLanguages": "Exclude languages",
"excludedLanguagesDesc": "Comma-separated list, e.g. HTML, CSS",
"excludedLanguagesPlaceholder": "HTML, CSS"
```

`vi.json` → `github`:
```json
"showRecentRepos": "Hiện repo gần đây",
"showLanguageStats": "Thống kê ngôn ngữ",
"showLanguageStatsDesc": "Thống kê ngôn ngữ tính từ các repo push gần đây nhất của bạn",
"excludedLanguages": "Loại trừ ngôn ngữ",
"excludedLanguagesDesc": "Danh sách cách nhau bởi dấu phẩy, ví dụ: HTML, CSS",
"excludedLanguagesPlaceholder": "HTML, CSS"
```

- [ ] **Step 3: Extend the GraphQL query and add `fetchLanguageStats`**

In `api.ts`, extend the `recentRepos` GraphQL selection to request up to 20 repos with language name (it already fetches `primaryLanguage { name }` for 5 — bump the count and reuse the same field for the stats computation instead of a second query):

Change the `GQL` template (line 41):
```ts
    recentRepos: repositories(first: 20, orderBy: {field: PUSHED_AT, direction: DESC}) {
      nodes { name description url stargazerCount pushedAt primaryLanguage { name } }
    }
```

Since the UI's "recent repos" list should still show only 5, keep the mapping in `fetchProfile` returning all 20 into `recentRepos`, and slice to 5 at render time (Step 5) rather than in the fetcher — the extra 15 feed the language stats without a second API call.

Add a new exported function at the end of `api.ts`:

```ts
export interface LanguageStat {
  name: string;
  count: number;
  pct: number;
}

/** Approximate language breakdown from primary languages of recently-pushed
 * repos (no per-repo byte-level breakdown to avoid N extra API calls). */
export function computeLanguageStats(
  repos: RecentRepo[],
  excluded: string[],
): LanguageStat[] {
  const excludedLower = new Set(excluded.map((l) => l.trim().toLowerCase()).filter(Boolean));
  const counts = new Map<string, number>();
  for (const r of repos) {
    if (!r.language) continue;
    if (excludedLower.has(r.language.toLowerCase())) continue;
    counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, pct: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 4: Add hover tooltip to ContribGraph**

`ContribGraph.tsx` already renders an SVG `<title>` per cell (line 39: `<title>{`${day.date}: ${day.count}`}</title>`) — this is the native browser tooltip and already shows date + commit count on hover. No code change needed here; this item is already implemented. Skip to Step 5.

- [ ] **Step 5: Wire settings into the panel component**

In `panel-github/index.tsx`, read the new values (after `const showTrending = ...` at line 30):

```ts
  const showRecentRepos = values.showRecentRepos !== false;
  const showLanguageStats = values.showLanguageStats === true;
  const excludedLanguages = ((values.excludedLanguages as string) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
```

Import `computeLanguageStats` and `LanguageStat`:
```ts
import {
  computeLanguageStats,
  fetchNotifications,
  fetchProfile,
  fetchTrending,
  type GitHubNotification,
  type GitHubProfile,
  type LanguageStat,
  type TrendingRepo,
  type TrendingWindow,
} from "./api";
```

Compute stats from `profile.recentRepos` (memoize isn't required — it's cheap and only recomputes on profile/values change, consistent with the rest of this component's style):

```ts
  const languageStats: LanguageStat[] = profile
    ? computeLanguageStats(profile.recentRepos, excludedLanguages)
    : [];
```

Gate the recent-repos block (line 151) behind `showRecentRepos`, and slice to 5 for display:
```tsx
      {showRecentRepos && profile.recentRepos?.length > 0 && (
        <>
          <div className="gh__section-title" style={{ marginTop: "var(--space-4)" }}>
            {t("github.recentRepos")}
          </div>
          <div className="gh__list">
            {profile.recentRepos.slice(0, 5).map((r) => (
              <a
```
(keep the rest of that block's JSX identical, just add the `showRecentRepos &&` guard and `.slice(0, 5)`)

Add a language-stats section after the contribution graph (after line 149, before the recent-repos block):

```tsx
      {showLanguageStats && languageStats.length > 0 && (
        <>
          <div className="gh__section-title" style={{ marginTop: "var(--space-4)" }}>
            {t("github.showLanguageStats")}
          </div>
          <div className="gh__langs">
            {languageStats.slice(0, 6).map((l) => (
              <div className="gh__lang-row" key={l.name}>
                <span className="gh__lang-name">{l.name}</span>
                <div className="gh__lang-bar">
                  <div className="gh__lang-bar-fill" style={{ width: `${l.pct}%` }} />
                </div>
                <span className="gh__lang-pct">{l.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
```

- [ ] **Step 6: CSS for the language bar chart**

In `src/features/newtab/panel-github/github.css`, add:

```css
.gh__langs {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.gh__lang-row {
  display: grid;
  grid-template-columns: 80px 1fr 34px;
  align-items: center;
  gap: var(--space-2);
  font-size: 12px;
}
.gh__lang-name {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gh__lang-bar {
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--surface);
  overflow: hidden;
}
.gh__lang-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--accent);
}
.gh__lang-pct {
  text-align: right;
  color: var(--text-muted);
}
```

- [ ] **Step 7: Verify**

Run: `pnpm compile && pnpm lint`

Run `pnpm dev`, connect a GitHub token in Settings → GitHub. Toggle "Show recent repos" off and confirm the list disappears from the panel. Toggle "Show language stats" on and confirm a horizontal bar chart of your top languages appears; add a language to "Exclude languages" and confirm it drops from the chart. Hover a contribution-graph cell and confirm the native tooltip shows date + count (already worked pre-change — just confirming no regression).

- [ ] **Step 8: Commit**

```bash
git add src/features/newtab/panel-github/settings.schema.ts src/features/newtab/panel-github/api.ts src/features/newtab/panel-github/index.tsx src/features/newtab/panel-github/github.css src/core/i18n/locales/en.json src/core/i18n/locales/vi.json
git commit -m "feat: add GitHub recent-repos toggle and language-stats chart"
```

---

### Task 8: Wallpaper random mode select + media-type badges

**Files:**
- Modify: `src/features/newtab/wallpaper/settings.schema.ts`
- Modify: `src/features/newtab/wallpaper/index.tsx`
- Modify: `src/features/newtab/wallpaper/store.ts`
- Modify: `src/features/newtab/wallpaper/WallpaperManager.tsx`
- Modify: `src/features/newtab/wallpaper/wallpaper.css`
- Modify: `src/core/i18n/locales/en.json`, `src/core/i18n/locales/vi.json`

**Interfaces:**
- Produces: `randomMode: "off" | "images" | "videos" | "all"` (replaces the old boolean), migrated from legacy boolean values at read time.
- Consumes: `WallpaperMeta.type: "image" | "video"` (already exists per `store.ts`) to filter and badge.

- [ ] **Step 1: Check `WallpaperMeta` for gif detection**

Read `src/features/newtab/wallpaper/store.ts` and `image.ts` to confirm how `type` is set (likely `"image" | "video"` with no gif distinction — gifs are stored as `type: "image"`). Detect gif specifically by file extension/mime at render time using `item.name` (Step 4), not by changing the stored type — this avoids a data-model/migration change.

- [ ] **Step 2: Replace `randomMode` toggle with a select**

In `wallpaper/settings.schema.ts`, replace the `randomMode` field:

```ts
  randomMode: {
    type: "select",
    label: "wallpaper.randomMode",
    description: "wallpaper.randomModeDesc",
    options: [
      { value: "off", label: "wallpaper.randomOff" },
      { value: "images", label: "wallpaper.randomImages" },
      { value: "videos", label: "wallpaper.randomVideos" },
      { value: "all", label: "wallpaper.randomAll" },
    ],
    default: "off",
    showIf: (v) => v.mode !== "slideshow",
  },
```

- [ ] **Step 3: Add i18n strings**

`en.json` → `wallpaper`:
```json
"randomOff": "Off",
"randomImages": "Images only",
"randomVideos": "Videos only",
"randomAll": "All"
```

`vi.json` → `wallpaper`:
```json
"randomOff": "Tắt",
"randomImages": "Chỉ ảnh",
"randomVideos": "Chỉ video",
"randomAll": "Tất cả"
```

(`wallpaper.randomMode`/`wallpaper.randomModeDesc` labels already exist since the field is reused, not renamed.)

- [ ] **Step 4: Read the new value where random selection happens**

Find where `randomMode` is currently read (likely `wallpaper/index.tsx`, filtering `items` before picking one at random). Update that read to be select-aware with legacy-boolean migration:

```ts
  const rawRandomMode = values.randomMode;
  const randomMode: "off" | "images" | "videos" | "all" =
    rawRandomMode === true ? "all" : rawRandomMode === false ? "off" : (rawRandomMode as "off" | "images" | "videos" | "all") ?? "off";
```

Wherever the wallpaper-selection logic filters `items` for random pick, update the filter:

```ts
  const randomPool =
    randomMode === "off"
      ? []
      : randomMode === "all"
        ? items
        : items.filter((i) => (randomMode === "images" ? i.type === "image" : i.type === "video"));
```

(Locate the exact existing random-pick block in `wallpaper/index.tsx` via `grep -n "randomMode" src/features/newtab/wallpaper/index.tsx` before editing — insert this filtering step ahead of whatever `Math.random()`-based pick already exists, replacing the old boolean check.)

- [ ] **Step 5: Add media-type badge to `Thumb` in WallpaperManager**

In `WallpaperManager.tsx`, update the `Thumb` component to detect gif via filename and render a badge:

```tsx
function mediaBadge(item: WallpaperMeta): "video" | "gif" | null {
  if (item.type === "video") return "video";
  if (/\.gif($|\?)/i.test(item.name)) return "gif";
  return null;
}

function Thumb({ item }: { item: WallpaperMeta }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    void getWallpaperUrl(item.id).then((res) => {
      if (res) {
        revoked = res.url;
        setUrl(res.url);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [item.id]);

  if (!url) return <div className="wp-item__gradient" style={{ background: "var(--surface)" }} />;
  const badge = mediaBadge(item);
  return (
    <>
      {item.type === "video" ? (
        <video className="wp-item__thumb" src={url} muted />
      ) : (
        <img className="wp-item__thumb" src={url} alt={item.name} />
      )}
      {badge === "video" && (
        <span className="wp-item__media-badge">
          <Film size={11} />
        </span>
      )}
      {badge === "gif" && <span className="wp-item__media-badge wp-item__media-badge--text">GIF</span>}
    </>
  );
}
```

(`Film` is already imported at the top of the file from `lucide-react` — line 2.)

- [ ] **Step 6: CSS for the badge**

In `src/features/newtab/wallpaper/wallpaper.css`, add (and confirm `.wp-item` has `position: relative` — if not already present, add it so the badge can be absolutely positioned):

```css
.wp-item {
  position: relative;
}
.wp-item__media-badge {
  position: absolute;
  bottom: 4px;
  left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}
```

(If `.wp-item` already has a `position` declaration elsewhere in the file, merge `position: relative` into that block instead of duplicating the selector.)

- [ ] **Step 7: Verify**

Run: `pnpm compile && pnpm lint`

Run `pnpm dev`, open Settings → Wallpaper. Confirm the "Random" control is now a dropdown with Off/Images only/Videos only/All. Set it to "Videos only", trigger a random wallpaper change (or wait for the interval), and confirm only video wallpapers are picked. In the wallpaper library grid, confirm video thumbnails show a small film-icon badge and gif thumbnails show a "GIF" text badge; static images show no badge.

- [ ] **Step 8: Commit**

```bash
git add src/features/newtab/wallpaper/settings.schema.ts src/features/newtab/wallpaper/index.tsx src/features/newtab/wallpaper/WallpaperManager.tsx src/features/newtab/wallpaper/wallpaper.css src/core/i18n/locales/en.json src/core/i18n/locales/vi.json
git commit -m "feat: replace wallpaper random toggle with media-type select and add thumbnail badges"
```

---

## Self-Review Notes

- **Spec coverage:** Items 1-9 from the design spec map 1:1 to Tasks 1-8 (item 9, dock fade transitions, is covered by Task 5 Step 4 — the bookmark-bar half of item 9 was found already implemented during research, see Task 5 Step 4 note, so no separate task was needed for it).
- **Placeholder scan:** No TBD/TODO markers; every step shows real code or an exact existing line to locate and edit.
- **Type consistency:** `WindowMode`/`ToolWindowState` untouched (Task 4/5 only add new local variables `swapped`/`overlapMode`, not new modes). `LanguageStat`/`computeLanguageStats` names match between `api.ts` (Task 7 Step 3) and `index.tsx` (Task 7 Step 5). `useElementSize` signature matches between its definition (Task 6 Step 1) and both call sites (Task 6 Steps 2 and 4).
- **Task independence:** Each task touches a disjoint set of files except Tasks 4 and 5, which both modify `RightSidebar.tsx` — Task 5 depends on Task 4's `swapped` variable and `WindowFrame` prop already being in place, so Task 5 must run after Task 4 if using subagent-driven development. All other tasks (1, 2, 3, 6, 7, 8) can run in any order or in parallel.

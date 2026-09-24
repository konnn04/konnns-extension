# Kiến trúc & Tổ chức code

Tài liệu này giải thích **file nào đặt ở đâu** và **cách mở rộng** sang SidePanel / Custom Page sau này, để dễ giám sát khi dự án lớn dần.

## 1. Phân lớp (4 tầng)

```
src/
├── entrypoints/     # Điểm vào của TỪNG bề mặt trình duyệt (WXT build mỗi cái ra 1 trang)
│   ├── newtab/      #   trang New Tab (mount App)
│   ├── popup/       #   popup trên toolbar — cửa ngõ vào Custom Site + tool nhúng
│   ├── site/        #   Custom Site (site.html) — nhiều app nhỏ, router bằng hash
│   ├── embed.content/#  content script nạp theo yêu cầu (tool chạy trên trang web)
│   ├── background.ts#   service worker (alarms, message router)
│   └── (sidepanel/, options/…  ← thêm sau)
│
├── app/             # "Vỏ" (shell) — MỖI bề mặt 1 thư mục con
│   ├── newtab/      #   vỏ New Tab
│   │   ├── App.tsx  #     root: bố cục zone + overlay
│   │   ├── settings/#     SettingsModal, coreSettings (schema), Theme/FontPicker
│   │   ├── sidebar/ #     LeftSidebar (panel), RightSidebar (window manager)
│   │   └── overlays/#     FocusToggle, LowPowerSuggest, Onboarding
│   ├── popup/       #   vỏ popup (PopupApp, ToolResultCard)
│   └── site/        #   vỏ Custom Site (SiteApp, SiteShell, pages/)
│   (app/sidepanel/ … ← thêm sau)
│
├── core/            # DỊCH VỤ nền, ĐỘC LẬP bề mặt — tái dùng ở mọi entrypoint
│   ├── feature-registry/  site-registry/  embed-registry/
│   ├── settings-engine/   theme-engine/   font-engine/   router/
│   ├── layout-engine/     notification-engine/  oauth/  storage/  net/
│   ├── messaging/  handoff/  audio/
│   ├── cursor/  background-fx/  sound/  focus/  event-bus/  i18n/
│
├── features/        # MỖI bề mặt 1 thư mục con; mỗi tính năng TỰ đăng ký vào registry của nó
│   ├── newtab/      #   feature của New Tab (+ index.ts gom import)
│   │   ├── search-bar/  clock-weather/  wallpaper/  most-visited/  daily-quote/ …
│   │   └── tool-qr/  tool-emoji/  tool-pomodoro/  panel-github/ …
│   ├── site/        #   app của Custom Site  → audio-editor/  clip-viewer/
│   └── embed/       #   tool nhúng           → page-to-markdown/  (+ catalog.ts)
│   (features/sidepanel/ … ← thêm sau)
│
└── shared/          # Dùng chung MỌI nơi (mọi bề mặt)
    ├── ui/          #   UI kit (Button, Modal, Select, ReloadButton…)
    ├── icons/       #   brand SVG
    └── utils/       #   hàm thuần (dockMagnify, markdownResult…)
```

**Chiều phụ thuộc (chỉ đi 1 chiều):** `entrypoints → app → features → core / shared`.
`core` và `shared` KHÔNG import ngược lên `app`/`features`. Giữ đúng chiều này là chìa khoá để dễ giám sát. Mỗi bề mặt (newtab, sidepanel…) là 1 thư mục con trong cả `app/` lẫn `features/` — thêm bề mặt không đụng bề mặt cũ.

## 2. Đặt file loại nào ở đâu?

| Loại | Nơi đặt | Ví dụ |
|---|---|---|
| **Component** UI của 1 tính năng | `features/newtab/<tên>/index.tsx` | `features/newtab/tool-qr/index.tsx` |
| **Component** vỏ (New Tab) | `app/newtab/<nhóm>/` | `app/newtab/sidebar/LeftSidebar.tsx` |
| **Hook / engine** dùng nhiều nơi | `core/<tên>/` | `core/theme-engine/useTheme.ts` |
| **Store** (Zustand) của feature | ngay trong `features/newtab/<tên>/store.ts` | `features/newtab/tool-tasks/store.ts` |
| **Constant / schema** cấu hình | cạnh nơi dùng | `app/newtab/settings/coreSettings.ts` |
| **Util** hàm thuần, không React | `shared/utils/` | `shared/utils/dockMagnify.ts` |
| **Type** dùng chung | `shared/types/` hoặc cạnh module | `src/types/*.d.ts` |
| **CSS** của component | cùng folder, cùng tên | `LeftSidebar.tsx` + `left-sidebar.css` |
| **Thuật toán** của 1 tool | `features/site/<tool>/engine/` | `video-editor/engine/tracks.ts` |
| **Hook** riêng của 1 tool | ngay trong thư mục tool | `video-editor/useVideoProject.ts` |

## 3. Thêm một tính năng / công cụ mới

Không cần đụng code lõi — chỉ 2 bước:
1. Tạo `features/newtab/<tên>/index.tsx` gọi `registerFeature({ id, zone, component, … })`.
2. Thêm 1 dòng `import "./<tên>"` vào `features/newtab/index.ts`.

Zone quyết định nó xuất hiện ở đâu: `center`, `background`, `quick-access-bar`, `left-sidebar`, `right-sidebar`. Settings + Onboarding tự sinh ra mục cho nó.

## 4. Thêm SidePanel sau này (bộ công cụ)

SidePanel là **một bề mặt mới**, tái dùng lại `core` + `features` + `shared`:

1. **Entrypoint:** tạo `entrypoints/sidepanel/` (WXT hỗ trợ `sidePanel`), khai báo trong `wxt.config.ts`.
2. **Vỏ riêng:** tạo `app/sidepanel/SidePanelApp.tsx` — bố cục gọn cho khung hẹp, KHÔNG dùng lại layout New Tab.
3. **Feature riêng:** tạo `features/sidepanel/` cho tool đặc thù của SidePanel; hoặc `import` lại tool từ `features/newtab/` (QR, Emoji, Pomodoro… đã tách rời khỏi vỏ), hoặc thêm cờ `surfaces: ["newtab","sidepanel"]` vào `registerFeature` nếu muốn 1 tool xuất hiện ở nhiều bề mặt.
4. **Chia sẻ state:** dùng `core/storage` (IndexedDB) hoặc `browser.storage` như hiện tại — SidePanel và New Tab đọc chung dữ liệu.

> Nhờ tách "vỏ" (`app/`) khỏi "dịch vụ" (`core/`) và "tính năng" (`features/`), thêm bề mặt mới = thêm 1 entrypoint + 1 vỏ, KHÔNG phải viết lại logic.

## 5. Thêm Custom Page (trang riêng, vd trang thống kê)

Tương tự SidePanel: tạo `entrypoints/<tên>/index.html` + `main.tsx` mount một component ở `app/<tên>/`. Tái dùng `shared/ui` cho giao diện, `core/storage` cho dữ liệu.

## 5b. `engine/` — tách thuật toán khỏi React

Mỗi tool lớn có một thư mục `engine/` chứa **hàm thuần**: không import React, không chạm DOM, chỉ nhận số/đối tượng và trả về số/đối tượng.

Lý do không phải là thẩm mỹ. Dự án **không có test runner**; cách duy nhất đang dùng để kiểm logic là bundle file đó bằng esbuild rồi chạy dưới Node:

```bash
pnpm exec esbuild <file>.ts --bundle --platform=node --format=esm   --alias:@=./src --outfile=<out>.mjs && node <out>.mjs
```

Một hàm chỉ chạy được như vậy khi nó không chạm DOM — nên ranh giới `engine/` vừa là chỗ để test, vừa là thứ ép logic tách khỏi giao diện.

| Tool | `engine/` chứa gì |
|---|---|
| video-editor | `model` (kiểu track/item), `tracks` (di chuyển/cắt/chống đè), `compose` (thời điểm → lớp vẽ + phần tiếng), `frameGeometry`, `layerRender`, `export`, `migrate` |
| audio-editor | `dsp`, `enhance`, `wav`, `peaks`, `project` |
| web-time-tracker | `session`, `store` (gộp khoảng, tổng theo ngày) |
| image-editor | `redact`, `history` |

Component chỉ còn việc gọi các hàm này và vẽ kết quả. Ví dụ `VideoEditor.tsx` giữ state hiển thị + transport, còn tầng tài liệu (nạp/lưu/undo/thư viện media) nằm trong `useVideoProject.ts`, thuật toán timeline nằm trong `engine/tracks.ts`.

## 6. Chất lượng code (đã cài)

- **ESLint** (`eslint.config.js`, flat config) + **TypeScript** (`tsc --noEmit`): chạy `pnpm lint` / `pnpm compile`.
- Tự chạy khi commit (husky + lint-staged) và trong CI (`.github/workflows/ci.yml`).
- Quy tắc quan trọng: `react-hooks` bắt lỗi hook; biến thừa báo lỗi (đặt tiền tố `_` nếu cố ý bỏ).
- **`no-restricted-imports` chặn `@/features/**`** bên trong `features/site`, `features/embed`, `features/popup` — xem §7.5.
- `public/**` bị bỏ qua: đó là asset minified của bên thứ ba (tesseract, excalidraw) vendor vào để hợp CSP.

## 7. Ba bề mặt mới: Popup, Custom Site, Tool nhúng

Ngoài New Tab, dự án hiện có thêm ba bề mặt. Mỗi cái vẫn theo đúng quy tắc §1 — thêm bề mặt = thêm 1 entrypoint + 1 vỏ trong `app/`, **không đụng bề mặt cũ**.

| Bề mặt | Entrypoint | Vỏ | Feature | Registry |
|---|---|---|---|---|
| Popup | `entrypoints/popup/` | `app/popup/` | — (chỉ hiển thị) | đọc cả hai registry dưới |
| Custom Site | `entrypoints/site/` → `site.html` | `app/site/` | `features/site/` | `core/site-registry` |
| Tool nhúng | `entrypoints/embed.content/` | — (Shadow DOM) | `features/embed/` | `core/embed-registry` |

Chi tiết: [docs/site/00-tong-quan.md](./site/00-tong-quan.md) và [docs/embed/00-tong-quan.md](./embed/00-tong-quan.md).

### 7.1 Ba registry, cùng một triết lý

`core/feature-registry` (New Tab) · `core/site-registry` (Custom Site) · `core/embed-registry` (tool nhúng).

Cả ba đều là một `Map` + hàm `register*()`, và đăng ký là **side effect của việc import** thư mục tính năng. Thêm thứ gì mới luôn chỉ là: tạo folder + thêm 1 dòng `import` vào barrel. Không chỗ nào hardcode danh sách.

### 7.2 Message router

Trước đây `background.ts` chỉ xử lý đúng một message ad-hoc. Giờ hợp đồng nằm ở [`core/messaging/types.ts`](../src/core/messaging/types.ts) dưới dạng union có kiểu:

```ts
type RuntimeMessage =
  | { type: "getRedirectUri"; path?: string }   // giữ nguyên, core/oauth vẫn dùng
  | { type: "embed:ping" }
  | { type: "embed:run"; toolId: string; params?: Record<string, unknown> }
  | { type: "embed:list" }
  | { type: "site:open"; route?: string };
```

Mỗi listener chỉ trả lời message của mình và `return undefined` với phần còn lại, nên background và content script cùng tồn tại được trên một kênh.

### 7.3 Quyền và manifest

| | |
|---|---|
| Thêm vào `permissions` | `scripting`, `activeTab` |
| Thêm `content_security_policy.extension_pages` | `'wasm-unsafe-eval'` — bắt buộc cho MP3 encoder (WASM) của audio editor |
| Hook `build:manifestGenerated` | **xoá `host_permissions`** mà `registration: "runtime"` tự sinh ra |

Kết quả: cài extension vẫn **không** có cảnh báo "đọc dữ liệu trên tất cả trang web".

Chrome build là MV3, Firefox build là **MV2** (mặc định của WXT cho Gecko) — `core/messaging` feature-detect để rơi từ `scripting.executeScript` về `tabs.executeScript`.

### 7.4 Chia sẻ state giữa các bề mặt

- **Cấu hình** — `core/settings-engine` (Dexie), như cũ. Ngoại lệ: content script không thấy Dexie của extension, nên cấu hình tool nhúng được popup đọc rồi gửi kèm message.
- **Dữ liệu tạm giữa hai bề mặt** — [`core/handoff`](../src/core/handoff/index.ts): park payload dưới một id ngắn (`storage.session`, rơi về `storage.local` trên MV2) thay vì nhét vào URL.

### 7.5 Một tool = một thư mục (có ESLint canh)

Trong `features/site`, `features/embed`, `features/popup`, mỗi tool phải **xoá được mà không ai gãy**.

Quy tắc kỹ thuật: bên trong ba thư mục đó, một specifier `@/features/**` là **lỗi build**. Lý do rất cụ thể — trong tool của mình bạn luôn dùng đường dẫn tương đối, nên một `@/features/...` ở đó *theo định nghĩa* là thò tay sang tool khác. Đó chính là thứ biến "một thư mục xoá được" thành "một thư mục không xoá nổi".

Cần dùng chung thì có đúng hai lựa chọn: **chép** sang tool kia, hoặc **nâng lên** `core`/`shared`.

> Đây là đánh đổi có chủ ý, không phải sơ suất. `video-editor/engine/waveform.ts` gần giống `audio-editor/engine/peaks.ts` — khoảng 30 dòng lặp lại, đổi lấy việc hai tool không ràng buộc nhau. Với 30 dòng thì lặp rẻ hơn ràng buộc; nếu là 300 dòng thì câu trả lời đúng là nâng lên `core`.

`features/newtab/` ra đời **trước** quy ước này và còn vài import chéo (avatar → wallpaper, panel-weather-detail → clock-weather), nên nó được cố ý loại khỏi rule thay vì viết lại hàng loạt. Không thêm cái mới.

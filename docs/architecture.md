# Kiến trúc & Tổ chức code

Tài liệu này giải thích **file nào đặt ở đâu** và **cách mở rộng** sang SidePanel / Custom Page sau này, để dễ giám sát khi dự án lớn dần.

## 1. Phân lớp (4 tầng)

```
src/
├── entrypoints/     # Điểm vào của TỪNG bề mặt trình duyệt (WXT build mỗi cái ra 1 trang)
│   ├── newtab/      #   trang New Tab (mount App)
│   ├── background.ts#   service worker (alarms, message bus)
│   └── (sidepanel/, options/…  ← thêm sau)
│
├── app/             # "Vỏ" (shell) — MỖI bề mặt 1 thư mục con
│   └── newtab/      #   vỏ New Tab
│       ├── App.tsx  #     root: bố cục zone + overlay
│       ├── settings/#     SettingsModal, coreSettings (schema), Theme/FontPicker
│       ├── sidebar/ #     LeftSidebar (panel), RightSidebar (window manager)
│       └── overlays/#     FocusToggle, LowPowerSuggest, Onboarding
│   (app/sidepanel/ … ← thêm sau)
│
├── core/            # DỊCH VỤ nền, ĐỘC LẬP bề mặt — tái dùng ở mọi entrypoint
│   ├── feature-registry/  settings-engine/  theme-engine/  font-engine/
│   ├── layout-engine/     notification-engine/  oauth/  storage/  net/
│   ├── cursor/  background-fx/  sound/  focus/  event-bus/  i18n/
│
├── features/        # MỖI bề mặt 1 thư mục con; mỗi tính năng TỰ đăng ký qua registerFeature()
│   └── newtab/      #   feature của New Tab (+ index.ts gom import)
│       ├── search-bar/  clock-weather/  wallpaper/  most-visited/  daily-quote/ …
│       └── tool-qr/  tool-emoji/  tool-pomodoro/  panel-github/ …
│   (features/sidepanel/ … ← thêm sau)
│
└── shared/          # Dùng chung MỌI nơi (mọi bề mặt)
    ├── ui/          #   UI kit (Button, Modal, Select, ReloadButton…)
    ├── icons/       #   brand SVG
    └── utils/       #   hàm thuần (dockMagnify…)
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

## 6. Chất lượng code (đã cài)

- **ESLint** (`eslint.config.js`, flat config) + **TypeScript** (`tsc --noEmit`): chạy `pnpm lint` / `pnpm compile`.
- Tự chạy khi commit (husky + lint-staged) và trong CI (`.github/workflows/ci.yml`).
- Quy tắc quan trọng: `react-hooks` bắt lỗi hook; biến thừa báo lỗi (đặt tiền tố `_` nếu cố ý bỏ).

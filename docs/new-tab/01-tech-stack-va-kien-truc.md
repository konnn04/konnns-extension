# 01 — Tech Stack & Kiến trúc

## 1. Tech Stack

| Layer | Lựa chọn | Ghi chú |
|---|---|---|
| Framework extension | **WXT** | Cross-browser build (Chrome MV3 + Firefox), HMR tốt, entrypoints rõ ràng |
| UI | **React 18** | Component-driven, dễ tách feature module |
| Build | **Vite** | Đi kèm sẵn trong WXT |
| Styling | CSS Variables + CSS Modules (hoặc Tailwind nếu quen — xem `05-theme-he-thong.md`) | Bắt buộc theme-able qua token, không hardcode màu |
| State | **Zustand** + middleware `persist` (nhẹ hơn Redux) | Mỗi feature 1 store riêng, tránh 1 store khổng lồ |
| Storage | **IndexedDB** qua **Dexie.js** | Ảnh, video, settings, cache, lịch sử |
| Animation | **Framer Motion** cho phần cần orchestration (panel mở/đóng, window drag) + CSS transition thuần cho hover/micro-interaction (nhẹ GPU hơn) | Xem chi tiết `09-uiux-animation-loading-state.md` |
| Drag & drop | **dnd-kit** (bookmark sắp xếp), **react-rnd** hoặc tự viết bằng Pointer Events (window manager phải) | Ưu tiên nhẹ, accessible |
| Icon | **Lucide** | Nhất quán, tree-shakable |
| i18n | **react-i18next** | Tối thiểu VI + EN từ đầu |
| Lint/Format | ESLint + Prettier | |
| Test | Vitest + React Testing Library | Bắt buộc cho core: storage, settings engine, feature registry |

## 2. Cấu trúc thư mục

```
extension/
├── entrypoints/
│   ├── newtab/                # Trang chính (React root)
│   ├── background.ts          # Service worker: alarms (pomodoro), message bus, OAuth callback
│   └── options/                # (tùy chọn) trang settings full-page ngoài modal
├── src/
│   ├── core/
│   │   ├── storage/            # Dexie schema, migration, backup/import-export
│   │   ├── settings-engine/    # Registry tính năng, form schema → UI tự sinh
│   │   ├── theme-engine/       # Token loader, theme switcher, custom CSS injector (sandboxed)
│   │   ├── layout-engine/      # Window manager (phải), panel manager (trái), quick-access-bar zone
│   │   ├── onboarding-engine/  # Điều phối luồng onboarding lần đầu
│   │   └── event-bus/          # Giao tiếp giữa module không phụ thuộc trực tiếp
│   ├── features/
│   │   ├── search-bar/
│   │   ├── clock-weather/
│   │   ├── wallpaper/
│   │   ├── bookmark-bar/
│   │   ├── panel-weather-detail/
│   │   ├── panel-news/
│   │   ├── panel-calendar/
│   │   ├── panel-github/
│   │   ├── panel-spotify/
│   │   ├── tool-pomodoro/
│   │   ├── tool-tasks/
│   │   └── tool-notes/
│   │       # Mỗi feature: index.tsx, settings.schema.ts, store.ts, README.md, assets/
│   ├── themes/
│   │   ├── ocean/, cosmos/, nature/, desert/, future-city/
│   │   └── theme.schema.ts
│   ├── assets/                 # Asset dùng chung (xem 10-assets-requirements.md)
│   └── shared/                  # UI kit dùng chung (Button, Modal, Slider, Skeleton...)
```

## 3. Feature Registry Pattern (bắt buộc cho white-label)

Mỗi feature tự đăng ký vào 1 registry trung tâm, core không cần biết trước danh sách feature:

```ts
registerFeature({
  id: "panel-weather-detail",
  zone: "left-sidebar",
  icon: CloudIcon,
  defaultEnabled: true,
  requiresNetwork: true,
  settingsSchema: weatherSettingsSchema,
  component: lazy(() => import("./PanelWeatherDetail")),
  onboardingStep: weatherOnboardingStep, // optional, xem 08-onboarding.md
});
```

→ Thêm tính năng mới = tạo folder + gọi `registerFeature`, không sửa code lõi.

## 4. Layout Zones

| Zone | Hành vi |
|---|---|
| `center` | Search bar, clock, (tùy chọn) quick links |
| `background` | Wallpaper layer (z-index thấp nhất) |
| `quick-access-bar` | Bookmark thay thế — orientation: horizontal / vertical / radial |
| `left-sidebar` | Trigger icons dọc trái → panel trượt ra. Single-open hoặc multi-open (setting toàn cục). Auto-hide khi đóng hết, hiện lại khi hover sát mép trái |
| `right-sidebar` | Tương tự trái nhưng render dạng "window" (floatable, minimize, maximize) — cần Window Manager riêng |
| `settings-trigger` | Góc phải dưới, hiện khi hover |
| `onboarding-overlay` | Chỉ hiện lần đầu / khi user chủ động mở lại từ settings |

## 5. Window Manager (khu vực phải) — tóm tắt kiến trúc

Chi tiết đầy đủ ở `04-sidebar-phai-tools-window-manager.md`. Điểm kiến trúc chính:
- Mỗi tool là 1 "window" độc lập: state = `{position, size, zIndex, mode: 'docked'|'floating'|'minimized'|'maximized'}`.
- State lưu per-tool trong IndexedDB (`window-states` table).
- Dùng 1 `WindowManagerProvider` context quản lý z-index stacking chung, tránh xung đột giữa các tool.

## 6. Tương thích đa trình duyệt (Chrome + Firefox)

- Dùng `webextension-polyfill` (`browser.*`) thay vì `chrome.*` trực tiếp — WXT hỗ trợ sẵn.
- MV3 background = service worker (Chrome) / event page tương đương (Firefox MV3 hỗ trợ từ v109+).
- Quyền (`permissions`) khai báo tối thiểu; quyền optional (bookmarks, notifications) xin runtime khi user bật tính năng tương ứng — tránh cảnh báo permission khi cài đặt lần đầu.
- Media lớn (ảnh/video) → cần `unlimitedStorage` trong manifest (không cần runtime prompt) + gọi `navigator.storage.persist()`.
- Test riêng trên Firefox: `chrome.identity` (OAuth) có hành vi khác — dùng abstraction layer trong `core/` để 2 trình duyệt dùng chung 1 API nội bộ.

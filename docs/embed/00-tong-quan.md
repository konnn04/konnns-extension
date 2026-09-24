# Tool nhúng (Embedded Tools) — Tổng quan

Hướng phát triển thứ hai của extension: **công cụ chạy thẳng trên trang web người dùng đang xem**, thay vì trong một trang riêng của extension. Đây là nền móng cho các tính năng tự động hoá sau này.

## 1. Vì sao tách thành một bề mặt riêng

New Tab và Custom Site chạy trong ngữ cảnh của extension: có `browser.*` đầy đủ, có IndexedDB của extension, có theme engine. Content script thì ngược lại — nó sống trong **origin của trang chủ nhà**:

| | Trang extension | Content script |
|---|---|---|
| `browser.tabs`, `browser.scripting` | có | không |
| IndexedDB / Dexie của extension | có | **không** (là IndexedDB của trang web) |
| `document` của trang web | không | có |
| Theme engine (ghi biến lên `<html>`) | được | **không nên** (phá layout trang chủ nhà) |

Vì vậy nó là một thư mục riêng ở cả `entrypoints/` lẫn `features/`, và **không** dùng chung `core/settings-engine` theo kiểu đọc trực tiếp (xem §4).

## 2. Nạp theo yêu cầu, không khai báo sẵn

Content script **không** nằm trong `content_scripts` của manifest. Nó được inject khi user bấm nút trong popup:

```
popup                          background/                 tab
  │                            content script
  ├─ ensureEmbedInjected(tabId)
  │     ├─ tabs.sendMessage({type:"embed:ping"}) ──────────▶  (im lặng nếu chưa có)
  │     └─ scripting.executeScript({files:[...]})  ────────▶  inject
  ├─ sendToTab({type:"embed:run", toolId, params}) ────────▶  chạy tool
  └────────────────────────────◀── Reply<EmbedRunResult> ──┘
```

Cơ chế này nằm ở [`src/core/messaging/index.ts`](../../src/core/messaging/index.ts).

**Quyền:** chỉ `activeTab` + `scripting`. Trình duyệt cấp `activeTab` cho đúng tab mà user vừa bấm icon extension, nên khi cài **không có cảnh báo "đọc dữ liệu trên tất cả trang web"**.

Điểm cần biết: `defineContentScript({ registration: "runtime" })` khiến WXT tự đẩy `matches` vào `host_permissions` — đúng thứ ta muốn tránh. Nên [`wxt.config.ts`](../../wxt.config.ts) xoá nó lại trong hook `build:manifestGenerated`:

```ts
hooks: {
  "build:manifestGenerated": (wxt, manifest) => {
    if (wxt.config.command === "serve") return;   // xem cảnh báo bên dưới
    manifest.host_permissions = manifest.host_permissions.filter(
      (p) => !ALL_SITES.includes(p),
    );
    if (manifest.host_permissions.length === 0) delete manifest.host_permissions;
  },
}
```

> **Hai điều hook này TUYỆT ĐỐI không được làm:**
>
> 1. **Chạy ở chế độ dev.** `wxt` (serve) tự thêm `http://localhost/*` vào `host_permissions` để trang extension nạp được module từ dev server. Xoá nó đi thì mọi trang chết với lỗi CORS `No Access-Control-Allow-Origin header`.
> 2. **Xoá sạch cả mảng.** Chỉ được lọc đúng pattern toàn-trang mà content script gây ra.

> **Khi kiểm tra build, luôn mở `.output/chrome-mv3/manifest.json` xác nhận KHÔNG có `host_permissions`.**

**Chrome là MV3, Firefox là MV2** (mặc định của WXT cho Gecko). MV2 không có `browser.scripting`, nên `injectScript()` feature-detect và rơi về `browser.tabs.executeScript`.

Muốn bật chế độ luôn-chạy (tự động hoá nền) sau này: xin `optional_host_permissions: ["*://*/*"]` (đã khai báo sẵn) qua [`core/permissions.ts::requestPermissions`](../../src/core/permissions.ts) rồi gọi `browser.scripting.registerContentScripts`. Trên MV2 quyền origin nằm trong `optional_permissions`.

## 3. Embed Tool Registry

[`src/core/embed-registry/index.ts`](../../src/core/embed-registry/index.ts) — cùng triết lý với `core/feature-registry`: thêm tool = tạo folder + 1 dòng import.

Định nghĩa bị **tách đôi có chủ đích**:

- `EmbedToolDefinition` — nửa **runtime**, nằm trong content script. Chỉ có `id` + `run` và/hoặc `mount`. **Không có icon, không có i18n key** — nhờ vậy React và lucide-react không bị kéo vào bundle inject vào mọi trang.
- `EmbedToolMeta` — nửa **hiển thị**, popup đọc từ [`features/embed/catalog.ts`](../../src/features/embed/catalog.ts).

Hai kiểu tool:

| | Dùng khi |
|---|---|
| `run(params)` | Chạy một phát, trả kết quả về popup. Ví dụ: Trang → Markdown. |
| `mount(host)` | UI thường trú trong Shadow DOM, tự theo dõi trang. **Đây là chỗ cho các tool tự động hoá sau này.** |

## 4. Cấu hình tool đi theo message, không đọc từ DB

Content script không thấy được Dexie của extension. Nên tuỳ chọn của tool:

1. Khai báo `SettingsSchema` bình thường (`features/embed/<tool>/settings.ts`).
2. **Popup** đọc giá trị (`schemaDefaults` + giá trị đã lưu) và gửi kèm trong `params`.
3. `run()` merge với default của chính nó để an toàn khi bị gọi thiếu tham số.

Popup render form bằng `SettingsForm` có sẵn — không viết form riêng.

## 5. Giao diện trong trang

Toàn bộ UI nhúng nằm trong một **ShadowRoot** tạo bằng `createShadowRootUi` của WXT (`cssInjectionMode: "ui"`), nên CSS hai chiều không rò rỉ.

Theme engine **không** chạy ở đây. [`embed.css`](../../src/entrypoints/embed.content/embed.css) mang một bộ token tối giản riêng (`--kx-*`) tự đổi sáng/tối theo `prefers-color-scheme`.

## 6. Thêm một tool mới

1. `src/features/embed/<tên>/index.ts` → `registerEmbedTool({ id, run })`.
2. Thêm `import "./<tên>"` vào `src/features/embed/index.ts`.
3. Thêm một entry vào `EMBED_CATALOG` trong `src/features/embed/catalog.ts` (id phải khớp).
4. Thêm khoá i18n `embed.tools.<id>.name` / `.desc` vào **cả** `vi.json` và `en.json`.

Popup tự hiện tool đó — không đụng vào code popup.

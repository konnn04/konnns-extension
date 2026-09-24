# Custom Site — Tổng quan

Hướng phát triển thứ nhất: **một trang riêng của extension chứa nhiều ứng dụng / tool nhỏ**, mở bằng cách bấm icon extension → popup → "Mở trang chủ".

URL: `chrome-extension://<id>/site.html#/`

## 1. Ba bề mặt, cùng một lõi

```
entrypoints/popup/   →  app/popup/    (launcher 340px)
entrypoints/site/    →  app/site/     (trang chủ + các app con)
entrypoints/newtab/  →  app/newtab/   (không đụng tới)
        └──────────── cùng dùng ────────────┘
                core/   +   shared/
```

Đúng chiều phụ thuộc của [architecture.md §1](../architecture.md): `entrypoints → app → features → core / shared`.

`app/site/SiteApp.tsx` khởi động **đúng trình tự của `app/newtab/App.tsx`**: `hydrate()` settings → `useThemeEngine()` → `useFontEngine()` → `setLanguage()`. Nhờ vậy site tự ăn theo theme, font, ui-scale và ngôn ngữ user đã chọn ở New Tab mà không cần code thêm gì. Popup cũng vậy.

## 2. Site App Registry

[`src/core/site-registry/index.ts`](../../src/core/site-registry/index.ts) — bản song song của `core/feature-registry` dành cho site.

```ts
registerSiteApp({
  id: "audio-editor",
  path: "/audio",              // → site.html#/audio
  nameKey: "site.apps.audio-editor.name",
  descKey: "site.apps.audio-editor.desc",
  icon: AudioWaveform,
  category: "media",
  fullBleed: true,             // app tự lo layout, shell bỏ padding
  component: lazy(() => import("./AudioEditor")),
});
```

**Ba nơi đọc từ registry này:** lưới card ở trang chủ, thanh nav trái của shell, và danh sách app trong popup. Thêm app không phải sửa chỗ nào trong ba chỗ đó.

### Các app hiện có

| id | Làm gì | Thư viện nặng (lazy) |
|---|---|---|
| `audio-editor` | cắt/ghép, hiệu ứng, enhance giọng, xuất WAV/MP3 | lamejs (WASM) |
| `video-editor` | timeline nhiều track, chữ/che, xuất MP4/WebM/GIF | mediabunny, gifenc |
| `image-editor` | layer, brush, crop, redact, filter | fabric |
| `whiteboard` | canvas vô hạn | excalidraw (asset self-host) |
| `pdf-to-text` | trích text, OCR khi là bản scan | pdfjs-dist, tesseract.js |
| `markdown-pdf` | soạn markdown, in ra giấy thật | codemirror, markdown-it |
| `qr-generator` | sinh QR có logo/màu/kiểu | — |
| `web-time-tracker` | thống kê thời gian theo site | — |
| `auto-clear-cache` | dọn cache/cookie theo lịch | — |
| `clip-viewer` | xem payload nhận từ bề mặt khác (`hidden`) | — |

Hai cờ đáng chú ý:

- `hidden: true` — vào được bằng route nhưng không hiện ở trang chủ/nav (ví dụ `clip-viewer`, chỉ có nghĩa khi kèm id).
- `fullBleed: true` — shell bỏ padding và cho app chiếm toàn bộ chiều cao (audio editor cần).

`component` **luôn dùng `lazy()`**: nhờ vậy những thứ nặng ở cột phải bảng trên — mediabunny, fabric, excalidraw, tesseract — không bao giờ nằm trong bundle của trang chủ. Đây không phải tối ưu vặt: riêng tesseract + excalidraw đã hơn 40MB asset.

## 3. Router

[`src/core/router/useHashRoute.ts`](../../src/core/router/useHashRoute.ts) — khoảng 40 dòng, không thêm react-router.

Lý do: dự án hiện không có router nào (New Tab điều hướng bằng state), và site chỉ cần đọc path, điều hướng, quay lại. `matchSiteApp()` khớp cả sub-path nên `/clip/abc123` rơi đúng vào app đăng ký ở `/clip`.

## 4. Thêm một app mới

1. `src/features/site/<tên>/index.tsx` → `registerSiteApp({...})` với `component: lazy(...)`.
2. Thêm `import "./<tên>"` vào `src/features/site/index.ts`.
3. Thêm khoá i18n `site.apps.<id>.name` / `.desc` vào **cả** `vi.json` và `en.json`.

Trang chủ, nav và popup tự cập nhật.

### Một tool = một thư mục

Đây là **hợp đồng bắt buộc**, không phải gợi ý sắp xếp: mọi thứ một tool cần nằm trong thư mục của nó, và xoá thư mục đó phải không làm vỡ tool nào khác.

Tool **được phép** phụ thuộc ra ngoài đúng ba chỗ — hạ tầng dùng chung, không phải tool khác:

| Được | Ví dụ |
|---|---|
| `@/core/*` | registry, storage, settings-engine, router |
| `@/shared/*` | bộ UI, hàm tiện ích |
| đường dẫn tương đối trong chính thư mục mình | `./engine/project`, `../timeline/hitTest` |

Tool **không được** `import` từ một tool khác. Trong thư mục của mình bạn luôn dùng đường dẫn tương đối, nên một specifier `@/features/...` xuất hiện ở đây thì **theo định nghĩa** là đang với sang tool khác. ESLint chặn thẳng:

```
error  '@/features/site/clip-viewer/ClipViewer' import is restricted…
       A tool must not import another tool.  no-restricted-imports
```

Rule nằm ở [`eslint.config.js`](../../eslint.config.js), áp cho `src/features/site/**` và `src/features/embed/**`. (`src/features/newtab` có trước quy ước này và còn vài chỗ vi phạm, nên tạm thời chưa nằm trong phạm vi rule.)

Cần dùng chung thật thì **đẩy phần chung lên `@/core` hoặc `@/shared`**, đừng với ngang — với ngang là cách một thư mục đang xoá được biến thành thư mục không xoá được.

Tool phức tạp thì chia tầng **bên trong** thư mục của mình. Audio editor làm mẫu:

```
src/features/site/audio-editor/
├── index.tsx          đăng ký + lazy entry
├── *.tsx              UI
├── store.ts           state (zustand)
├── engine/            DSP / model / phát lại — thuần, không React, test bằng Node
├── timeline/          canvas renderer + hit test
└── tools/             xử lý chuột
```

`engine/` không biết gì về React hay store; đó là lý do nó chạy được dưới Node và đang gánh phần lớn số assertion của dự án.

## 5. Popup

[`src/app/popup/PopupApp.tsx`](../../src/app/popup/PopupApp.tsx) — 340px, hai phần:

- **Ứng dụng** — sinh từ Site App Registry, bấm là mở site đúng route.
- **Trên trang này** — sinh từ `EMBED_CATALOG`, chạy tool nhúng trên tab hiện tại (xem [docs/embed](../embed/00-tong-quan.md)). Tự disable kèm lý do khi `isInjectableUrl()` trả false (`chrome://`, cửa hàng tiện ích…).

Mở site đi qua background (`{type:"site:open"}`) để **focus tab đã mở** thay vì chất đống tab mới.

## 6. Vỏ site: rail thu gọn được, trang chủ tìm được

Rail trái có nút thu gọn còn lại icon, nhớ trong `localStorage` (bọc try/catch — cửa sổ ẩn danh và trình duyệt chặn site data đều ném ở đây). Lúc thu gọn, nhãn **không** bị `display:none` mà ẩn theo kiểu visually-hidden: chúng vẫn là tên khả truy cập của từng link, nếu không screen reader chỉ còn một cột icon trống.

Trang chủ có ô tìm tool, khớp trên **tên và mô tả đã dịch** chứ không phải id nội bộ, và **bỏ dấu** trước khi so — gõ "am thanh" vẫn ra "Sửa âm thanh".

## 7. Cài đặt nhanh trên site

[`QuickSettings.tsx`](../../src/app/site/QuickSettings.tsx) — nút bánh răng ở thanh trên, chứa **ngôn ngữ** và **chế độ màu**.

Site vốn đã *đi theo* hai lựa chọn này (nó dùng chung settings store với New Tab), nhưng trước đó muốn đổi thì phải rời sang New Tab — một chuyến đi kỳ cục khi site là một bề mặt độc lập.

Cố tình chỉ có hai thứ đó. `SettingsModal` đầy đủ là component của New Tab, nối vào các feature registry mà site không host; kéo nó sang đây để tiết kiệm một cú bấm sẽ ghép cứng hai bề mặt vào nhau.

## 8. Chuyển dữ liệu giữa các bề mặt

[`core/handoff`](../../src/core/handoff/index.ts): `putHandoff(payload)` trả về một id ngắn, `readHandoff(id)` đọc lại. Dùng `storage.session` khi có, rơi về `storage.local` kèm TTL trên Firefox MV2.

Đây là cách popup đưa kết quả Markdown sang site mà không nhét dữ liệu lớn vào URL.

# Roadmap — 8 tool tiếp theo

Tài liệu thiết kế **trước khi xây**, khác với `docs/site/` (chỉ ghi tool đã xong) và `docs/embed/` (chỉ ghi tool đã xong). Mỗi file `0N-*.md` trong thư mục này là kiến trúc đầy đủ cho một tool **chưa có dòng code nào** — không phải nhật ký, là bản vẽ để bám theo khi bắt tay code.

Xem hai file nền đã có trước khi đọc bất kỳ file nào ở đây: [docs/architecture.md](../architecture.md) (4 tầng, 3 registry) và [docs/site/01-audio-editor.md](../site/01-audio-editor.md) (mẫu tool phức tạp nhất dự án đã xây xong — nhiều quyết định dưới đây trực tiếp tái dùng bài học từ đó, không phát minh lại).

## 1. Danh sách + xếp hạng giá trị/công sức

| # | Tool | Bề mặt | Thư viện chính | Công sức | Vì sao xếp vậy |
|---|---|---|---|---|---|
| [06](./06-auto-clear-cache.md) | Auto Clear Cache | background + site app nhỏ | không | **S** | Không canvas, không engine riêng — chỉ `chrome.browsingData` + `chrome.alarms` đã dùng sẵn cho GitHub poll |
| [01](./01-pdf-to-text.md) | PDF → Văn bản | site app | pdfjs-dist | **S/M** | Trích text-layer là việc pdf.js làm tốt sẵn; rủi ro nằm ở CSP/worker, không ở logic |
| [05](./05-audio-mixer.md) | Audio Mixer | **popup** (mới: popup widget) | không (mức nâng cao: tabCapture) | **S** (nâng cao: **M**) | Mức cơ bản chỉ là `chrome.tabs.query` + list; mức nâng cao cần offscreen document nên tách hẳn giai đoạn |
| [02](./02-markdown-pdf.md) | Markdown → PDF | site app | CodeMirror 6, markdown-it, DOMPurify | **M** | Soạn thảo + preview đồng bộ cuộn là phần việc thật; xuất PDF dựa vào `window.print()` của trình duyệt, không tự dựng |
| [03](./03-whiteboard.md) | Whiteboard | site app | @excalidraw/excalidraw | **M** | Thư viện lo gần hết vẽ vời + undo; việc của ta là lưu nhiều board và tự host asset |
| [04](./04-web-time-tracker.md) | Web Time Tracker | background + site app | không | **M/L** | Logic đúng (không đua race giữa các tab) khó hơn UI; dashboard là phần dễ |
| [07](./07-image-editor.md) | Image Editor | site app | fabric v6 | **L** | Scope đúng ("đánh dấu ảnh chụp bug") thì vừa sức; scope sai ("Photoshop thật") thì vô đáy |
| [08](./08-video-editor.md) | Video Editor | site app | mediabunny | **XL** | `Conversion` của mediabunny gánh phần trim/crop/ghép nối; timeline UI + trộn audio là phần phải tự xây từ đầu |

**Thứ tự làm đề xuất**, không phải thứ tự trong bảng — xếp theo cả giá trị/công sức lẫn "làm cái nào trước để cái sau dễ hơn":

1. **Auto Clear Cache** — thắng nhanh, và luyện lại đúng mẫu `chrome.alarms` đã có ở `background.ts` trước khi dùng nó cho tool nặng hơn (#4).
2. **PDF → Văn bản** — cùng tinh thần quyết định "site app hay embed tool" đã có ở page-to-markdown, không phải nghĩ lại từ đầu.
3. **Audio Mixer (mức cơ bản)** — nhỏ, nhưng là tool đầu tiên cần **popup widget registry** mới (§2) — làm sớm để các tool popup-native sau này có nền sẵn.
4. **Markdown → PDF** — độ phức tạp vừa, không đụng canvas.
5. **Whiteboard** — thư viện ngoài lo phần khó nhất (vẽ + undo); việc còn lại là tích hợp.
6. **Web Time Tracker** — cần sự cẩn trọng của #1 (alarms/service worker) nhưng ở mức cao hơn (race condition thật).
7. **Image Editor** — scope hẹp vào ca dùng thật (chú thích ảnh chụp bug), không lan sang "Photoshop đầy đủ".
8. **Video Editor** — nặng nhất, hưởng lợi từ bài học canvas/layer của #7 và mô hình clip/track của Audio Editor đã có.

## 2. Hạ tầng dùng chung — đọc 1 lần, áp dụng ở cả 8 tool

Mỗi file `0N-*.md` **không lặp lại** các mục này; chỉ nói cái gì riêng của tool đó.

### 2.1. "Một tool = một thư mục"

Vẫn nguyên quy tắc đã khoá bằng ESLint cho `src/features/site/**` và `src/features/embed/**` (`docs/site/00-tong-quan.md §4`, mục *Một tool = một thư mục*): tool mới nằm gọn trong `src/features/site/<tên>/` hoặc `src/features/embed/<tên>/`, mọi dùng-chung-thật-sự đẩy lên `@/core` hoặc `@/shared`, không `import` chéo sang thư mục tool khác. Tool phức tạp (PDF, Whiteboard, Image/Video Editor) nên tách `engine/` (thuần, không React, test được dưới Node) khỏi phần UI — đúng cấu trúc Audio Editor đang có.

### 2.2. Site app — cùng một cơ chế đăng ký

7/8 tool (trừ Audio Mixer) là site app, đăng ký qua `registerSiteApp()` ([`core/site-registry`](../../src/core/site-registry/index.ts)):

```ts
registerSiteApp({
  id: "pdf-to-text",
  path: "/pdf-to-text",
  nameKey: "site.apps.pdf-to-text.name",
  descKey: "site.apps.pdf-to-text.desc",
  icon: FileText,
  category: "text",          // "media" | "text" | "dev" | "other" — xem ghi chú dưới
  fullBleed: true,            // hầu hết 8 tool này tự lo layout, nên bật
  component: lazy(() => import("./PdfToText")),
});
```

`component` luôn `lazy()` — nguyên tắc "engine nặng (pdfjs, fabric, excalidraw, mediabunny) không được vào bundle trang chủ" áp dụng cho mọi tool có thư viện ngoài trong danh sách này, không riêng Audio Editor.

`SiteAppCategory` hiện chỉ có 4 giá trị (`media`/`text`/`dev`/`other`). Whiteboard và Image/Video Editor không khớp gọn vào nhóm nào — gán tạm `other`, và cân nhắc thêm `design`/`productivity` khi số tool trong `other` đông lên. Đây là thay đổi 1 dòng type, không phải quyết định kiến trúc, nên không bàn riêng ở từng file.

### 2.3. Popup widget — registry thứ tư (mới, cần cho Audio Mixer)

`PopupApp.tsx` hiện chỉ có hai khối, cả hai đều *mở thứ khác*: "Ứng dụng" (site app, đọc từ `site-registry`) và "Trên trang này" (embed tool, chạy trên tab qua `embed-registry`). Audio Mixer không mở gì cả — nó **là** UI ngay trong popup, sống hết vòng đời trong đó. Không khớp registry nào hiện có, và `EmbedToolDefinition.mount()` là cho content-script/trang web, gán nhầm mục đích nếu dùng cho popup.

Nên thêm registry thứ tư, đúng triết lý "Map + `register()`" của ba cái kia (`docs/architecture.md §7.1`):

```ts
// core/popup-widget-registry/index.ts
export interface PopupWidgetDefinition {
  id: string;
  nameKey: string;
  icon: LucideIcon;
  component: ComponentType;   // nhỏ, không cần lazy() — sống trong popup vốn đã nhẹ
  order?: number;
}
```

`PopupApp.tsx` thêm một khối thứ ba render các widget này, nằm giữa "Ứng dụng" và "Trên trang này". Audio Mixer là widget đầu tiên; hạ tầng này làm một lần, dùng lại cho mọi tool popup-native sau này.

### 2.4. Lưu trữ — Dexie, tách cây nhỏ khỏi blob nặng

`DB_SCHEMA_VERSION` hiện là 7. Tool nào cần bảng mới thì bump lên version kế tiếp tại thời điểm code, khai ở [`core/storage/db.ts`](../../src/core/storage/db.ts) — không đặt số cứng trong các file thiết kế này vì thứ tự thật sẽ phụ thuộc tool nào code trước.

Nguyên tắc tách bảng đã chứng minh đúng ở Audio Editor (`audioProjects` cây nhỏ / `audioSources` blob WAV nặng) áp dụng lại bất cứ đâu có dữ liệu lớn đi kèm dữ liệu nhỏ hay đổi: Whiteboard (`boards` cây phần tử / `boardFiles` ảnh dán vào), Video/Image Editor (`projects` cây thao tác / `mediaSources` file gốc), Markdown→PDF (không cần tách — file `.md` tự nó đã nhỏ).

### 2.5. i18n

Mọi khoá mới phải có ở **cả** `src/core/i18n/locales/vi.json` và `en.json`; script kiểm tra parity + "mọi khoá được gọi bằng `t()` đều tồn tại" đã có sẵn trong dự án (dùng lại, không viết script mới).

### 2.6. Quyền — xin đúng lúc dùng, không xin sẵn lúc cài

`wxt.config.ts` đã có `optional_permissions: ["bookmarks", "notifications", "topSites"]` và [`core/permissions.ts::requestPermissions`](../../src/core/permissions.ts) (gesture-safe, đã né được lỗi mất user-gesture của Chromium). Tool nào cần quyền nhạy cảm (`tabs`, `browsingData`, `clipboardRead`, `tabCapture`, `offscreen`, `idle`) thì đưa vào `optional_permissions` và xin ngay tại màn hình cấu hình của chính tool đó khi user bật tính năng — **không** đẩy thẳng vào `permissions` bắt buộc trừ khi tool hoàn toàn không dùng được nếu thiếu quyền đó (`Auto Clear Cache` là ca đó: dùng `browsingData` bắt buộc, xem file riêng). Mục tiêu giữ nguyên tinh thần đã ghi ở `docs/architecture.md §7.3`: cài xong không có cảnh báo "đọc dữ liệu trên mọi trang web".

### 2.7. CSP — không gọi CDN ngoài

`content_security_policy.extension_pages` hiện tại: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` — không cho phép script từ nguồn ngoài, có mở WASM. Mọi thư viện third-party trong 8 tool này (font Virgil của Excalidraw, traineddata của Tesseract, mã nguồn Fabric/CodeMirror/mediabunny) **tự host trong bundle**, không tải qua CDN lúc chạy — đây là yêu cầu chính chủ đã nêu ở Whiteboard, và áp dụng chung cho cả 8. Chỗ nào asset nặng (Tesseract traineddata ~10-20MB) thì tải **lười** (chỉ khi user bật tính năng đó), vẫn là file của extension chứ không phải URL ngoài.

### 2.8. Việc nặng đồng bộ → tái dùng activity channel, không tự nghĩ lại

Audio Editor đã giải quyết đúng bài toán "việc chặn main thread thì UI phải báo cho biết, và phải cắt khúc để đồng hồ còn chạy" bằng [`engine/activity.ts`](../../src/features/site/audio-editor/engine/activity.ts) (`report()` nhường 1 frame trước khi chạy; `yieldToUI()` nhường giữa các khúc). PDF OCR (Tesseract), encode video (mediabunny `Conversion`), render canvas nặng (Fabric/Excalidraw xuất ảnh lớn) đều là việc đồng bộ hoặc gần-đồng-bộ tương tự — nâng cấp module đó lên `core/activity` (bỏ tiền tố `audio.` khỏi labelKey, nhận labelKey theo namespace của tool gọi) thay vì mỗi tool tự viết một bản banner riêng.

## 3. Cách đọc mỗi file `0N-*.md`

Theo đúng 6 mục người yêu cầu đưa ra, cố định thứ tự để so sánh nhanh giữa các tool:

1. Mô hình dữ liệu cốt lõi
2. Luồng tương tác chuột chính
3. Component UI + vai trò
4. Undo/redo (và vì sao chọn kiểu đó)
5. Rủi ro kỹ thuật cụ thể của thư viện đã chọn + cách né
6. Roadmap theo giai đoạn (giá trị/công sức)

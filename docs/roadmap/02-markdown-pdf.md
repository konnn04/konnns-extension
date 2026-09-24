# Tool #2 — Markdown → Preview → PDF

Site app soạn markdown có highlight cú pháp, preview đồng bộ cuộn, xuất PDF **text chọn được** (không phải ảnh). Lưu `.md` vào IndexedDB, import file `.md` có sẵn.

Thư viện: **CodeMirror 6** (chọn thay vì `@uiw/react-md-editor`, xem lý do ở §5), **markdown-it**, **DOMPurify**. Xuất PDF qua `window.print()` — không jsPDF/html2canvas.

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool).

## 1. Mô hình dữ liệu cốt lõi

```ts
interface MarkdownDoc {
  id: string;
  title: string;                 // suy ra từ H1 đầu tiên, sửa tay được
  source: string;                // toàn bộ markdown thô — nguồn sự thật duy nhất
  updatedAt: number;
}

interface EditorState {
  doc: MarkdownDoc;
  dirty: boolean;                // source đổi kể từ lần lưu/mở gần nhất
  cursorLine: number;             // để khôi phục vị trí khi mở lại
  scrollRatio: number;            // 0..1, vị trí cuộn của PANE ĐANG DẪN (xem §2)
  previewHtml: string;            // markdown-it(source) → DOMPurify.sanitize() — derived, không lưu vào DB
  saving: boolean;
}
```

**`previewHtml` không bao giờ lưu.** Nó là hàm thuần của `source` (`sanitize(render(source))`), tính lại mỗi lần `source` đổi (debounce ~150ms để gõ nhanh không giật máy). Lưu HTML đã render là lưu dữ liệu phái sinh — sai một lần là lệch mãi nếu sau này đổi rule render.

**Không tách "nhiều file" thành nhiều bảng như Audio Editor tách project/source.** Một tài liệu markdown vài chục KB không có khối nặng nào đi kèm cần tách riêng — khác hẳn audio (WAV hàng chục MB) hay whiteboard (ảnh dán vào). Một bảng `markdownDocs` là đủ.

## 2. Luồng tương tác chính

Không có canvas — đây là soạn thảo văn bản hai khung, "mouse-first" nghĩa là mọi điều khiển (cuộn, chọn, định dạng nhanh) dùng được bằng chuột thuần, bàn phím là để gõ nội dung chứ không phải để điều khiển UI.

1. **Mở/màn hình trống**: giống các site app khác — nếu chưa có tài liệu nào, hiện danh sách tài liệu đã lưu (giống `ProjectManager` của Audio Editor) + nút "Tài liệu mới" + vùng kéo-thả file `.md` để import.
2. **Bố cục chia đôi màn hình**: CodeMirror bên trái, preview (HTML đã sanitize) bên phải. Có thanh kéo ở giữa để đổi tỷ lệ 2 khung (không cố định 50/50) — kéo bằng chuột, tự lưu tỷ lệ ưa thích vào `localStorage` của trang (không phải Dexie, đây là sở thích hiển thị, không phải dữ liệu).
3. **Cuộn đồng bộ, "ai dẫn ai" xác định bằng khung vừa nhận thao tác cuộn cuối cùng** — cuộn CodeMirror thì preview cuộn theo tỷ lệ tương ứng, và ngược lại. Tránh vòng lặp vô hạn (A cuộn B, B cuộn A, A cuộn B...) bằng một cờ `syncing` chặn phản hồi ngược trong lúc đang tự cuộn theo lệnh từ khung kia (đúng lớp bug lặp lại nhiều lần ở Audio Editor với `setState` vs closure — xử lý bằng cờ boolean đơn giản, không cần store phức tạp).
4. **Thanh công cụ định dạng nhanh phía trên CodeMirror**: các nút Bold/Italic/Link/Code/List/Quote — bấm chuột chèn cú pháp markdown quanh vùng đang bôi đen (hoặc tại con trỏ nếu không bôi đen gì), dùng API `EditorView.dispatch()` của CodeMirror 6, không tự viết logic chèn text bằng tay.
5. **Kéo-thả ảnh vào khung soạn** (tuỳ chọn, giá trị cao với công sức thấp): thả file ảnh → chèn cú pháp `![...](data:...)` dạng base64 inline — không cần server lưu ảnh riêng, markdown tự chứa hết, xuất PDF vẫn ra đúng ảnh.
6. **Xuất PDF**: bấm nút "Xuất PDF" → dựng một **container ẩn** (`display: none` bình thường, chỉ hiện qua `@media print`) chứa đúng `previewHtml` đã sanitize, cộng CSS in ấn riêng (căn trang, ẩn toolbar/editor) → gọi `window.print()`. Trình duyệt mở hộp thoại in hệ điều hành; người dùng tự chọn đích **"Lưu dưới dạng PDF"** và bấm Lưu. Đây **không phải** xuất file tự động — là bước thao tác tay bắt buộc của chính cơ chế `window.print()`, phải nói rõ trong UI (nhãn nút là "Xuất PDF (qua hộp thoại in)", không phải một cú tải file êm ái) để người dùng không chờ file tự rơi xuống.
7. **Lưu**: tự động lưu (`saving: true` trong lúc ghi, debounce 800ms sau lần gõ cuối — đúng nhịp autosave đã dùng ở Audio Editor) + nút "Lưu ngay" cho ai muốn chắc chắn trước khi đóng tab.

## 3. Component UI

| Component | Vai trò |
|---|---|
| `MarkdownEditor.tsx` | Site app root — quản `EditorState`, điều phối đồng bộ cuộn |
| `DocList.tsx` | Màn hình danh sách tài liệu đã lưu + kéo-thả import `.md` |
| `SourcePane.tsx` | Bọc CodeMirror 6 (`@codemirror/lang-markdown` cho highlight, theme tự host — xem §5) |
| `PreviewPane.tsx` | Render `previewHtml`, lắng nghe scroll để đồng bộ ngược lại `SourcePane` |
| `FormatToolbar.tsx` | Nút Bold/Italic/Link/Code/List/Quote — thao tác trên `EditorView` của CodeMirror |
| `SplitDivider.tsx` | Thanh kéo đổi tỷ lệ hai khung, lưu tỷ lệ vào `localStorage` |
| `PrintLayer.tsx` | Container ẩn chỉ hiện lúc in — **tách khỏi `PreviewPane`** dù nội dung giống nhau, vì `PreviewPane` còn có thanh cuộn/padding riêng cho màn hình mà bản in không cần |
| `ExportPdfButton.tsx` | Gọi `window.print()`, nói rõ trong tooltip đây là bước qua hộp thoại in |

## 4. Undo/redo

**Dùng lịch sử built-in của CodeMirror 6** (`@codemirror/commands` cung cấp `undo`/`redo` sẵn, gắn phím Ctrl+Z/Ctrl+Shift+Z mặc định qua `defaultKeymap`) — **không tự xây lớp undo riêng**.

Vì sao đúng ở đây nhưng sai ở Audio Editor: dữ liệu của tool này là **một chuỗi văn bản tuyến tính**, đúng thứ mà mọi trình soạn thảo mã nguồn (CodeMirror, Monaco, textarea của trình duyệt) đã giải quyết bằng transaction/diff log từ lâu — undo ký tự-theo-ký tự, gộp theo cụm gõ liên tục, là hành vi người dùng mong đợi khi gõ văn bản, và CodeMirror làm đúng việc đó miễn phí. Audio Editor phải tự xây snapshot vì dữ liệu của nó là **cây track/clip lồng nhau** với nhiều loại thao tác không tuyến tính (kéo, cắt, đổi hiệu ứng) — không thư viện text editor nào hiểu được cấu trúc đó. Ở đây không có "cấu trúc" nào ngoài chuỗi ký tự, nên dùng đúng công cụ dành riêng cho chuỗi ký tự.

Việc duy nhất project-level cần nghĩ tới: import file `.md` mới đè lên tài liệu đang mở thì phải hỏi xác nhận trước (giống PDF ở tool #1), vì đó là thay `source` hoàn toàn — nằm ngoài lịch sử undo của CodeMirror (undo chỉ theo dõi thay đổi trong chính phiên soạn, không theo dõi "đổi hẳn sang tài liệu khác").

## 5. Rủi ro kỹ thuật cụ thể

**CodeMirror 6 thay vì `@uiw/react-md-editor`.** Gói `@uiw/react-md-editor` là một wrapper đóng gói sẵn CodeMirror + preview + các nút định dạng — tiện nhưng đi kèm rủi ro cụ thể cho dự án này: một số bản có tính năng tuỳ chọn (KaTeX công thức toán, biểu đồ mermaid) tự fetch asset hoặc font từ nguồn ngoài khi bật, khó kiểm soát hết trong review, và phần preview mặc định của nó dùng chuỗi `markdown-it`/`remark` riêng không khớp hoàn toàn với `markdown-it` mà chính tool này chọn dùng cho `previewHtml` — hai bộ render khác nhau cho soạn thảo và xuất PDF là nguồn lệch không đáng có. Dùng CodeMirror 6 trần (`@codemirror/lang-markdown`, `@codemirror/theme-one-dark` hoặc tự viết theme theo token CSS của dự án) kiểm soát được chính xác cái gì được tải, nhất quán với nguyên tắc "không CDN, tự biết mọi thứ trong bundle" áp dụng chung cho cả 8 tool.

**`window.print()` không tự động ra file — người dùng phải bấm "Lưu" trong hộp thoại hệ điều hành.** Không có API nào cho phép extension thường (không phải build doanh nghiệp có `chrome.printing` qua policy quản trị) lấy trực tiếp file PDF về sau khi gọi `print()`. Đây chính là đánh đổi đã chọn khi bỏ jsPDF/html2canvas: đổi lại **text trong PDF chọn được, tìm kiếm được** (dùng đúng bộ dựng PDF của trình duyệt) thay vì một ảnh chụp màn hình dán vào file PDF. Phải nói rõ điều này trong UI (đã ghi ở bước 6, §2) để không ai chờ một file tự tải xuống.

**`window.print()` in cả trang, không chỉ preview, nếu không chặn bằng CSS.** Cần `@media print { .ae-toolbar, .source-pane, .split-divider { display: none } } .print-layer { display: block }` (đảo ngược của trạng thái bình thường) — nếu quên, bản in ra sẽ dính cả CodeMirror và toolbar. Không dùng cách mở tab/`window.open()` riêng để in (cách phổ biến khác) vì phức tạp hơn không cần thiết ở đây — chặn bằng CSS `@media print` ngay trên chính trang đang mở là đủ và giữ được toàn bộ state không bị mất do mở cửa sổ mới.

**Màu nền/box-shadow không in mặc định.** Trình duyệt mặc định bỏ `background`/`box-shadow` khi in để tiết kiệm mực — khối code (`<pre><code>`) trong preview vốn có nền xám sẽ biến mất trong PDF nếu không set `print-color-adjust: exact` (và tiền tố `-webkit-print-color-adjust: exact` cho Chromium) trên `PrintLayer`.

**DOMPurify không phải lớp chặn duy nhất, và cần cấu hình đúng để không xoá mất cú pháp hợp lệ.** CSP hiện tại (`script-src 'self'`) đã chặn thực thi `<script>` và thuộc tính `on*` inline theo mặc định của trình duyệt cho trang extension — DOMPurify là lớp phòng thủ thứ hai, xử lý đúng dạng nguy cơ thật với một trang preview markdown: `<img src="https://…/track.gif">` (theo dõi âm thầm khi mở file người khác gửi), `<iframe>`/`<object>` nhúng lạ, thuộc tính phá layout. Cấu hình `ALLOWED_TAGS`/`ALLOWED_ATTR` phải giữ đúng các thẻ `markdown-it` sinh ra cho code block có highlight (`<pre><code class="language-js">`) và bảng (`<table>`) — cấu hình mặc định quá chặt của DOMPurify có thể xoá mất `class` trên `<code>`, làm mất màu cú pháp trong bản in dù preview trên màn hình vẫn đúng (hai lần render khác cấu hình sanitize là lỗi dễ xảy ra nếu `PrintLayer` không dùng chung một hàm `renderMarkdown()` với `PreviewPane`).

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | CodeMirror soạn thảo có highlight, preview một chiều (gõ → hiện), lưu/mở Dexie | Cao/Trung bình — đây là phần thân chính, không có gì lạ về mặt kỹ thuật |
| 2 | Cuộn đồng bộ hai chiều, thanh công cụ định dạng nhanh | Trung bình/Thấp — cải thiện trải nghiệm rõ rệt với ít code |
| 3 | Xuất PDF qua `window.print()` + CSS in riêng, import `.md` có sẵn | Cao/Thấp — chính là mục tiêu đề bài, nhưng kỹ thuật đã có sẵn trong trình duyệt |
| 4 (tuỳ chọn) | Kéo-thả ảnh chèn base64, xuất `.md` thô (không qua render) để chia sẻ lại | Trung bình/Thấp |

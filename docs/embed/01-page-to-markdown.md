# Tool nhúng #1 — Trang → Markdown

Biến trang web đang xem thành một văn bản Markdown sạch để dán vào chat với AI.

Code: [`src/features/embed/page-to-markdown/`](../../src/features/embed/page-to-markdown/)

## 1. Thư viện: Defuddle

Dùng [**defuddle**](https://github.com/kepano/defuddle) (npm `defuddle`, MIT) — thư viện tách nội dung chính của kepano, viết ra để phục vụ **Obsidian Web Clipper**, tức là đã được kiểm chứng đúng trong môi trường content script.

Vì sao không dùng cặp kinh điển `@mozilla/readability` + `turndown`:

- Readability gần như bị bỏ hoang; Defuddle sinh ra chính là để thay nó.
- Defuddle đọc **mobile stylesheet của chính trang** để đoán phần tử thừa → sạch hơn trên site hiện đại.
- Output **nhất quán cho code block, footnote, công thức toán** — đúng những chỗ mà LLM cần giữ nguyên.
- Bản `defuddle/full` **tự convert sang Markdown** (`{ markdown: true }`) nên **không cần thêm turndown**.

```ts
const result = new Defuddle(doc, {
  url: location.href,
  markdown: true,
  useAsync: false,          // chặn extractor gọi API bên thứ ba (ta không có host permission)
  removeImages: !includeImages,
}).parse();
```

### Đánh đổi về kích thước

`defuddle/full` là một bundle đã gộp sẵn ~727 kB (sau minify) vì nó inline `mathml-to-latex` và toàn bộ site extractor. Chấp nhận được vì:

- script chỉ được inject **khi user bấm nút**, mỗi tab một lần;
- là file cục bộ trong extension, không tải qua mạng.

Bản core `defuddle` nhẹ hơn (~338 kB) nhưng **không có** phần convert Markdown — sẽ phải thêm turndown và mất cách xử lý footnote/math nhất quán. Nếu sau này kích thước thành vấn đề, đó là hướng thay thế, và chỉ phải sửa `extract.ts`.

### Vì sao chạy trong trang chứ không phải trong popup

Từng cân nhắc: content script chỉ gửi `outerHTML` về, popup parse bằng `DOMParser`. Bỏ phương án đó vì Defuddle dựa vào `getComputedStyle` và mobile stylesheet của trang **đang render** — trên một document rời (detached) thì đúng phần mạnh nhất của nó mất tác dụng.

## 2. Tuỳ chọn

Khai báo trong [`settings.ts`](../../src/features/embed/page-to-markdown/settings.ts), featureId `embed-page-to-markdown`. Popup render bằng `SettingsForm` và gửi kèm theo message (xem [00-tong-quan §4](./00-tong-quan.md)).

| Khoá | Mặc định | Ý nghĩa |
|---|---|---|
| `contentMode` | `readable` | `readable` (tự dò nội dung chính) · `selection` (chỉ phần bôi đen) · `full` (cả `document.body`) |
| `includeFrontmatter` | bật | Khối YAML: title, source, author, published, site, clipped |
| `includeImages` | tắt | Giữ `![]()` hay bỏ |
| `includeLinks` | bật | Tắt = giữ chữ, bỏ URL — tiết kiệm nhiều token |
| `maxChars` | 0 | 0 = không giới hạn; vượt thì cắt và đánh dấu `…[truncated]` |

Với `selection` và `full`, tool dựng một `Document` tạm bằng `document.implementation.createHTMLDocument()` rồi mới đưa cho Defuddle — **trang đang xem không bao giờ bị sửa**.

## 3. Đường đi của kết quả

```
content script ──▶ popup: { markdown, wordCount, charCount, title, url }
                     ├─ Sao chép        → navigator.clipboard
                     ├─ Tải .md         → Blob + <a download>
                     └─ Mở trong site   → core/handoff → site.html#/clip/<id>
```

Phần "Mở trong site" đi qua [`core/handoff`](../../src/core/handoff/index.ts) chứ không nhét vào URL: một bài viết đã clip quá lớn để làm query string. Handoff dùng `storage.session` khi có, rơi về `storage.local` kèm TTL 6 giờ trên Firefox MV2.

Trang xem/sửa là một site app ẩn: [`features/site/clip-viewer/`](../../src/features/site/clip-viewer/).

## 4. Kiểm thử thủ công

Chạy thử trên ít nhất 5 kiểu trang, kiểm tra Markdown giữ được heading / list / code block / bảng và bỏ được nav, quảng cáo, footer:

1. Bài blog thường
2. Tài liệu kỹ thuật có nhiều code block
3. Wikipedia (có footnote)
4. Trang tin tức (nhiều quảng cáo)
5. SPA render phía client, ví dụ một GitHub issue

Và: mở `chrome://extensions` → popup phải hiện "Không chạy được trên trang này", không văng lỗi.

# PDF → Văn bản — đã xây

Kéo-thả PDF, trích văn bản từ text layer, xem/copy theo trang, xuất `.txt`/`.md`, OCR tay cho bản scan.

Thiết kế gốc: [docs/roadmap/01-pdf-to-text.md](../roadmap/01-pdf-to-text.md). File này chỉ ghi những quyết định lúc xây mà đọc code không thấy ngay — chủ yếu là chuyện tự host asset.

## 1. Asset tự host: cái gì, bao nhiêu, vì sao

Nguyên tắc chung "không gọi CDN lúc chạy" ([roadmap §2.7](../roadmap/00-tong-quan.md)) tốn thật, nên ghi rõ con số:

| Asset | Vị trí | Dung lượng | Ghi chú |
|---|---|---|---|
| `pdf.worker.min.mjs` | Vite bundle (`new URL(..., import.meta.url)`) | ~1.3 MB | Không cần copy tay: Vite đóng gói thành asset nội bộ, WXT phát ra `assets/pdf.worker.min-*.mjs` |
| tesseract worker | `public/tesseract-assets/worker.min.js` | ~50 KB | |
| tesseract core (WASM) | `public/tesseract-assets/core/` | ~24 MB | 3 biến thể LSTM (`lstm`, `simd-lstm`, `relaxedsimd-lstm`) |
| traineddata `eng` + `vie` | `public/tesseract-assets/lang/` | ~4.4 MB | bản `4.0.0_best_int`, tải từ `@tesseract.js-data` lúc phát triển |

**Vì sao vẫn giữ ba biến thể WASM chứ không một.** `getCore.js` của tesseract.js tự dò `simd()`/`relaxedSimd()` lúc chạy rồi chọn file tương ứng; ép một biến thể thì máy không hỗ trợ SIMD sẽ hỏng. Ba biến thể **không-LSTM** thì đã bỏ (tesseract.js 5+ không còn dùng engine legacy) — đúng một nửa số file, 48 MB xuống 24 MB.

**Mặc định của thư viện là CDN, và nó im lặng.** Đọc thẳng `node_modules/tesseract.js/src/worker-script/browser/getCore.js`: nếu không truyền `corePath` thì nó dựng URL jsdelivr. Tương tự `langPath` mặc định trỏ `cdn.jsdelivr.net/npm/@tesseract.js-data/...`. Cả hai **phải** được truyền tường minh, không có cảnh báo nào nếu quên.

**`workerBlobURL: false` quan trọng ngang các đường dẫn.** Mặc định (`true`) tesseract.js fetch `workerPath` rồi chạy lại nó từ một `blob:` URL. CSP của extension (`script-src 'self' 'wasm-unsafe-eval'`) **không liệt kê `blob:`**, nên worker sẽ bị chặn. Đặt `false` khiến nó `new Worker(workerPath)` thẳng — một URL `chrome-extension://` mà CSP đã cho phép sẵn.

**Toàn bộ 24 MB nằm trong gói cài, nhưng chỉ tải vào bộ nhớ khi bật OCR.** `public/` luôn được đóng gói; cái tránh được là *fetch + parse*, không phải dung lượng gói. Ai không bao giờ đụng OCR thì không trả giá về hiệu năng, chỉ về dung lượng tải extension một lần.

## 2. Vì sao `PageStatus` có nhánh `"empty"` riêng

`page.getTextContent()` **không ném lỗi** với trang không có text layer — nó trả `items: []` một cách hợp lệ. Nếu chỉ nối chuỗi rồi hiển thị thì người dùng thấy khung trống và không phân biệt được "trang này vốn trống" với "công cụ hỏng". Nên `extractPage()` luôn trả `PageStatus`, không bao giờ trả `string` trần.

Ngưỡng: dưới **10 ký tự thực** (sau khi bỏ khoảng trắng) mới tính là `"empty"`, chứ không phải `=== 0` — trang bìa chỉ có số trang in ở góc không đáng bị gắn cờ "nghi là scan".

## 3. Dựng lại xuống dòng từ toạ độ

pdf.js trả từng `item` kèm ma trận `transform`, không phải một chuỗi liền mạch; nối thẳng `items.map(i => i.str).join("")` cho ra chữ dính liền ở nhiều PDF (InDesign, LaTeX). Hai tín hiệu quyết định ngắt dòng:

1. cờ `hasEOL` của chính pdf.js, và
2. chênh lệch toạ độ Y giữa hai item liên tiếp vượt **nửa chiều cao font của chính item đó**.

Dùng chiều cao item làm ngưỡng thay vì một hằng số pixel cố định, để không sai ở cỡ chữ/zoom khác.

## 4. Chưa làm

- Ngôn ngữ OCR ngoài `eng`/`vie` (thêm = tải thêm traineddata vào `public/tesseract-assets/lang/`).
- Xuất kèm toạ độ để highlight ngược lên ảnh trang (roadmap giai đoạn 4).

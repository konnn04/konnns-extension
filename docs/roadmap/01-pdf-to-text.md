# Tool #1 — PDF → Văn bản

Site app kéo-thả PDF, trích văn bản từ text layer có sẵn, xem/copy theo trang hoặc toàn bộ, xuất `.txt`/`.md`. OCR (tesseract.js) chỉ chạy khi bật tay, cho trang không có text layer (bản scan).

Thư viện: **pdfjs-dist** (bắt buộc), **tesseract.js** (tuỳ chọn, tải lười).

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool) trước khi đọc file này.

## 1. Mô hình dữ liệu cốt lõi

Không cần lưu trữ dài hạn (không có yêu cầu "mở lại phiên làm việc cũ" trong đề bài) — state sống trong session, giống Audio Editor lúc chưa bấm Lưu. Nếu sau này cần lưu thì áp splitting pattern ở §2.4 của file tổng quan (metadata nhẹ / blob PDF nặng tách bảng).

```ts
interface PdfDocument {
  fileName: string;
  byteLength: number;
  pageCount: number;
  /** từ pdf.js Document.fingerprints — để phát hiện "đã mở file này rồi" khi kéo lại */
  fingerprint: string;
}

type PageStatus =
  | { kind: "pending" }                         // chưa trích
  | { kind: "text"; text: string; charCount: number }
  | { kind: "empty" }                            // trích xong nhưng không có ký tự nào — nghi là scan
  | { kind: "ocr-pending" }                       // đang chạy OCR
  | { kind: "ocr-done"; text: string; confidence: number }
  | { kind: "error"; message: string };

interface PdfWorkspace {
  doc: PdfDocument | null;
  pages: Map<number, PageStatus>;   // 1-based, khớp số trang pdf.js dùng
  activePage: number;
  /** true nếu >90% trang rơi vào "empty" sau khi trích hết — bật banner cảnh báo scan */
  looksLikeScan: boolean;
  ocrEnabled: boolean;              // công tắc tay, mặc định false
  ocrLanguage: "eng" | "vie";
  busy: boolean;
  error: string | null;
}
```

**Vì sao có trạng thái `"empty"` tách riêng khỏi lỗi.** Đây là điểm cốt lõi của yêu cầu "báo lỗi rõ ràng thay vì trả rỗng im lặng". `page.getTextContent()` của pdf.js **không throw** khi trang không có text layer — nó trả về `items: []` một cách hợp lệ, vì với pdf.js đó không phải lỗi, đó là sự thật về file. Nếu code chỉ nối `items.map(i => i.str).join("")` rồi hiển thị, người dùng nhận một khung text trống và **không có cách nào phân biệt "trang này thật sự trống" với "công cụ trích hỏng"**. Nên `extractPage()` luôn trả về `PageStatus`, không bao giờ trả `string` trần, và `"empty"` là một nhánh dữ liệu tường minh — không phải suy luận ở tầng UI từ `text.length === 0`.

## 2. Luồng tương tác chính

Không có canvas/timeline thao tác trực tiếp — đây là tool đọc/duyệt văn bản, không phải tool dựng hình. "Mouse-first" ở đây nghĩa là: mọi việc làm được bằng chuột, phím tắt là lối tắt, đúng tinh thần Audio Editor nhưng áp dụng cho một UI đọc-và-chọn thay vì vẽ-và-kéo.

1. **Kéo-thả PDF** vào vùng dropzone toàn màn hình (giống trạng thái trống của Audio Editor) → `pdfjs.getDocument()` đọc header, hiện `pageCount` ngay (không đợi trích hết) → bắt đầu trích **trang đang xem trước**, các trang còn lại trích nền theo thứ tự tăng dần (không chặn UI — xem §5 chunk theo trang).
2. **Danh sách trang bên trái** (giống track list của Audio Editor, nhưng nhẹ hơn nhiều): mỗi hàng có số trang, icon trạng thái (đồng hồ cát / dấu tick / dấu chấm than / icon mắt-gạch cho "empty"), số ký tự trích được. Click một hàng → cuộn viewer bên phải tới trang đó và đánh dấu active.
3. **Panel văn bản bên phải**: hiển thị text đã trích của trang active, dạng plain text có thể **bôi đen bằng chuột như text thường** (không phải canvas vẽ chữ — dùng `<pre>`/`<textarea readOnly>` thật để trình duyệt tự lo việc chọn/copy, không tự viết text selection).
4. **Nút "Copy trang này"** nổi góc trên panel văn bản — copy toàn bộ text của trang active vào clipboard, không cần bôi đen tay.
5. **Nút "Copy toàn bộ"** ở toolbar — nối text mọi trang (theo thứ tự, cách nhau `\n\n---\n\n` khi xuất dạng có phân trang) vào clipboard.
6. **Gặp trang `"empty"`**: banner cảnh báo xuất hiện ngay tại panel văn bản (không phải toast thoáng qua rồi mất) — *"Trang này không có lớp văn bản, có thể là bản scan."* kèm nút **"Bật OCR cho trang này"**. Nếu `looksLikeScan` đúng (phần lớn trang đều empty) thì banner nâng cấp lên toàn tài liệu, đặt ở đầu danh sách trang: *"Tài liệu này giống bản scan. OCR sẽ chậm hơn nhiều lần trích text thường."* + nút **"Bật OCR cho cả tài liệu"** — cố tình yêu cầu một cú bấm tường minh, không tự động chạy, đúng yêu cầu đề bài.
7. **Bấm "Bật OCR"** → chạy `tesseract.js` cho (các) trang đó, dùng activity channel chung để báo tiến trình theo từng trang (`i/total`) — OCR một trang A4 dày chữ tốn 3-8 giây, phải có phản hồi trong lúc chạy, không được để đứng hình.
8. **Xuất file**: nút "Xuất" mở dropdown nhỏ (không phải modal đầy màn hình, việc này quá nhẹ để cần modal) — chọn `.txt` (nối thuần) hay `.md` (mỗi trang thành `## Trang N`), chọn "trang hiện tại" hay "toàn bộ", tải xuống ngay bằng `URL.createObjectURL` + `<a download>`.
9. **Kéo-thả file PDF thứ hai** trong khi đang xem file cũ → hỏi xác nhận thay thế (mất tiến độ trích/OCR hiện tại) — không âm thầm ghi đè.

## 3. Component UI

| Component | Vai trò |
|---|---|
| `PdfToText.tsx` | Site app root — quản `PdfWorkspace`, route theo `dropzone` / `workspace` |
| `PdfDropzone.tsx` | Trạng thái trống: kéo-thả + nút chọn file, tái dùng đúng layout dropzone của Audio Editor |
| `PageList.tsx` | Danh sách trang bên trái — icon trạng thái theo `PageStatus.kind`, click để nhảy trang |
| `PageViewer.tsx` | Panel văn bản bên phải: hiển thị `PageStatus` của trang active, banner cảnh báo scan, nút Copy trang |
| `ScanWarningBanner.tsx` | Banner cảnh báo toàn tài liệu khi `looksLikeScan`, nút bật OCR hàng loạt — tách riêng vì xuất hiện ở hai chỗ (đầu danh sách trang + panel văn bản của từng trang empty) |
| `OcrSettings.tsx` | Chọn ngôn ngữ OCR (eng/vie), hiển thị cảnh báo dung lượng tải lần đầu (~15MB cho gói ngôn ngữ) |
| `ExportMenu.tsx` | Dropdown chọn định dạng + phạm vi xuất |
| `ActivityBanner` | Tái dùng nguyên bản từ Audio Editor (đã nâng cấp lên `core/activity` theo §2.8 file tổng quan) cho cả trích-hàng-loạt lẫn OCR |

## 4. Undo/redo

**Không cần.** Đây là tool đọc — thao tác duy nhất sinh ra kết quả (chạy OCR) không phải là "sửa" dữ liệu của người dùng, nó chỉ *thêm* một `PageStatus` mới cho một trang, và trạng thái trước đó (`"empty"`) không mang thông tin gì đáng giữ lại để "hoàn tác về". Không có thao tác nào ở đây mà người dùng cần đảo ngược theo nghĩa Ctrl+Z — khác hẳn Audio Editor, nơi mọi cú kéo/cắt đều là biên tập có thể sai và cần sửa lại.

Việc duy nhất gần giống "undo" là đổi file đang xem (mục 9 ở §2) — xử lý bằng hộp xác nhận, không phải lịch sử.

## 5. Rủi ro kỹ thuật cụ thể

**Worker của pdf.js phải tự host, không CDN.** `pdfjs-dist` cần một Worker script riêng (`pdf.worker.min.mjs`) chạy song song để giải mã — mặc định nhiều hướng dẫn trỏ `GlobalWorkerOptions.workerSrc` tới một CDN (unpkg/cdnjs). CSP hiện tại (`script-src 'self' ...`) sẽ chặn worker tải từ ngoài. Cách né: import worker qua Vite (`new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`) để WXT đóng gói nó thành asset nội bộ, gán `workerSrc` bằng `browser.runtime.getURL(...)` của chính asset đó.

**Worker kiểu module có thể cần kiểm tra thêm ở Firefox MV2.** Bản `pdfjs-dist` hiện tại dùng ESM worker (`type: "module"`) theo mặc định. Chrome MV3 hỗ trợ tốt; Firefox build của dự án là MV2 (đã nêu ở `docs/architecture.md §7.3`) — cần kiểm tra thật (không đoán) lúc code liệu Worker module có chạy đúng trong ngữ cảnh extension MV2 của Firefox hay phải rơi về worker kiểu classic (`{ type: "classic" }`, bundle riêng của pdf.js cho legacy).

**PDF có mật khẩu.** `getDocument()` ném `PasswordException` khi file yêu cầu mật khẩu mở hoặc mật khẩu quyền. Cần một luồng riêng: bắt exception này cụ thể (không gộp vào nhánh lỗi chung), hiện ô nhập mật khẩu, gọi lại `getDocument({ password })`. Bỏ sót ca này thì người dùng chỉ thấy "Không đọc được file" mơ hồ — đúng thứ đề bài yêu cầu tránh.

**`getTextContent()` không giữ khoảng trắng/xuống dòng đáng tin cậy.** pdf.js trả về từng `item` kèm toạ độ (`transform`), không phải một chuỗi liền mạch — nối thẳng `items.map(i => i.str).join("")` cho ra văn bản dính liền không dấu cách ở nhiều PDF (đặc biệt PDF xuất từ InDesign/LaTeX). Cần suy ra ranh giới dòng/đoạn từ chênh lệch toạ độ Y giữa các item liên tiếp (heuristic đơn giản: Y đổi quá một ngưỡng → xuống dòng) trước khi hiển thị — không phải lỗi cần né mà là việc phải làm, nêu ở đây vì dễ bị bỏ sót khi triển khai theo hướng dẫn "đọc nhanh" trên mạng.

**Tesseract.js kéo theo WASM + gói ngôn ngữ nặng, phải tự host và tải lười.** Mặc định tesseract.js tải `tesseract-core.wasm`, `worker.min.js`, và `<lang>.traineddata.gz` (bản `eng` nén ~10-15MB) từ CDN jsdelivr qua `langPath`/`corePath`. Ba việc: (1) tự host cả ba loại asset trong bundle extension, trỏ `langPath`/`corePath`/`workerPath` về `browser.runtime.getURL(...)`, giữ đúng nguyên tắc "không CDN ngoài" đã đặt ra cho toàn bộ 8 tool; (2) **không** đóng gói traineddata vào bundle chính — nó chỉ cần khi user bật OCR, nên fetch lười file đó (vẫn là asset của extension, chỉ là tải muộn) thay vì làm phình gói cài đặt cho người không bao giờ đụng tới OCR; (3) tesseract.js chạy trong Worker riêng của nó — không đụng main thread, nên không cần đi qua activity channel để tránh treo trang, chỉ cần để báo tiến trình (`logger` callback của tesseract.js đã có sẵn số `progress` theo trang).

**Ngưỡng phát hiện "trang trống thật" vs "trang gần như trống".** Một trang chỉ có số trang in ở góc (2-3 ký tự) không phải là scan, nhưng cũng gần như trống. Heuristic ở §1 (đếm ký tự) cần một ngưỡng tối thiểu hợp lý (ví dụ < 10 ký tự thực sau khi trim khoảng trắng) chứ không phải `=== 0` tuyệt đối, để không báo nhầm những trang bìa/trang trắng có chủ đích thành "nghi vấn scan".

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | Kéo-thả, trích text-layer, danh sách trang, xem/copy từng trang | Cao/Thấp — đây là toàn bộ giá trị cốt lõi đề bài yêu cầu, làm được trong thời gian ngắn vì pdf.js lo phần khó |
| 2 | Phát hiện trang trống + banner cảnh báo, xuất `.txt`/`.md` | Cao/Thấp — nhỏ nhưng chính là điểm khác biệt "không trả rỗng im lặng" so với một bản demo pdf.js thông thường |
| 3 | OCR tay (tesseract.js), tự host asset, tải lười gói ngôn ngữ | Trung bình/Trung bình — giá trị thật (mở khoá được PDF scan) nhưng công sức cũng thật (worker riêng, asset nặng) |
| 4 (tuỳ chọn) | Thêm ngôn ngữ OCR khác ngoài eng/vie, xuất kèm toạ độ (dùng cho highlight lại đúng vị trí trên ảnh trang) | Thấp/Trung bình — hoãn tới khi có nhu cầu cụ thể |

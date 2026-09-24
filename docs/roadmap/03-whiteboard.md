# Tool #3 — Whiteboard

Site app vẽ phong cách hand-drawn, nhiều board riêng biệt (không chỉ một canvas), xuất PNG/SVG. Font Virgil tự host offline.

Thư viện: **@excalidraw/excalidraw**.

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool).

## 1. Mô hình dữ liệu cốt lõi

Excalidraw tự quản lý toàn bộ state vẽ nội bộ (elements, appState, files) — việc của tool này là **bọc** nó, không phải xây lại. Ba mảnh Excalidraw đưa ra qua `excalidrawAPI`:

```ts
// Không tự định nghĩa lại — đây là type của chính thư viện, ghi ra để thấy hình dạng
type ExcalidrawElement = { id: string; type: string; x: number; y: number; /* … */ };
type AppState = { viewBackgroundColor: string; zoom: { value: number }; /* … */ };
type BinaryFiles = Record<string, { dataURL: string; mimeType: string; /* … */ }>;
```

Việc của tool: đóng gói ba mảnh đó thành **một board**, và quản lý **danh sách nhiều board**:

```ts
interface BoardSummary {
  id: string;
  name: string;
  thumbnail: string;     // PNG nhỏ (data URL), sinh từ exportToBlob sau debounce
  updatedAt: number;
  elementCount: number;  // hiện trên card, gợi ý board nào "nặng"
}

interface BoardRecord extends BoardSummary {
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;   // chỉ lưu phần liên quan bố cục (không lưu con trỏ/toạ độ chuột nhất thời)
  /** khoá theo fileId Excalidraw dùng nội bộ — ảnh dán vào board */
  fileIds: string[];
}

interface WhiteboardState {
  boards: BoardSummary[];        // danh sách nhẹ, hiện ở màn hình chọn board
  activeBoardId: string | null;
  saving: boolean;
}
```

**Tách `BoardSummary` (nhẹ) khỏi `BoardRecord` (nặng) trong bộ nhớ UI, và tách bảng thật trong Dexie theo đúng pattern §2.4 của file tổng quan** — `boards` (metadata + `elements`/`appState`, JSON vừa phải) và `boardFiles` (ảnh dán vào, base64, có thể vài MB mỗi ảnh). Lý do giống hệt Audio Editor: màn hình chọn board phải load nhanh mà không kéo theo mọi ảnh của mọi board; mở một board thì mới load `boardFiles` của đúng board đó.

## 2. Luồng tương tác chính

Toàn bộ thao tác vẽ (chọn công cụ, vẽ hình, kéo, resize, xoay, đổi màu, nhóm/tách nhóm, phím tắt 1-9 chọn công cụ…) là **của chính Excalidraw** — nó đã là một trình vẽ mouse-first hoàn chỉnh, không việc gì thiết kế lại. Phần tool này thật sự sở hữu là lớp **quản lý nhiều board** bọc quanh nó:

1. **Màn hình chọn board** (route riêng, ví dụ `/whiteboard`): lưới thẻ giống `home__grid` của trang chủ Custom Site — mỗi thẻ là một board với thumbnail, tên, ngày sửa cuối. Click vào thẻ mở board đó (route `/whiteboard/<id>`). Nút "+" tạo board trống mới.
2. **Trong một board** (route `/whiteboard/<id>`): Excalidraw chiếm toàn bộ khung `fullBleed`, thanh công cụ của chính nó nổi phía trên như bản gốc. Thêm đúng một thanh nhỏ của riêng tool này ở góc trên: tên board (sửa tay tại chỗ, giống `ProjectTitle` của Audio Editor), nút "Về danh sách board", nút Xuất.
3. **Đổi tên board**: click vào tên → thành ô nhập, Enter/click ra ngoài để lưu — tái dùng đúng mẫu `ProjectTitle` của Audio Editor (component dùng chung, không viết lại).
4. **Xuất PNG/SVG**: nút Xuất mở dropdown nhỏ chọn định dạng, gọi thẳng `exportToBlob`/`exportToSvg` của Excalidraw (thư viện tự lo phần khó: tính khung bao toàn bộ nét vẽ, render đúng nền/trong suốt) → tải xuống. Không tự viết logic export.
5. **Xoá board**: từ màn hình danh sách (không xoá được từ trong board đang mở, tránh bấm nhầm mất việc đang làm) — nút thùng rác trên thẻ, hỏi xác nhận, xoá cả `boards` lẫn `boardFiles` liên quan.
6. **Nhân bản board** ("Duplicate"): copy toàn bộ `elements`/`appState`/`fileIds` sang một `id` mới — hữu ích khi muốn giữ một bản mẫu rồi vẽ biến thể.

## 3. Component UI

| Component | Vai trò |
|---|---|
| `Whiteboard.tsx` | Site app root — route con `/whiteboard` (danh sách) và `/whiteboard/:id` (một board) |
| `BoardGrid.tsx` | Lưới thẻ board, thumbnail, nút tạo mới/xoá/nhân bản |
| `BoardCanvas.tsx` | Bọc `<Excalidraw>`, giữ `excalidrawAPI` ref, lắng nghe `onChange` (debounce lưu) |
| `BoardToolbar.tsx` | Thanh nhỏ của riêng tool: tên board sửa tay, nút quay lại, nút Xuất |
| `ExportMenu.tsx` | Chọn PNG (nền trong suốt hay có nền) / SVG |
| `ThumbnailWorker` (không phải component — một hàm) | Sinh thumbnail PNG nhỏ sau debounce, dùng `exportToBlob({ maxWidthOrHeight: 320 })` |

## 4. Undo/redo

**Dùng lịch sử built-in của Excalidraw — không xây lớp undo riêng, và không hook vào lịch sử nội bộ của nó.** Excalidraw tự quản Ctrl+Z/Ctrl+Y (và bản thân nó phân biệt "undo cục bộ" vs "undo khi cộng tác nhiều người" — chi tiết nội bộ tool này không cần biết, không có API public để đọc/serialize lịch sử đó ra ngoài).

Vì sao đây là quyết định đúng, không phải bỏ qua: khác với Markdown (§4 của tool #2, chuỗi ký tự tuyến tính) hay Audio Editor (cây track/clip cần snapshot tự viết), Whiteboard có một tập phần tử đồ hoạ với quan hệ không gian phức tạp (nhóm, ràng buộc mũi tên nối vào hình, thứ tự chồng lớp) — đúng loại dữ liệu mà chính thư viện vẽ đã giải quyết kỹ hơn bất kỳ lớp undo tự viết nào có thể làm trong thời gian hợp lý. Việc của tool chỉ là **lưu điểm dừng** (debounce sau khi `onChange` ngừng bắn ~1s, đúng nhịp autosave Audio Editor) chứ không phải theo dõi từng bước sửa.

**Một điều cần lưu ý khi lưu:** `onChange` của Excalidraw bắn liên tục trong lúc kéo/vẽ (mỗi khung hình), giống `dragVolume` của track fader ở Audio Editor — **không** ghi Dexie mỗi lần gọi, debounce đúng cách (viết vào biến tạm ngay, chỉ `commit` xuống DB sau khi ngừng thao tác một khoảng ngắn).

## 5. Rủi ro kỹ thuật cụ thể

**Font Virgil và bộ icon phải tự host, đúng yêu cầu đề bài — không phải tuỳ chọn.** `@excalidraw/excalidraw` mặc định tải một số asset (font `Virgil`/`Cascadia Code`/`Excalifont`, sprite icon) theo đường dẫn tương đối tới gói của chính nó lúc build, và ở một số cấu hình publish sẽ trỏ ra CDN unpkg nếu không cấu hình lại. Thư viện có biến toàn cục `window.EXCALIDRAW_ASSET_PATH` phải gán **trước khi import component** để trỏ về một thư mục asset tự host — cần copy thư mục assets của gói (`node_modules/@excalidraw/excalidraw/dist/excalidraw-assets/…`, gồm `.woff2` + `locales/`) vào output của extension lúc build (thêm bước copy trong cấu hình build của WXT/Vite, tương tự cách `wxt.config.ts` đã xử lý CSP cho WASM của mediabunny). Bỏ sót bước này thì chữ trong board hiển thị bằng font hệ thống thay vì nét tay đặc trưng của Excalidraw — lỗi âm thầm, không có thông báo, chỉ phát hiện bằng mắt.

**Bundle nặng.** Excalidraw + phụ thuộc của nó (bao gồm bản `roughjs` để vẽ nét tay, `perfect-freehand`) nằm trong khoảng trên dưới 1MB đã nén — đúng lý do `component: lazy()` là bắt buộc chứ không phải tối ưu tuỳ chọn (§2.2 file tổng quan), để người chưa từng mở Whiteboard không tải phần này.

**Yêu cầu `react`/`react-dom` làm peer dependency, phải khớp bản React 18 đã có trong dự án.** Excalidraw tự quản lý React nội bộ nhưng vẫn cần đúng một bản `react`/`react-dom` duy nhất trong toàn bộ ứng dụng (không phải hai bản trùng lặp) để tránh lỗi "Invalid hook call" kinh điển khi có hai instance React cùng lúc — dự án đã dùng React 18 xuyên suốt nên rủi ro thấp, nhưng là điều cần xác nhận đúng version compatibility lúc thêm dependency, không giả định.

**Đồng bộ theme thủ công.** Excalidraw nhận `theme="light"|"dark"` qua prop, **không** tự đọc `data-theme` mà theme engine của dự án gắn lên `<html>` — `BoardCanvas.tsx` phải đọc theme hiện tại (từ `core/theme-engine`) và truyền prop tương ứng, tự re-render khi user đổi theme ở New Tab trong lúc board đang mở (site app đã ăn theo theme của New Tab đúng như mô tả ở `docs/site/00-tong-quan.md §1`, nhưng riêng Excalidraw cần dòng code nối tay này vì nó không nghe CSS variable).

**Dữ liệu ảnh dán vào (`BinaryFiles`) phình nhanh nếu không dọn.** Giống `sweepOrphanSources` của Audio Editor: xoá một hình khỏi board (`elements`) không tự xoá `fileIds`/`boardFiles` tương ứng trong Excalidraw's `files` map — cần một bước quét tương tự (elements nào còn tham chiếu `fileId` thì file đó còn sống, board đóng lại mới quét) trước khi lưu, nếu không dung lượng Dexie tăng dần vô hạn qua các lần dán-rồi-xoá ảnh.

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | Một board duy nhất (chưa có danh sách nhiều board), tự host font/asset, lưu/mở qua Dexie | Cao/Thấp — thư viện lo gần hết, việc chính là tích hợp đúng và né CDN |
| 2 | Nhiều board (danh sách, thumbnail, tạo/xoá/nhân bản), đồng bộ theme | Cao/Trung bình — đúng yêu cầu "không chỉ một canvas" của đề bài |
| 3 | Xuất PNG/SVG, dọn `boardFiles` mồ côi | Trung bình/Thấp |
| 4 (tuỳ chọn) | Cộng tác thời gian thực (Excalidraw có API cho việc này) | Thấp/Cao — hoãn xa, cần server riêng, ngoài phạm vi "extension cá nhân" hiện tại |

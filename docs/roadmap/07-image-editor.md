# Tool #7 — Image Editor

"Photoshop thu nhỏ" — copy/paste (kể cả ảnh từ clipboard hệ thống), scale, layer, vẽ tự do, phím tắt kiểu Photoshop (V/R/O/L/T/B/C). Dùng chính cho freelance TestIO: chụp bug, khoanh vùng, chú thích, xuất ảnh.

Thư viện: **fabric** (v6, bản hiện tại trên npm — API `Canvas`/`FabricObject` viết lại theo ESM so với v5, không phải cùng cú pháp).

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool).

**Cân chỉnh phạm vi trước khi thiết kế bất cứ gì khác.** "Photoshop thu nhỏ" là khung tham chiếu dễ hiểu, nhưng ca dùng thật đã nêu rõ: chụp bug, khoanh vùng, chú thích, xuất ảnh — đây là **công cụ đánh dấu ảnh chụp màn hình**, không phải trình chỉnh sửa ảnh raster đa lớp tổng quát. Thiết kế dưới đây nhắm đúng ca đó (đủ Photoshop để quen tay, không cố đuổi theo mọi công cụ Photoshop có) — xem roadmap §6 để thấy ranh giới rõ giữa "MVP đáng làm" và "mở rộng chỉ khi có nhu cầu cụ thể".

## 1. Mô hình dữ liệu cốt lõi

```ts
interface LayerEntry {
  id: string;
  /** trỏ vào chính object Fabric qua canvas.getObjects(), không nhân đôi dữ liệu hình học */
  fabricObjectId: string;
  name: string;               // "Rectangle 1", sửa tay được
  kind: "image" | "rect" | "ellipse" | "line" | "text" | "path" | "blur";
  visible: boolean;
  locked: boolean;             // khoá không cho chọn/kéo nhầm — phổ biến khi đã chốt một layer
}

interface ImageDocument {
  id: string;
  name: string;
  canvasSize: { width: number; height: number };   // lấy từ ảnh đầu tiên dán/mở vào
  /** Fabric tự lo phần hình học — đây là kết quả canvas.toJSON({propertiesToInclude:["layerId"]}) */
  fabricJson: object;
  layers: LayerEntry[];        // thứ tự mảng = thứ tự chồng lớp, đồng bộ với z-index thật của Fabric
  updatedAt: number;
}
```

**Đây là "layer theo object", không phải "layer raster" kiểu Photoshop thật.** Fabric không có khái niệm layer sẵn có — mỗi mục trong bảng layer ở đây là **một object vẽ vector/ảnh** (hình chữ nhật, text, một ảnh đã dán, hoặc một nhóm object được gộp), không phải một tấm canvas pixel riêng có thể vẽ cọ tự do lên bất kỳ đâu rồi xoá đi như layer Photoshop thật. Với ca dùng "khoanh vùng lỗi + chú thích", đây là đúng mức độ cần — Photoshop thật cần raster layer để vẽ/tẩy tự do trên nhiều lớp độc lập, thứ nằm ngoài phạm vi đã cân chỉnh ở trên.

**Không có khái niệm "ảnh nền" đặc quyền.** Mọi thứ dán vào (ảnh chụp màn hình, ảnh dán thêm sau) đều là một object bình thường trong danh sách layer — kích thước canvas mặc định lấy theo ảnh **đầu tiên** được dán/mở, nhưng ảnh đó không có vai trò gì khác biệt object sau nó. Tránh phải định nghĩa một mô hình dữ liệu "base vs annotation" riêng chỉ để phục vụ một trường hợp không ai yêu cầu (chỉnh sửa nhiều ảnh cùng lúc trong một canvas) — một tài liệu = một canvas, muốn sửa ảnh khác thì mở tài liệu khác (danh sách nhiều tài liệu, giống `ProjectManager` của Audio Editor).

## 2. Luồng tương tác chính

Toàn bộ thao tác đặt/chọn/kéo/resize/xoay object là của chính Fabric — không viết lại. Phần tool thật sự sở hữu là: ánh xạ phím tắt sang công cụ, panel layer, và crop (Fabric không có crop tool sẵn).

**Bảng phím tắt — ánh xạ có chủ đích, không sao y Photoshop nguyên bản** (Photoshop dùng R cho xoay khung nhìn, O cho Dodge/Burn — không có ý nghĩa gì với một công cụ đánh dấu ảnh; đổi sang nghĩa hữu dụng hơn cho đúng ca dùng, giữ nguyên chữ cái để tay đã quen Photoshop không phải học lại vị trí phím):

| Phím | Công cụ | Ghi chú |
|---|---|---|
| `V` | Chọn/di chuyển | Giống Photoshop nguyên bản |
| `R` | Hình chữ nhật | Khoanh vùng lỗi dạng khung |
| `O` | Hình elip | Khoanh vùng lỗi dạng tròn |
| `L` | Đường thẳng/mũi tên | Chỉ vào một chi tiết cụ thể trên ảnh |
| `T` | Chữ | Giống Photoshop nguyên bản |
| `B` | Cọ vẽ tự do | Giống Photoshop nguyên bản |
| `C` | Cắt khung (crop) | Giống Photoshop nguyên bản, Fabric không có sẵn — xem §5 |
| *(ngoài đề bài, thêm vì ca dùng thật)* | Làm mờ/che (redact) | Ảnh chụp bug hay dính thông tin nhạy cảm (token, email) — công cụ kéo một vùng rồi làm mờ mạnh (pixelate hoặc Gaussian blur) khu vực đó, xuất ảnh không phục hồi lại được nội dung gốc |

1. **Dán ảnh từ clipboard hệ thống bằng Ctrl+V** — lắng nghe sự kiện `paste` gốc của trình duyệt (`document.addEventListener("paste", ...)`, đọc `event.clipboardData.items`), **không** cần quyền đặc biệt, hoạt động ngay khi trang có focus — đây là đường chính.
2. **Nút "Dán" trên toolbar** (cho ai bấm chuột thay vì Ctrl+V) — phải dùng `navigator.clipboard.read()` bất đồng bộ vì không có sự kiện `paste` để bắt; cần quyền `clipboardRead` khai trong manifest để không hiện hộp thoại xin quyền mỗi lần (xem §5).
3. **Chọn công cụ** bằng phím tắt hoặc click vào toolbar dọc bên trái (giống thanh công cụ Photoshop thu nhỏ) → con trỏ đổi hình, kéo trên canvas để vẽ object tương ứng.
4. **Chọn object có sẵn** (tool `V`): click chọn một, giữ Shift click để chọn nhiều (Fabric hỗ trợ sẵn `ActiveSelection`) → kéo để di chuyển, kéo góc để resize, kéo tay cầm xoay ở trên object để xoay — mọi thao tác này là của Fabric.
5. **Panel layer bên phải**: danh sách `LayerEntry` theo thứ tự chồng lớp (trên cùng = vẽ đè lên cùng), kéo-thả một hàng để đổi thứ tự (gọi `canvas.moveTo(object, newIndex)` khi thả), click icon con mắt để ẩn/hiện, icon khoá để khoá/mở khoá, double-click tên để đổi tên tại chỗ.
6. **Crop** (`C`): kéo một khung crop chồng lên canvas (component riêng, không phải object Fabric thường) → nút "Áp dụng" thay đổi `canvasSize` và dịch toạ độ mọi object cho khớp khung mới, nút "Huỷ" bỏ khung crop mà không đổi gì.
7. **Xuất ảnh**: nút Xuất chọn PNG (có/không nền trong suốt) hoặc JPEG (chất lượng %) — `canvas.toDataURL()`/`exportToBlob`-style của Fabric, tự lo phần khó.

## 3. Component UI

| Component | Vai trò |
|---|---|
| `ImageEditor.tsx` | Site app root — danh sách tài liệu / một tài liệu đang mở |
| `DocList.tsx` | Màn hình chọn tài liệu, giống `BoardGrid` của Whiteboard |
| `EditorCanvas.tsx` | Bọc `fabric.Canvas`, lắng nghe `object:added`/`object:modified`/`object:removed` để snapshot (§4) |
| `ToolPalette.tsx` | Thanh dọc các công cụ + ánh xạ phím tắt ở bảng §2 |
| `LayerPanel.tsx` | Danh sách `LayerEntry`, kéo-thả đổi thứ tự, ẩn/khoá/đổi tên |
| `CropOverlay.tsx` | Khung crop tạm thời, không phải object Fabric — vẽ trên một lớp canvas phủ lên trên |
| `RedactTool.tsx` | Công cụ làm mờ/che — kéo vùng, chọn kiểu (pixelate/blur), áp dụng phá huỷ pixel gốc trong vùng đó |
| `PasteButton.tsx` | Dùng `navigator.clipboard.read()`, chỉ hiện khi đã có quyền `clipboardRead` |
| `ExportMenu.tsx` | Chọn PNG/JPEG + chất lượng |

## 4. Undo/redo

**Snapshot toàn bộ `fabricJson` sau mỗi cử chỉ hoàn tất — không phải command-pattern.**

Fabric **không có** lịch sử undo built-in (khác Excalidraw ở tool #3) — phải tự xây, nhưng bài toán ở đây đơn giản hơn Audio Editor nhiều nên không cần lý do phức tạp: một tài liệu đánh dấu ảnh có tối đa vài chục object (khung, chữ, mũi tên), `canvas.toJSON()` cho một cây JSON nhỏ, gần như miễn phí để lưu nguyên trạng sau mỗi thao tác. Không có "buffer khổng lồ" nào giống `AudioBuffer` khiến snapshot tốn kém — lý do Audio Editor phải tránh snapshot-mỗi-bước hoàn toàn không áp dụng ở đây.

**Gộp theo cử chỉ (coalescing), đúng nguyên tắc đã dùng ở Audio Editor:** Fabric bắn `object:modified` đúng một lần khi thả chuột sau khi kéo/resize/xoay (không bắn liên tục như `onChange` của Excalidraw) — nên snapshot tại đúng sự kiện đó là tự nhiên, không cần debounce thủ công như Whiteboard hay track fader.

**Nhớ khai `propertiesToInclude: ["layerId"]` khi gọi `toJSON()`.** Fabric mặc định chỉ serialize các thuộc tính hình học chuẩn — thuộc tính tuỳ biến (`layerId` dùng để nối object với `LayerEntry`) bị rơi mất khi `loadFromJSON()` nếu không khai rõ, và lỗi này chỉ lộ ra sau khi tải lại trang (layer panel không còn khớp object nào) — không lộ ngay lúc test nhanh trong cùng phiên.

## 5. Rủi ro kỹ thuật cụ thể

**Fabric không có crop tool sẵn — phải tự dựng bằng cắt kích thước canvas, không phải object.** Không có API `canvas.crop()`. Cách làm đúng: vẽ một khung chọn tạm (không phải `fabric.Rect` thường thêm vào canvas, để nó không lẫn vào danh sách layer) chồng lên trên, khi bấm "Áp dụng" thì đổi `canvas.setDimensions()` theo khung mới và **dịch toạ độ `left`/`top` của mọi object hiện có** trừ đi gốc khung crop — bỏ sót bước dịch toạ độ sẽ làm mọi annotation "trôi" khỏi vị trí đúng so với ảnh sau khi crop.

**`navigator.clipboard.read()` (nút Dán bấm chuột) cần quyền `clipboardRead` khai trong manifest để không hiện prompt xin quyền mỗi lần.** Đây là quyền manifest kiểu cũ (legacy Chrome extension permission) vẫn hợp lệ ở MV3, tự cấp quyền đọc clipboard mà không qua Permissions API của web thường — khác với sự kiện `paste` gốc (mục 1, §2) vốn không cần quyền gì cả vì nó đi theo đúng luồng người dùng tự bấm Ctrl+V. Hai đường vào clipboard trong cùng một tool cố tình khác cơ chế — nêu rõ ở đây để không nhầm tưởng cả hai đều cần (hoặc đều không cần) quyền.

**Dán ảnh rất lớn (ảnh chụp màn hình 4K, hay ảnh full-page dài) làm phình `fabricJson` vì ảnh được nhúng dạng base64 trong JSON khi lưu.** Giống rủi ro `BinaryFiles` phình dung lượng đã nêu ở Whiteboard (tool #3) — áp dụng cùng cách né: tách bảng, `imageAssets` (blob nặng) riêng khỏi `fabricJson` (cây nhẹ, chỉ giữ tham chiếu `assetId` thay vì base64 trực tiếp trong JSON của Fabric — cần một bước chuyển đổi thủ công giữa `src: "data:..."` mà Fabric muốn thấy lúc render và `src: "asset://<id>"` mà ta lưu, đổi qua lại lúc load/save).

**Canvas HTML có giới hạn kích thước thật của trình duyệt** (thường quanh 16384px một chiều, tuỳ engine) — ảnh chụp full-page rất dài (site page-to-markdown/screenshot tool có thể tạo ra ảnh cao hàng chục nghìn pixel) dán vào có thể vượt giới hạn này, khiến Fabric render sai hoặc trắng canvas không báo lỗi rõ ràng. Cần kiểm tra kích thước ảnh trước khi thêm vào canvas, báo lỗi tường minh nếu vượt ngưỡng thay vì để canvas âm thầm hỏng.

**Hiệu năng với nhiều object có bộ lọc (filter) nặng.** Bộ lọc làm mờ của Fabric (`fabric.filters.Blur`) tính lại toàn bộ pixel vùng bị lọc mỗi lần re-render nếu không cache — với công cụ Redact (mục thêm ngoài đề bài, §2) cần đảm bảo dùng `object.set('dirty', false)` / cache đúng cách sau khi áp dụng, để kéo-thả các object khác trên canvas không kéo theo tính lại filter mờ mỗi khung hình.

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | Dán ảnh (paste event), vẽ hình chữ nhật/elip/đường thẳng/chữ, di chuyển/resize, xuất PNG | Cao/Trung bình — đây là 80% giá trị thực tế cho ca dùng "khoanh vùng + chú thích + xuất" |
| 2 | Panel layer (ẩn/khoá/đổi thứ tự/đổi tên), undo/redo snapshot, lưu nhiều tài liệu qua Dexie | Cao/Trung bình — biến một canvas dùng-một-lần thành công cụ dùng lại được |
| 3 | Crop, công cụ Redact (làm mờ/che), nút Dán qua Clipboard API + quyền `clipboardRead` | Trung bình/Trung bình — Redact đặc biệt có giá trị cao cho ca dùng freelance (ảnh bug dính thông tin nhạy cảm) dù không nằm trong đề bài gốc |
| 4 (chỉ khi có nhu cầu cụ thể) | Cọ vẽ tự do nâng cao (áp lực nét, nhiều kiểu cọ), bộ lọc màu/độ sáng, nhiều raster layer thật | Thấp/Cao — đây mới là "Photoshop thật", cố tình hoãn vô thời hạn trừ khi ca dùng thực tế đòi hỏi rõ |

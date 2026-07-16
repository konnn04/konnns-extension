# 04 — Sidebar Phải: Tools & Window Manager (Phase 4)

> **Trạng thái: ✅ đã triển khai.**
> - Window Manager: `src/core/layout-engine/windowManager.ts` + `src/app/RightSidebar.tsx` — trigger rail phải auto-sinh từ zone `right-sidebar`; mỗi tool = window floating/docked/minimized/maximized; kéo-thả header + resize góc bằng Pointer Events (không thêm lib); z-index tập trung 1 store (click → lên trên); geometry lưu `windowStates` (Dexie) + khôi phục khi mở tab.
> - Pomodoro: `src/features/tool-pomodoro/` — state chia sẻ UI ↔ background qua `storage.local`, timer chạy bằng `chrome.alarms` (không `setTimeout`), ring progress + emoji theo phase, tự chuyển phiên + thông báo khi hết giờ (qua notification engine / background OS notification). Cấu hình thời lượng trong Settings.
> - Tasks: `src/features/tool-tasks/` — CRUD + kéo-thả sắp xếp (native drag), lưu `tasks`.
> - Notes: `src/features/tool-notes/` — nhiều note dạng tab, rich text `contentEditable` (bold/italic/list), autosave debounce 500ms, lưu `notes`.

## 1. Window Manager — chi tiết hành vi

- Mỗi tool khi mở là 1 "window" độc lập với state:
  ```ts
  type ToolWindowState = {
    id: string;
    mode: "docked" | "floating" | "minimized" | "maximized";
    position: { x: number; y: number }; // chỉ áp dụng khi floating
    size: { width: number; height: number };
    zIndex: number;
  };
  ```
- **Docked**: mặc định, nằm trong khu vực sidebar phải, xếp chồng theo kiểu split giống VSCode/Hyprland (chồng trên-dưới, kéo resize giữa các window).
- **Floating**: kéo ra khỏi vùng dock → trở thành cửa sổ tự do trên toàn màn hình NewTab, kéo thả bằng Pointer Events (hoặc `react-rnd`).
- **Minimize**: thu về icon nhỏ ở thanh trigger phải, click lại để mở lại đúng vị trí/kích thước cũ.
- **Maximize**: chiếm phần lớn vùng nội dung NewTab (không che hẳn 100% để vẫn thấy wallpaper viền ngoài — giữ cảm giác "cửa sổ" chứ không phải full takeover).
- **Z-index stacking**: quản lý tập trung qua `WindowManagerProvider`, click vào window nào → window đó lên trên cùng.
- **Lưu trạng thái**: mỗi tool lưu state cuối cùng (`mode`, `position`, `size`) vào IndexedDB (bảng `window-states`), khôi phục khi mở tab mới.

## 2. Pomodoro Timer

- Cấu hình: thời lượng phiên làm việc, phiên nghỉ ngắn, phiên nghỉ dài, số phiên trước khi nghỉ dài — tất cả chỉnh được trong settings của tool.
- Chạy nền qua `alarms` API (service worker) — **không phụ thuộc tab NewTab đang mở**, để timer vẫn chính xác kể cả khi user chuyển tab khác hoặc đóng tab NewTab.
- Thông báo khi hết phiên: `chrome.notifications` (cross-browser qua polyfill) + âm thanh (file audio ngắn, nhẹ, có thể tắt trong settings).
- **Trạng thái trực quan gắn với hình ảnh** (theo yêu cầu UI/UX đẹp — xem thêm `10-assets-requirements.md`):
  - Trạng thái "Đang tập trung / làm việc" → hiển thị illustration/GIF chủ đề học tập-làm việc.
  - Trạng thái "Đang nghỉ ngắn/nghỉ dài" → hiển thị illustration/GIF chủ đề thư giãn/nghỉ ngơi.
  - Các ảnh này nên đổi theo theme đang chọn (5 theme ở file `05`) để đồng bộ phong cách — ví dụ theme "Đại dương" dùng minh họa sóng biển thư giãn, theme "Vũ trụ" dùng minh họa phi hành gia trôi nổi khi nghỉ.
- Lịch sử phiên: lưu vào IndexedDB (`pomodoro-history`), có thể hiển thị thống kê đơn giản (số phiên hôm nay/tuần này) — không bắt buộc ở bản đầu của tool này.

## 3. Task Checker

- To-do list đơn giản: thêm/sửa/xóa/đánh dấu hoàn thành, sắp xếp kéo-thả (dnd-kit).
- Lưu IndexedDB (`tasks`).
- Có thể gắn nhãn/màu (dùng token theme hiện tại, không tự chọn màu tùy ý để tránh phá vỡ tính nhất quán thị giác).
- Đồng bộ cross-device: **không** nằm trong phạm vi hiện tại (chỉ qua export/import thủ công — xem `07-storage-backup.md`).

## 4. Take Note

- Rich text nhẹ: dùng `contentEditable` thuần cho nhu cầu cơ bản (bold/italic/list), hoặc Tiptap nếu cần format phong phú hơn — cân nhắc trade-off bundle size.
- Autosave debounce (~500ms sau khi ngừng gõ), lưu IndexedDB (`notes`).
- Có thể có nhiều note cùng lúc (mỗi note = 1 tab nhỏ trong window Take Note, hoặc mỗi note = 1 window riêng — quyết định UX nên thử nghiệm, khuyến nghị bắt đầu với "nhiều note trong 1 window, dạng tab" để đỡ chiếm không gian màn hình).

## 5. Animation cho Window Manager

- Mở tool từ trigger icon → window "nở ra" từ vị trí icon (scale + fade, ~200ms), không bung đột ngột từ giữa màn hình.
- Kéo thả floating window: theo con trỏ tức thời, không có "độ trễ đàn hồi" (tránh cảm giác lag giả tạo).
- Minimize: window co lại về đúng icon trigger (animation ngược lại với lúc mở) — tạo cảm giác liên kết trực quan rõ ràng giữa icon và window.

# 07 — Storage & Backup

## 1. IndexedDB Schema (Dexie.js)

Đề xuất bảng (table) chính:

| Table | Nội dung | Ghi chú |
|---|---|---|
| `settings` | key-value theo `featureId` | Bao gồm cả setting "Chung" (General) dưới `featureId = "core"` |
| `wallpapers` | blob ảnh/video + metadata (`type`, `size`, `resolution`, `createdAt`, `isDefault`) | Video không qua xử lý nén, ảnh đã resize trước khi lưu |
| `themes-custom` | theme do user tự tạo/chỉnh (nếu có tính năng tùy biến theme sâu hơn 5 mẫu) | Optional, có thể để Phase sau |
| `custom-clocks` | các custom CSS clock đã lưu, kèm tên | |
| `bookmarks` | chỉ dùng nếu chọn Phương án B (danh sách riêng) ở `02-newtab-core-features.md` §4 | |
| `window-states` | state cuối cùng của từng tool-window (`mode`, `position`, `size`) | Xem `04-sidebar-phai-tools-window-manager.md` |
| `notes` | nội dung note | |
| `tasks` | to-do items | |
| `pomodoro-history` | lịch sử phiên pomodoro (optional) | |
| `onboarding-state` | đã hoàn thành onboarding hay chưa, bước dừng lại nếu bỏ giữa chừng | Xem `08-onboarding.md` |

- Dùng `navigator.storage.persist()` khi khởi tạo lần đầu để giảm rủi ro trình duyệt tự dọn dẹp storage.
- Migration: mỗi thay đổi schema tăng version Dexie, viết migration function rõ ràng, không xóa dữ liệu cũ khi không cần thiết.

## 2. Import / Export Backup

- **Định dạng**: file `.zip` (dùng `fflate` hoặc `JSZip`) chứa:
  - `manifest.json` — version schema, thời điểm export, danh sách feature đã bật.
  - `settings.json` — toàn bộ nội dung table `settings`.
  - `data.json` — nội dung các table còn lại trừ `wallpapers` (tasks, notes, window-states...).
  - `wallpapers/` — thư mục con chứa file ảnh/video gốc (blob → file thật trong zip, không base64 để giảm kích thước ~33%).
- **Export**: gom dữ liệu → build zip → trigger download qua `URL.createObjectURL`.
- **Import**:
  1. Đọc `manifest.json`, kiểm tra version schema.
  2. Nếu version cũ hơn hiện tại → chạy migration tương ứng trước khi ghi vào Dexie.
  3. Nếu version mới hơn hiện tại (import từ bản extension mới hơn vào bản cũ hơn) → cảnh báo rõ ràng, có thể từ chối import hoặc import phần tương thích được.
  4. Ghi đè hoặc merge — cho user chọn ở dialog trước khi thực hiện (Ghi đè toàn bộ / Merge giữ cái mới hơn theo `updatedAt`).
- **An toàn**: validate cấu trúc file trước khi ghi vào DB (tránh file backup hỏng/giả làm crash extension).

## 3. Quản lý dung lượng

- Hiển thị tổng dung lượng đang dùng (ước tính qua `navigator.storage.estimate()`) trong settings "Chung".
- Nút "Dọn dẹp nhanh": gợi ý xóa wallpaper cũ không dùng gần đây (theo `lastUsedAt`), không tự động xóa mà không hỏi.

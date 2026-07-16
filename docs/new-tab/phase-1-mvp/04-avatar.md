# 04 — Avatar (Ảnh đại diện trang chính) — Phase 1

Bổ sung tính năng cho phép user gắn **ảnh hoặc GIF động** hiển thị ở khu vực trung tâm NewTab (phía trên đồng hồ) để cá nhân hóa hơn — nhiều user muốn có avatar/nhân vật riêng cho "trang chủ" của mình.

## 1. Hành vi

- **Nguồn**: upload ảnh tĩnh (jpg/png/webp) hoặc **GIF động** (giữ nguyên animation, không nén để không mất khung hình). Giới hạn ~8MB/ảnh.
- **Xử lý**: ảnh tĩnh được downscale như wallpaper (dùng chung `processImage`); GIF **giữ nguyên** để không mất animation.
- **Thư viện**: lưu nhiều avatar đã upload (IndexedDB, bảng `avatars`), chọn 1 cái đang active, xóa từng cái.
- **Tùy biến hiển thị** (schema-driven, tự sinh form):
  - `shape`: tròn / bo góc / vuông.
  - `size`: 48–180px (slider).
  - `showGreeting` + `greetingName`: hiện dòng chào cá nhân dưới avatar (VD "Chào Kon 👋").
- **Mặc định tắt** (`defaultEnabled: false`) — chỉ hiện khi user chủ động bật + chọn ảnh, tránh chiếm không gian với user không dùng.

## 2. Vị trí & layout

- Zone `center`, `order: 0` → render **trên** đồng hồ (đồng hồ `order: 1`).
- Không chọn ảnh → component render `null` (không chiếm chỗ, giữ center zone sạch).

## 3. Lưu trữ

- Bảng Dexie `avatars`: `{ id, type: 'image'|'gif', blob, name, size, createdAt }` — thêm ở schema version 2 (không migration dữ liệu, chỉ thêm store).
- Có trong Import/Export backup (`avatars/` + `avatars.json` trong file zip), giống wallpaper.

## 4. Tái sử dụng

- Dùng chung `processImage` của wallpaper, UI kit chung (`Button`, `IconButton`), pattern manager giống `WallpaperManager` → nhất quán toàn dự án.

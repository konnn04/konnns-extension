# 04 — Rủi ro kỹ thuật & Câu hỏi mở

## 1. Rủi ro & Lưu ý kỹ thuật

- **OAuth trong extension**: Google/Spotify yêu cầu redirect URI cố định — dùng `chrome.identity.launchWebAuthFlow`; cần đăng ký app riêng ở mỗi bên (Google Cloud Console, Spotify Developer Dashboard). GitHub có thể dùng PAT để né phần này ở giai đoạn đầu.
- **Firefox MV3 khác biệt**: một số API (`chrome.identity`, hành vi `unlimitedStorage`) có khác biệt nhỏ so với Chrome — bắt buộc test riêng trên Firefox, không giả định giống 100%.
- **Video wallpaper + hiệu năng**: video nền chạy liên tục có thể ăn CPU/GPU đáng kể trên máy yếu — bắt buộc toggle tắt riêng + tự phát hiện `prefers-reduced-motion`.
- **Service worker MV3 bị kill**: mọi timer quan trọng (Pomodoro) phải dùng `chrome.alarms`, không dùng `setTimeout` trong background script.
- **Quota IndexedDB**: trình duyệt có thể giới hạn/xóa dữ liệu nếu thiếu `unlimitedStorage` hoặc storage persistence — bắt buộc gọi `navigator.storage.persist()` sớm trong vòng đời extension.

## 2. Câu hỏi còn mở (cần chốt trước hoặc trong lúc code)

1. Bookmark bar dùng API `bookmarks` gốc của trình duyệt hay danh sách riêng do extension quản lý? (khuyến nghị mặc định dùng API gốc — xem `phase-1-mvp/01-tinh-nang-core.md`)
2. Custom CSS clock: cho phép chỉ CSS thuần hay cả JS? (khuyến nghị chỉ CSS ở bản đầu, ảnh hưởng mức độ sandbox cần thiết)
3. Take Note: mỗi note 1 window riêng hay nhiều note dạng tab trong 1 window? (khuyến nghị dạng tab — xem `phase-4-sidebar-phai-tools/01-tinh-nang.md`)
4. Có cần đồng bộ cross-device tự động (ngoài export/import thủ công) ở giai đoạn sau không? Nếu có sẽ cần backend riêng — thay đổi lớn về kiến trúc, nên xác định sớm dù chưa làm ngay.
5. Phong cách asset (illustration Pomodoro, onboarding) chọn theo hướng nào: flat illustration, 3D, pixel art, hay minimal line-art? (ảnh hưởng việc tìm/tạo asset — xem `phase-4-sidebar-phai-tools/02-ui-ux-assets.md`)

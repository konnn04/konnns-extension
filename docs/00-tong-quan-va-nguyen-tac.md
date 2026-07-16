# 00 — Tổng quan & Nguyên tắc thiết kế

**Dự án:** NewTab Extension (trang New Tab cá nhân hóa)
**Đối tượng đọc tài liệu:** Dev / AI Agent triển khai
**Trình duyệt mục tiêu:** Chrome (Manifest V3) + Firefox (Manifest V3)
**Định dạng bộ docs:** Nhiều file markdown, đọc theo thứ tự số 00 → 11 (xem `README.md` mục lục)

---

## 1. Vấn đề & Mục tiêu

Thay thế trang New Tab mặc định bằng một không gian cá nhân hóa sâu: tìm kiếm, thời gian/thời tiết, hình nền động, bookmark nhanh, và các panel/tool mở rộng (thời tiết chi tiết, tin tức, calendar, GitHub, Spotify, Pomodoro, task, note) — tất cả nhẹ, mượt, đẹp, và **có thể mở rộng bởi cộng đồng** (white-label ready).

## 2. Nguyên tắc thiết kế cốt lõi

1. **Performance-first**: tính năng disable → không mount, không render, không tốn CPU/GPU.
2. **Progressive disclosure**: sidebar trái/phải ẩn mặc định, chỉ lộ ra khi cần (hover/toggle) — không chiếm không gian khi không dùng.
3. **MVP trước, mở rộng sau**: lõi ổn định (search, giờ, wallpaper, bookmark) trước, phần cần OAuth/API ngoài (calendar, GitHub, Spotify) làm sau.
4. **Themeable từ gốc**: mọi màu sắc/style đi qua design token (CSS variables) — không hardcode màu trong component.
5. **Offline-first cho core**: 4 tính năng MVP không phụ thuộc mạng để hoạt động cơ bản.
6. **Không giật, không "vá lỗi" khi hiện UI**: xem chi tiết nguyên tắc loading ở file `09-uiux-animation-loading-state.md` — mỗi thành phần khi xuất hiện phải đã ở trạng thái hoàn thiện (không có kiểu "load trước, layout nhảy sau").
7. **Onboarding thân thiện**: lần đầu cài đặt, dẫn dắt user thiết lập cơ bản thay vì ném thẳng vào màn hình trống hoặc quá tải tùy chọn.
8. **Đẹp là yêu cầu chức năng, không phải "nice to have"**: mọi tương tác (hover, mở panel, kéo thả, chuyển theme) cần có animation tinh tế, có chủ đích — nhưng luôn có công tắc "Low-power mode" tắt bớt khi cần.

## 3. Phạm vi (Scope)

### Trong phạm vi
- Trang New Tab tùy biến hoàn toàn (giao diện, layout, theme).
- Hệ thống panel (trái) và tool-window (phải) có thể bật/tắt độc lập.
- Lưu trữ local (IndexedDB) + import/export backup.
- Onboarding lần đầu cài.
- 5 theme mẫu + hệ thống clock style + custom CSS clock.

### Ngoài phạm vi (giai đoạn hiện tại)
- Đồng bộ cross-device tự động (chỉ export/import thủ công).
- Backend/server riêng — mọi OAuth dùng flow client-side (`launchWebAuthFlow` hoặc PKCE).
- Marketplace theme/plugin công khai (định hướng xa, không nằm trong roadmap hiện tại).

## 4. Mục lục bộ docs

| File | Nội dung |
|---|---|
| `00-tong-quan-va-nguyen-tac.md` | File này |
| `01-tech-stack-va-kien-truc.md` | Stack công nghệ, cấu trúc thư mục, Feature Registry, Layout zones |
| `02-newtab-core-features.md` | Search bar, Clock/Weather summary, Wallpaper, Bookmark bar (MVP) |
| `03-sidebar-trai-panels.md` | Weather chi tiết, News, Google Calendar, GitHub, Spotify |
| `04-sidebar-phai-tools-window-manager.md` | Pomodoro, Task, Note + Window Manager |
| `05-theme-he-thong.md` | 5 theme mẫu, clock style, custom CSS |
| `06-settings-system.md` | Settings modal, schema-driven form |
| `07-storage-backup.md` | Schema IndexedDB, Import/Export |
| `08-onboarding.md` | Luồng thiết lập lần đầu cài đặt |
| `09-uiux-animation-loading-state.md` | Nguyên tắc animation, quản lý state loading, skeleton |
| `10-assets-requirements.md` | Danh sách asset cần chuẩn bị (ảnh, gif, icon) và nguồn gợi ý |
| `11-nonfunctional-roadmap-open-questions.md` | Yêu cầu phi chức năng, roadmap theo phase, câu hỏi mở |

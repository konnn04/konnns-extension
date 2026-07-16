# 02 — NewTab Core Features (Phase 1 / MVP)

Đây là nhóm tính năng ưu tiên triển khai trước tiên (theo lựa chọn scope MVP).

## 1. Search Bar

- **Vị trí**: giữa màn hình hoặc giữa-trên cùng — setting toggle.
- **Multi-engine**: Google, Bing, DuckDuckGo, YouTube + custom engine (user tự thêm URL pattern chứa `%s`).
- **Bang-shortcut** (`!yt query`, `!g query`...) — có thể để Phase sau nếu muốn giảm phạm vi MVP thật sự tối giản, nhưng nên có sẵn kiến trúc để bật dễ dàng.
- **Autofocus** khi mở tab mới — setting bật/tắt.
- **Suggestion**: dùng API gợi ý công khai của engine nếu CORS cho phép; fallback im lặng (không suggestion) nếu không — không được để lỗi hiển thị ra UI.
- **Animation**: focus vào ô search có hiệu ứng glow/scale nhẹ (~150ms ease-out), không giật layout xung quanh.

## 2. Ngày giờ + Weather Summary

- **Đồng hồ**: 3 style dựng sẵn (digital / text thường / kim analog) — chi tiết custom CSS clock xem `05-theme-he-thong.md`.
- **Weather API mặc định**: **Open-Meteo** (miễn phí, không cần API key) — fallback tốt cho mọi user ngay khi cài. Cho phép nhập API key riêng (OpenWeatherMap, WeatherAPI...) trong settings nếu muốn nguồn khác/chi tiết hơn.
- **Hiển thị**: nhiệt độ hiện tại, icon điều kiện thời tiết, tốc độ gió.
- **Vị trí**: Geolocation API (permission optional, xin lúc onboarding hoặc lần đầu bật tính năng) hoặc nhập tay tên thành phố.
- **Trạng thái lỗi**: nếu không lấy được vị trí/API lỗi → hiển thị placeholder gọn gàng ("Chưa thiết lập vị trí" + nút thiết lập), không hiển thị lỗi kỹ thuật thô cho user.

## 3. Wallpaper

- **Nguồn**: Upload ảnh (≤10MB) / Upload video (≤50MB) / URL trực tiếp / API thư viện ảnh công khai (Unsplash, Picsum mặc định — key optional để tăng rate limit).
- **Xử lý ảnh**: resize/nén theo độ phân giải màn hình thực tế trước khi lưu, dùng `createImageBitmap` + `OffscreenCanvas`:
  - Màn hình ≤1080p → nén về tối đa 1080p.
  - Màn hình >1080p → giữ nguyên tới kích thước gốc upload (không phóng to).
- **Video**: không xử lý/nén — lưu nguyên, hiển thị cảnh báo dung lượng trước khi lưu nếu file lớn.
- **Âm thanh video** (bổ sung): cho phép bật/tắt tiếng video nền, có slider âm lượng **1–100** (mặc định tắt tiếng để không gây ồn khi mở tab). Vì autoplay có tiếng bị trình duyệt chặn, video luôn khởi động ở trạng thái muted rồi mới bật tiếng sau thao tác của user (đổi setting = 1 user gesture hợp lệ).
- **Chỉ phát khi đang xem NewTab** (bổ sung, mặc định bật): dùng `document.visibilitychange` để **dừng video + tắt tiếng khi user chuyển sang tab khác**, phát lại khi quay lại — tiết kiệm CPU/GPU/pin và tránh tiếng phát ngầm ở tab nền.
- **Quản lý thư viện**: grid các wallpaper đã lưu, xóa từng cái, đặt làm mặc định, xem tổng dung lượng IndexedDB đang dùng + nút "dọn dẹp nhanh" (xóa cái cũ nhất/không dùng).
- **Chế độ hiệu năng thấp**: tự động tắt video wallpaper (chuyển về ảnh tĩnh/gradient dự phòng) khi:
  - User bật "Low-power mode" thủ công, HOẶC
  - `prefers-reduced-motion` được trình duyệt/OS báo bật.
- **Chuyển wallpaper**: có crossfade animation mượt (~400-600ms) khi đổi, không "chớp" trắng giữa 2 ảnh.

## 4. Bookmark Bar (Quick Access)

- **Cảnh báo 1 lần**: khi bật tính năng lần đầu, nhắc user tắt bookmark bar gốc của trình duyệt để tránh trùng lặp thị giác (không thể tự tắt hộ vì extension không có quyền ép — chỉ hướng dẫn).
- **Orientation**: ngang / dọc / radial (dạng vòng tròn, kéo-thả để sắp xếp vị trí từng icon quanh vòng).
- **Hiển thị icon**: luôn hiện / ẩn cho đến hover khu vực.
- **Hover effect**: scale-up mượt kiểu "sóng dock macOS" — item lân cận cũng phóng nhẹ theo tỉ lệ giảm dần. Dùng CSS `transform` + `transition`, tránh `box-shadow` động nặng để giữ nhẹ GPU.
- **Kéo thả sắp xếp**: dùng `dnd-kit`, hỗ trợ bàn phím (accessibility).
- **Nguồn dữ liệu — cần quyết định** (xem câu hỏi mở ở file `11`):
  - Phương án A: đọc từ `bookmarks` API gốc trình duyệt (permission `bookmarks`) — đồng bộ tự nhiên với bookmark thật.
  - Phương án B: danh sách tự quản lý riêng trong extension — không đụng bookmark gốc, linh hoạt hơn về UI (icon custom, nhóm...) nhưng không đồng bộ với bookmark thật.
  - Khuyến nghị mặc định nếu chưa chốt: **Phương án A** làm nguồn chính (đơn giản, ít trùng lặp dữ liệu), có thể thêm "pinned items" riêng (không phải bookmark thật) như lớp phủ nhẹ ở Phase sau.

## 5. Trạng thái tải khi mở tab mới (áp dụng chung cho cả 4 tính năng trên)

Xem chi tiết nguyên tắc đầy đủ ở `09-uiux-animation-loading-state.md`. Tóm tắt riêng cho MVP:
- Wallpaper: hiện placeholder màu trung tính (lấy từ theme hiện tại) ngay lập tức, crossfade sang wallpaper thật khi decode xong — **không** hiện ảnh vỡ/chưa load rồi "nhảy" sang ảnh đầy đủ.
- Clock: render ngay từ cache local (không đợi mạng) — đồng hồ không phụ thuộc weather.
- Weather: có state riêng (loading → success/error), không block phần còn lại của UI.
- Search bar & Bookmark bar: dữ liệu local, nên gần như tức thời — nếu bookmark đọc từ API trình duyệt cần fetch, dùng skeleton dạng "chấm mờ" khớp kích thước thật, tránh layout shift khi data về.

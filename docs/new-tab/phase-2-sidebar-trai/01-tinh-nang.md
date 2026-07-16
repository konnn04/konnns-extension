# Phase 2 — Sidebar Trái: Weather chi tiết & News Feed

> **Trạng thái: ✅ đã triển khai.**
> - Layout engine: `src/core/layout-engine/leftSidebar.ts` + `src/app/LeftSidebar.tsx` — trigger rail dọc auto-sinh từ feature zone `left-sidebar`, panel trượt ngang, single/multi-open theo setting `sidebarMode` (General), auto-hide + hiện khi hover mép trái, panel content lazy (chỉ mount khi mở).
> - Weather chi tiết: `src/features/panel-weather-detail/` — dùng chung `useWeatherStore.fetchForecast` (Open-Meteo, cùng vị trí với summary, cache qua `core/net`), biểu đồ nhiệt 24h **tự vẽ SVG** (`TempChart.tsx`, không thêm dependency chart), độ ẩm + UV, dự báo 7 ngày.
> - News: `src/features/panel-news/` — RSS đa nguồn theo chủ đề (chọn bằng **Combobox multi-select**), xin `optional_host_permissions` runtime, "Dịch nhanh" qua LibreTranslate (ẩn nếu chưa cấu hình endpoint), cache offline. Danh sách chủ đề/feed ở `rss.ts` (dễ thêm).


Sidebar trái gồm các trigger icon dọc; bấm vào mở panel trượt ra bên phải của thanh trigger. Hành vi mở/đóng (single-open vs multi-open, auto-hide) mô tả ở `../01-tech-stack-va-kien-truc.md` §4.

## 1. Panel: Weather chi tiết

- Forecast nhiều ngày (dùng chung API với `clock-weather` ở NewTab core — không gọi API trùng lặp, share cache qua store chung).
- Biểu đồ nhiệt độ theo giờ (dùng thư viện chart nhẹ, ví dụ `recharts` hoặc tự vẽ SVG nếu muốn tối giản dependency).
- Hiển thị thêm: độ ẩm, UV index, cảnh báo thời tiết nếu API hỗ trợ (Open-Meteo có alert ở một số vùng; OpenWeatherMap có riêng endpoint alert).
- Animation mở panel: trượt ngang từ trái (~250-300ms cubic-bezier ease-out), nội dung bên trong fade-in sau khi panel đã trượt tới vị trí (tránh text bị "kéo lê" theo khung).

## 2. Panel: News Feed

- Chọn nhiều chủ đề: IT, công nghệ, bảo mật, đời sống, pháp luật... (danh sách chủ đề nên để dạng config dễ thêm, không hardcode).
- Mix nhiều nguồn cùng lúc theo chủ đề đã chọn.
- **Nguồn dữ liệu khuyến nghị**: RSS feed công khai làm nguồn chính (ổn định, không cần key, không giới hạn quota) + NewsAPI.org optional cho user muốn thêm nguồn (cần key riêng, free tier giới hạn request/ngày).
- Song ngữ: hiển thị bài viết gốc + nút "Dịch nhanh" (gọi API dịch nếu user tự cấu hình key; nếu không có key thì ẩn nút, không báo lỗi).
- Danh sách bài viết: virtualized list nếu số lượng lớn (tránh render hết DOM cùng lúc — ảnh hưởng hiệu năng).

*(Không cần OAuth — 2 panel này có thể triển khai độc lập với Phase 3.)*

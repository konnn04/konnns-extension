# 03 — Yêu cầu phi chức năng (Non-functional)

| Hạng mục | Yêu cầu |
|---|---|
| Hiệu năng | First paint NewTab < 100ms trên máy trung bình; không block render khi tải wallpaper lớn (lazy + placeholder) |
| Chế độ nhẹ | "Low-power mode" tắt animation không thiết yếu, particle, video wallpaper, chỉ giữ chức năng lõi |
| Bộ nhớ | Cảnh báo user khi IndexedDB dùng gần giới hạn quota trình duyệt (`navigator.storage.estimate()`) |
| Bảo mật | Custom CSS injection sandbox hóa; token OAuth (Calendar, Spotify, GitHub) ưu tiên `chrome.storage.session` thay vì IndexedDB thô cho access token; refresh token (nếu có) mã hóa nhẹ trước khi lưu lâu dài |
| Khả năng truy cập (a11y) | Toàn bộ tương tác dùng được bằng bàn phím (drag-drop bookmark, window manager cần fallback bàn phím); contrast đạt AA cho mọi theme (light & dark) |
| Đa ngôn ngữ | UI hỗ trợ tối thiểu Việt + Anh từ đầu (`react-i18next`), kiến trúc dễ thêm ngôn ngữ khác sau |
| Onboarding | Hoàn thành nhanh (skip-all dưới 10 giây), không chặn cứng nếu user muốn bỏ qua |

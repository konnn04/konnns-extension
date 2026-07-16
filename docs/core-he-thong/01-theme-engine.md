# 05 — Hệ thống Theme & Clock Style

## 1. 5 Theme mẫu

Mỗi theme gồm:
- Palette **light** + **dark** (color tokens: `--bg`, `--surface`, `--surface-elevated`, `--text`, `--text-muted`, `--accent`, `--accent-contrast`, `--border`, `--overlay`...).
- Font pairing gợi ý (heading + body), có thể override trong settings.
- Optional: hiệu ứng nền đặc trưng nhẹ (ví dụ particle cho theme "Vũ trụ") — **luôn có toggle tắt riêng** vì có thể nặng GPU trên máy yếu.
- Bộ illustration/GIF riêng cho các trạng thái tool (Pomodoro làm việc/nghỉ — xem `10-assets-requirements.md`) để đồng bộ phong cách toàn theme.

| Theme | Cảm hứng màu | Gợi ý hiệu ứng đặc trưng (optional, tắt được) |
|---|---|---|
| Đại dương | Xanh biển, xanh ngọc, trắng bọt sóng | Gợn sóng nhẹ ở cạnh dưới màn hình |
| Vũ trụ | Tím than, xanh navy đậm, ánh sao | Particle sao lấp lánh chuyển động chậm |
| Thiên nhiên | Xanh lá, nâu đất, be | Lá cây/hạt phấn bay nhẹ |
| Sa mạc | Cam đất, vàng cát, nâu hoàng hôn | Hiệu ứng "nhiệt/mirage" rất nhẹ ở chân trời (optional, dễ gây khó chịu nên mặc định tắt) |
| Thành thị tương lai | Neon tím/xanh cyan trên nền đen | Đường kẻ neon/grid mờ chuyển động chậm |

- Theme = object theo `theme.schema.ts` → đặt trong `src/themes/<name>/`, không cần sửa code core để thêm theme mới (điều kiện cho cộng đồng đóng góp).
- Chuyển theme có animation crossfade token màu (~300ms), không "chớp" đổi màu đột ngột.

## 2. Clock Style

3 style dựng sẵn:
1. **Digital** — số điện tử, font monospace hoặc font digital-style.
2. **Text thường** — hiển thị dạng chữ (ví dụ "10 giờ 42 phút"), phù hợp phong cách tối giản.
3. **Kim (Analog)** — đồng hồ kim SVG, animate kim giây mượt (dùng CSS transform, không re-render toàn SVG mỗi giây).

### Custom CSS Clock (slot cho dev/người dùng nâng cao)
- Trong settings, có ô nhập CSS + khung preview realtime bên cạnh để xem thay đổi ngay khi gõ.
- **Sandbox bắt buộc**: preview chạy trong `<iframe sandbox>` cô lập, không cho phép:
  - `@import` từ URL ngoài (chặn qua CSP của iframe).
  - `expression()` hoặc bất kỳ cú pháp thực thi JS qua CSS.
- CSS custom chỉ áp dụng cho phần tử clock, không leak ra ảnh hưởng toàn trang NewTab (dùng CSS scoping/Shadow DOM cho clock component).
- Lưu nhiều custom clock đã tạo (không chỉ 1), đặt tên, chọn cái đang active.

## 3. Nguyên tắc áp dụng token xuyên suốt dự án

- **Không component nào được hardcode màu trực tiếp** (`#fff`, `rgb(...)`) trừ trong chính file định nghĩa theme.
- Mọi shadow, border-radius, spacing cũng nên đi qua token (`--radius-sm`, `--shadow-elevated`...) để đổi theme đồng bộ cả về "cảm giác", không chỉ màu sắc.
- Test bắt buộc: mỗi theme đạt contrast AA cho text trên mọi surface được dùng (xem `11-nonfunctional-roadmap-open-questions.md` mục accessibility).

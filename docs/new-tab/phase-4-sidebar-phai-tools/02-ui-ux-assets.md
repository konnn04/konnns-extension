# 10 — Asset Requirements (Ảnh, GIF, Icon)

Vì dự án ưu tiên UI/UX đẹp, cần chuẩn bị trước bộ asset để không bị chặn tiến độ dev khi tới phần UI. Dưới đây là danh sách asset cần, phân theo tính năng, kèm gợi ý nguồn.

## 1. Pomodoro Timer — asset theo trạng thái

| Trạng thái | Loại asset gợi ý | Số lượng đề xuất |
|---|---|---|
| Đang làm việc/tập trung | Illustration tĩnh hoặc GIF loop nhẹ (người ngồi học/làm việc, gõ máy tính...) | 1 bộ / theme (5 theme × 1 = tối thiểu 5, có thể dùng chung 1 bộ trung tính nếu chưa kịp làm riêng từng theme) |
| Nghỉ ngắn | Illustration/GIF chủ đề thư giãn nhẹ (uống nước, giãn cơ, nhìn ra cửa sổ) | Tương tự |
| Nghỉ dài | Illustration/GIF chủ đề nghỉ ngơi sâu hơn (đi dạo, nằm thư giãn, thiên nhiên) | Tương tự |
| Hoàn thành phiên (celebratory) | Animation ngắn dạng "confetti nhẹ" hoặc icon check đẹp | 1 bộ dùng chung mọi theme |

- **Định dạng khuyến nghị**: ưu tiên **Lottie (JSON, dùng `lottie-react`)** thay vì GIF thô — nhẹ hơn nhiều về dung lượng, scale vector không vỡ nét, tô màu lại theo token theme được (GIF thì không đổi màu theo theme được).
- Nếu dùng GIF/WebP truyền thống: nén kỹ, ưu tiên WebP animated (nhẹ hơn GIF ~30-50%), giới hạn kích thước file mỗi asset dưới ~500KB.

### Nguồn gợi ý (miễn phí, cần kiểm tra license cụ thể trước khi dùng)
- **LottieFiles** (lottiefiles.com) — kho animation Lottie miễn phí/trả phí theo license từng file, tìm theo từ khóa "focus", "study", "relax", "break time".
- **unDraw** (undraw.co) — illustration SVG miễn phí, **cho phép đổi màu theo palette** (rất hợp để khớp theme), không có sẵn animation nhưng có thể tự thêm chuyển động nhẹ bằng CSS/Framer Motion.
- **Storyset** (storyset.com, của Freepik) — illustration có sẵn 1 số biến thể animated, đổi màu được.
- **Open Peeps / Blush** — illustration nhân vật phong cách flat, có thể tùy biến.

*(Lưu ý: Claude không thể tự tạo hoặc nhúng trực tiếp file ảnh/GIF từ các nguồn trên vào extension — đây là gợi ý nguồn để bạn hoặc designer tải/mua và đưa vào dự án. Có thể yêu cầu Claude tạo illustration gốc dạng SVG/component nếu muốn tránh phụ thuộc asset ngoài.)*

## 2. Wallpaper mặc định (dùng trong Onboarding bước 4)

- Mỗi theme cần 2-3 ảnh gradient/photo mặc định (light + dark variant) để user chọn nhanh mà không cần tự upload.
- Có thể dùng gradient CSS thuần (không cần ảnh thật) làm phương án dự phòng nhẹ nhất — khuyến nghị **có ít nhất phương án gradient thuần cho mỗi theme** để không phụ thuộc hoàn toàn vào ảnh ngoài, đảm bảo luôn nhẹ và không lỗi khi offline.
- Nếu dùng ảnh thật: Unsplash/Pexels (miễn phí, cần đọc license — phần lớn cho phép dùng thương mại không cần ghi nguồn, nhưng nên kiểm tra từng ảnh).

## 3. Icon

- Bộ icon chính: **Lucide** (đã chọn ở tech stack) — đủ cho hầu hết trigger icon, action button.
- Icon đặc thù theo theme (ví dụ icon sóng biển cho "Đại dương", icon sao cho "Vũ trụ") — có thể tự vẽ SVG đơn giản, không cần asset phức tạp.

## 4. Onboarding illustration

- 1 illustration/animation "chào mừng" ở bước 1 — nên là 1 illustration trung tính đẹp, không gắn cứng vào theme cụ thể (vì user chưa chọn theme ở bước này).

## 5. Quy trình khuyến nghị

1. Xác định phong cách chung trước (flat illustration / 3D / pixel art / minimal line-art) — nên **nhất quán 1 phong cách xuyên suốt mọi asset** để tránh cảm giác chắp vá.
2. Ưu tiên định dạng **SVG/Lottie** hơn ảnh raster/GIF để nhẹ và đổi màu theo theme được.
3. Có thể bắt đầu Phase 1 (MVP) mà **chưa cần asset Pomodoro** (Pomodoro nằm ở Phase 4) — không block MVP vì thiếu asset.
4. Nếu muốn, có thể nhờ Claude tạo SVG illustration gốc (đơn giản, phong cách flat) ngay trong quá trình code để không phụ thuộc nguồn ngoài — đây là lựa chọn thay thế nếu không muốn tự tìm/mua asset.

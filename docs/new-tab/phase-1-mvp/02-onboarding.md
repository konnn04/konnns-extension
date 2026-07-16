# 08 — Onboarding (Thiết lập lần đầu cài đặt)

## 1. Mục tiêu

Lần đầu cài extension, thay vì user mở tab mới và thấy 1 trang trống hoặc quá tải mọi tính năng cùng lúc, dẫn dắt qua 1 luồng thiết lập ngắn gọn, đẹp, để có ngay trải nghiệm cá nhân hóa cơ bản mà không cần vào sâu Settings.

## 2. Kích hoạt

- Trigger: lần đầu extension được cài (`chrome.runtime.onInstalled`, `reason === "install"`).
- Hiển thị dưới dạng overlay toàn màn hình phủ lên trên NewTab (NewTab vẫn render nền mờ phía sau để user thấy trước "thành quả" sẽ nhận được).
- Có thể mở lại bất kỳ lúc nào từ Settings → General → "Xem lại hướng dẫn thiết lập" (không chỉ hiện đúng 1 lần duy nhất và mất luôn).

## 3. Các bước đề xuất (thiết kế dạng wizard, có thể Skip toàn bộ)

| Bước | Nội dung | Có thể Skip |
|---|---|---|
| 1. Chào mừng | Giới thiệu ngắn gọn (1 câu) + hình minh họa/animation chào mừng theo theme mặc định | Không (bước giới thiệu, chỉ có nút "Bắt đầu") |
| 2. Chọn theme | Hiển thị 5 theme dạng thẻ preview trực quan (mini mockup NewTab thu nhỏ cho mỗi theme), chọn 1, áp dụng live ngay lập tức | Có (giữ theme mặc định) |
| 3. Sáng/Tối | Chọn light/dark hoặc "theo hệ thống" | Có (mặc định theo hệ thống) |
| 4. Hình nền | Gợi ý vài ảnh mặc định đẹp theo theme đã chọn (thumbnail để chọn nhanh) hoặc upload luôn nếu muốn | Có (dùng gradient mặc định của theme) |
| 5. Vị trí (cho Weather) | Xin quyền Geolocation hoặc nhập tay thành phố | Có (bỏ qua weather, chỉ hiện giờ) |
| 6. Bookmark bar | Hỏi có muốn bật Quick Access bar không, kèm nhắc nhở tắt bookmark bar gốc trình duyệt nếu chọn có | Có |
| 7. Chọn tính năng mở rộng muốn bật | Danh sách checkbox các panel/tool (News, GitHub, Pomodoro...) — auto-sinh từ Feature Registry, không hardcode | Có (tất cả tắt mặc định, bật sau trong Settings) |
| 8. Hoàn tất | Tóm tắt nhanh những gì đã chọn + nút "Vào NewTab" | — |

- Mỗi bước có progress indicator (dots hoặc thanh) ở trên/dưới, cho phép quay lại bước trước.
- Toàn bộ wizard nên **tối đa ~2-3 phút** để hoàn thành nếu đi hết, và **dưới 10 giây** nếu bấm Skip All ngay từ đầu.

## 4. Trạng thái dở dang

- Nếu user đóng tab giữa chừng onboarding: lưu bước đang dừng vào `onboarding-state` (IndexedDB), lần mở tab mới tiếp theo tiếp tục từ đúng bước đó (không bắt làm lại từ đầu), kèm nút nhỏ "Bỏ qua phần còn lại".

## 5. Animation & cảm giác

- Chuyển bước: slide ngang mượt (~300ms), không fade cứng đột ngột.
- Mỗi lựa chọn (theme, ảnh nền...) có preview live ngay lập tức phía sau overlay — user thấy kết quả áp dụng thật, không phải ảnh minh họa tĩnh tách biệt.
- Nút "Bắt đầu" / "Tiếp tục" có micro-interaction khi hover/click (scale nhẹ), tạo cảm giác mượt mà, chuyên nghiệp ngay từ giây đầu tiên sử dụng.

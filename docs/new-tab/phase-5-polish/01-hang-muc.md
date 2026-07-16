# Phase 5 — Polish & Hoàn thiện

> **Trạng thái: ✅ đã triển khai** (trừ định hướng xa §6).
> - Custom CSS Clock: `src/features/clock-weather/CustomClock.tsx` (Shadow DOM scoped + sanitize `@import`/`expression()`/style-breakout) + `ClockPresetManager.tsx` (nhiều preset, đặt tên, live preview, autosave 300ms, lưu bảng `customClocks`). Chọn kiểu "Tùy chỉnh (CSS)" trong Settings.
> - Radial bookmark: orientation "radial" → items dạng quạt (nửa vòng trên) trong `bookmark-bar/index.tsx`.
> - Low-power hoàn chỉnh: `src/app/LowPowerSuggest.tsx` phát hiện `prefers-reduced-motion` → banner gợi ý bật (không ép). Low-power vẫn set token + tắt video/animation như trước.
> - i18n: thêm keys controls window (`common.minimize/maximize/dock/float`), custom clock, onboarding bước 7.
> - Onboarding bước 7: `Onboarding.tsx` thêm step chọn tính năng mở rộng (checkbox auto-sinh từ Feature Registry, zone left/right sidebar).

Các hạng mục nâng cao, thực hiện sau khi 4 phase trước đã ổn định.

## 1. Custom CSS Clock Editor
- Nâng cấp từ 3 style dựng sẵn (digital/text/analog, xem `../phase-1-mvp/01-tinh-nang-core.md`) lên slot cho phép dev/user tự viết CSS riêng.
- UI: ô nhập CSS (code editor nhẹ, VD CodeMirror) + khung preview realtime, cập nhật khi gõ (debounce ~300ms).
- Sandbox hóa: chặn `@import` từ nguồn ngoài, chặn `expression()`, giới hạn trong iframe hoặc Shadow DOM scoped riêng cho clock.
- Cho phép lưu nhiều "clock preset" tự tạo, đặt tên, chuyển đổi nhanh.

## 2. Radial Bookmark Layout
- Hoàn thiện chế độ hiển thị bookmark dạng vòng tròn (nếu chưa làm ở Phase 1): kéo-thả sắp xếp vị trí quanh vòng, animation mở/đóng dạng "nở ra" từ tâm.

## 3. Low-power Mode hoàn chỉnh
- Gộp toàn bộ toggle rời rạc (tắt video wallpaper, giảm animation, tắt particle theme) thành 1 chế độ tổng, đồng thời vẫn giữ từng toggle riêng cho ai muốn tùy biến sâu hơn.
- Tự động phát hiện `prefers-reduced-motion` ở cấp OS và đề xuất bật Low-power mode (không tự ép bật).

## 4. i18n đầy đủ hơn
- Mở rộng ngoài Việt/Anh nếu có nhu cầu, tách toàn bộ string cứng còn sót (đặc biệt trong onboarding và settings form labels) vào file dịch.

## 5. Onboarding bước 7 — Chọn tính năng mở rộng
- Khi đã có panel/tool từ Phase 2-4, bổ sung bước cho user mới chọn nhanh những panel/tool muốn bật ngay từ đầu (thay vì phải vào Settings bật thủ công sau).

## 6. Định hướng xa (ngoài roadmap hiện tại)
- Cộng đồng đóng góp theme/plugin (marketplace nhẹ, hoặc đơn giản là hướng dẫn PR theme mới vào `src/themes/`).
- Cân nhắc đồng bộ cross-device tự động (cần backend — xem câu hỏi mở #4 ở `../04-rui-ro-va-cau-hoi-mo.md`), hiện chưa nằm trong scope.

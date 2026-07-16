# Phase 3 — Tích hợp OAuth: Calendar, GitHub, Spotify

> **Trạng thái: ✅ đã triển khai** (theo thứ tự ưu tiên GitHub → Spotify → Calendar).
> - Abstraction OAuth: `src/core/oauth/` — `launchWebAuthFlow` cross-browser, PKCE (`createPkce`), token lưu `storage.session`, `RedirectUriField` hiện Redirect URI cho user whitelist.
> - GitHub: `src/features/panel-github/` — dùng **PAT** (settings secret field, không cần đăng ký OAuth app), profile + contribution heatmap SVG tự vẽ + đếm notification → đẩy vào notification engine.
> - Spotify: `src/features/panel-spotify/` — **PKCE**, user tự nhập Client ID; mini-player (currently-playing) + play/pause/next/prev (cần Premium), progress interpolate giữa các lần poll.
> - Calendar: `src/features/panel-calendar/` — Google **token flow** client-side, user tự nhập Client ID; sự kiện hôm nay/sắp tới (read-only).
> - Lưu ý: Spotify/Calendar cần user tự đăng ký app (Client ID) và whitelist Redirect URI (hiện trong Settings) — theo đúng docs. GitHub PAT hoạt động ngay không cần đăng ký.

## 1. Panel: Google Calendar

- **Auth**: OAuth 2.0 qua Google Identity Services, dùng `chrome.identity.launchWebAuthFlow` (cross-browser qua abstraction layer đã nêu ở `../01-tech-stack-va-kien-truc.md`).
- Cần đăng ký OAuth Client ID trong Google Cloud Console, khai báo scope tối thiểu (`calendar.readonly` cho bản đầu).
- Hiển thị: sự kiện hôm nay / tuần này, chỉ đọc (read-only) — không cho tạo/sửa sự kiện ở bản đầu để giảm rủi ro và scope permission.
- Token lưu ở `chrome.storage.session` (không lưu IndexedDB thô) — xem thêm cân nhắc bảo mật ở `../04-rui-ro-va-cau-hoi-mo.md`.

## 2. Panel: GitHub Profile

- **Auth**: 2 lựa chọn —
  - GitHub OAuth App (chuẩn hơn, cần đăng ký app + xử lý redirect).
  - Personal Access Token do user tự tạo và dán vào settings (đơn giản hơn cho use-case cá nhân) — **khuyến nghị dùng PAT cho bản đầu** vì tốc độ triển khai nhanh hơn, có thể nâng cấp lên OAuth App sau.
- Hiển thị: avatar + thông tin cơ bản, contribution graph (GitHub GraphQL API), thông báo mới (cần scope `notifications` nếu dùng PAT) → đẩy qua `02-notification-system.md`.
- Cache dữ liệu contribution graph theo ngày (không cần refetch mỗi lần mở tab).

## 3. Panel: Spotify

- **Auth**: OAuth PKCE flow (phù hợp cho extension client-side, không cần backend riêng để giữ client secret).
- **Điều khiển phát nhạc**: Spotify Web Playback SDK — yêu cầu tài khoản **Premium** để control từ xa (play/pause/next/prev/volume).
- **Fallback**: nếu không có active playback session, gọi `/me/player/currently-playing` để hiển thị "Đang phát gần nhất" (read-only).
- **UI**: album art làm nền mini-player, animation progress bar mượt (interpolate giữa các lần poll, không giật theo từng lần fetch — xem `../phase-1-mvp/03-animation-loading-strategy.md`).

## 4. Thứ tự ưu tiên đề xuất (nếu không làm cùng lúc 3 panel này)

1. **GitHub** — dễ triển khai nhất (PAT, không cần OAuth App phức tạp).
2. **Spotify** — phức tạp hơn (PKCE + Premium requirement + SDK).
3. **Google Calendar** — phức tạp nhất về setup OAuth Client + Google Cloud Console.

*(Thứ tự này là đề xuất dựa trên độ phức tạp triển khai; có thể điều chỉnh theo nhu cầu sử dụng thực tế.)*

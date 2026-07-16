# 02 — Roadmap theo Phase

**Phase 1 — MVP:**
NewTab cơ bản = Search bar + Clock/Weather summary + Wallpaper (ảnh/video/URL) + Bookmark bar + Settings modal cơ bản + Theme engine (5 theme, chưa cần custom CSS clock) + Storage/backup nền tảng (Dexie schema, import/export core) + **Onboarding cơ bản** (bước 1-6, chưa cần bước chọn tính năng mở rộng vì Phase 1 chưa có panel/tool nào khác).
→ Chi tiết: thư mục `phase-1-mvp/`.

**Phase 2:** Left sidebar layout engine hoàn chỉnh + Panel Weather chi tiết + Panel News Feed.
→ Chi tiết: thư mục `phase-2-sidebar-trai/`.

**Phase 3:** Panel GitHub → Panel Calendar, Panel Spotify (theo thứ tự ưu tiên đề xuất) + Notification System (cần từ phase này để phục vụ reminder Calendar / thông báo GitHub).
→ Chi tiết: thư mục `phase-3-tich-hop-oauth/`.
> Nếu Pomodoro (Phase 4) được ưu tiên làm sớm hơn, cần kéo bản lõi tối thiểu của Notification System lên trước — xem `phase-3-tich-hop-oauth/02-notification-system.md`.

**Phase 4:** Right sidebar Window Manager hoàn chỉnh + Pomodoro/Tasks/Notes + asset Pomodoro theo trạng thái.
→ Chi tiết: thư mục `phase-4-sidebar-phai-tools/`.

**Phase 5 — Polish:**
- Custom CSS clock editor (nâng từ 3 style dựng sẵn).
- Radial bookmark layout (nếu chưa làm ở Phase 1).
- Low-power mode hoàn chỉnh + tôn trọng `prefers-reduced-motion` toàn hệ thống.
- i18n đầy đủ hơn 2 ngôn ngữ nếu cần.
- Onboarding bước 7 (chọn tính năng mở rộng) kích hoạt đầy đủ khi đã có panel/tool.
- (Định hướng xa, ngoài roadmap hiện tại) Cộng đồng đóng góp theme/plugin.
→ Chi tiết: thư mục `phase-5-polish/`.

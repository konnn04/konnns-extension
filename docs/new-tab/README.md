# NewTab Extension — Bộ tài liệu (Docs Set)

Dự án: Extension cá nhân thay thế NewTab (WXT + React + Vite, Chrome + Firefox).
Bộ docs chia theo **roadmap triển khai** — mỗi phase là 1 thư mục, dùng trực tiếp cho dev hoặc AI agent code theo từng giai đoạn.

## Cấu trúc

```
docs/
├── 00-tong-quan-va-nguyen-tac.md       # Tầm nhìn, nguyên tắc thiết kế
├── 01-tech-stack-va-kien-truc.md       # Stack công nghệ, Feature Registry, Layout Zones, Window Manager
├── 02-roadmap.md                       # Roadmap 5 phase (tổng hợp, có index sang từng thư mục phase)
├── 03-yeu-cau-phi-chuc-nang.md         # NFR: hiệu năng, bảo mật, a11y, i18n
├── 04-rui-ro-va-cau-hoi-mo.md          # Rủi ro kỹ thuật + câu hỏi cần chốt trước khi code
│
├── core-he-thong/                      # Core system — cần từ Phase 1, dùng chung mọi phase sau
│   ├── 01-theme-engine.md              # 5 theme mẫu, clock style, custom CSS slot
│   ├── 02-settings-engine.md           # Settings modal, schema-driven form
│   └── 03-storage-backup.md            # Schema IndexedDB, Import/Export
│
├── phase-1-mvp/                        # ƯU TIÊN LÀM TRƯỚC
│   ├── 01-tinh-nang-core.md            # Search, Clock/Weather, Wallpaper (+ video sound), Bookmark bar
│   ├── 02-onboarding.md                # Wizard cài đặt lần đầu
│   ├── 03-animation-loading-strategy.md # + §6 cache offline
│   └── 04-avatar.md                    # Ảnh/GIF đại diện trang chính
│
├── phase-2-sidebar-trai/
│   └── 01-tinh-nang.md                 # Weather chi tiết, News feed
│
├── phase-3-tich-hop-oauth/
│   ├── 01-tinh-nang.md                 # Google Calendar, GitHub, Spotify (kèm thứ tự ưu tiên đề xuất)
│   └── 02-notification-system.md       # Cần từ phase này (reminder/thông báo)
│
├── phase-4-sidebar-phai-tools/
│   ├── 01-tinh-nang.md                 # Pomodoro, Task Checker, Take Note, Window Manager
│   └── 02-ui-ux-assets.md              # Lottie, icon, âm thanh...
│
├── phase-5-polish/
│   └── 01-hang-muc.md                  # Custom CSS clock editor, radial bookmark, low-power mode, i18n, community theme
│
└── bonus-public-api.md                 # Danh mục public API cho từng feature (nguồn không key vs cần key)
```

## Cách dùng
- Đọc `00` → `04` trước để nắm kiến trúc & quy ước chung, rồi đọc `core-he-thong/` — mọi phase đều phụ thuộc vào các hệ thống lõi này (Feature Registry, Theme/Settings/Storage Engine).
- Mỗi thư mục `phase-*` là 1 đơn vị công việc tương đối độc lập, có thể giao cho dev/agent khác nhau miễn tuân thủ core system chung và Definition of Done (xem `phase-1-mvp/`).
- **Notification System** (`phase-3-tich-hop-oauth/02`) tuy nằm ở Phase 3 nhưng nếu Pomodoro (Phase 4) được ưu tiên làm sớm, cần kéo bản lõi tối thiểu của nó lên trước — xem ghi chú trong `02-roadmap.md`.

## Scope đã chốt
- Trình duyệt: **Chrome + Firefox** (Manifest V3).
- Docs: 1 bộ nhiều file, chia theo roadmap (không gộp thành 1 PRD duy nhất).
- MVP (Phase 1) = NewTab cơ bản: search, giờ/thời tiết, wallpaper, bookmark bar + onboarding cơ bản + animation/loading strategy chuẩn.

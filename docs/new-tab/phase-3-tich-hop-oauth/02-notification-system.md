# Phase 3 — Hệ thống thông báo (Notification System)

> **Trạng thái: ✅ đã triển khai** — `src/core/notification-engine/`.
> - `notify({source,type,title,body,sound?,os?})`: log vào IndexedDB (`notificationsLog`, DB v3) + đẩy in-app + OS-level (`browser.notifications`) khi tab ẩn / type alarm|reminder; rate-limit dedupe 30s theo source+title; âm thanh qua WebAudio (không cần asset).
> - In-app Notification Center: chuông + badge chưa đọc cạnh settings trigger, lịch sử, đánh dấu đã đọc / xóa (`NotificationCenter.tsx`).
> - Per-source toggle **auto-sinh** từ feature có `notifiable: true` + master + sound (`NotificationSettings.tsx` trong General). Quyền `notifications` xin runtime.
> - Chạy nền: `entrypoints/background.ts` poll GitHub qua `chrome.alarms` (15') → fire OS notification + log kể cả khi không mở NewTab.

Notification System liệt kê ở đây vì trở nên **cần thiết** ngay khi có GitHub (thông báo mới) và Google Calendar (nhắc lịch). Nếu Pomodoro (Phase 4) được ưu tiên làm sớm hơn Phase 3, cần kéo **bản lõi tối thiểu** của service này lên trước — xem `../02-roadmap.md`.

## 1. Service tập trung

Một service `core/notification-engine` mà mọi feature dùng chung, thay vì mỗi feature tự gọi `chrome.notifications` rời rạc:

```ts
notify({
  source: "pomodoro" | "tasks" | "news" | "calendar" | "github" | ...,
  type: "info" | "success" | "reminder" | "alarm",
  title: string,
  body: string,
  actions?: { label: string; onClick: () => void }[],
  sound?: boolean,
  persistent?: boolean, // vẫn lưu trong Notification Center dù đã dismiss OS-level
});
```

## 2. Hai lớp thông báo

1. **OS-level** (`chrome.notifications` / tương đương Firefox) — cho sự kiện quan trọng khi tab không active: Pomodoro hết giờ, task đến hạn, sự kiện Calendar sắp tới, GitHub notification mới.
2. **In-app Notification Center** — icon chuông + badge số chưa đọc, đặt cạnh `settings-trigger` hoặc góc trên phải NewTab. Log lại mọi thông báo kể cả khi user đang xem NewTab; xem lại lịch sử, đánh dấu đã đọc, xóa.

## 3. Cấu hình

- **Per-feature toggle**: mỗi nguồn (`source`) có switch bật/tắt riêng trong Settings — tự sinh từ field `notifiable: true` khai báo ở Feature Registry (`../01-tech-stack-va-kien-truc.md` §3.1), cộng thêm switch tổng "Tắt hết".
- **Không spam**: rate-limit / gộp nhóm theo `source` trong cùng khung thời gian ngắn (VD nhiều task đến hạn cùng lúc → gộp thành 1 thông báo "3 công việc đến hạn" thay vì 3 thông báo riêng).
- **Âm thanh**: file audio ngắn (<1s), tắt riêng được, không mặc định bật cho mọi loại (VD "info" có thể im lặng, "alarm" mặc định có âm thanh).

## 4. Chạy nền (quan trọng)

- Service worker MV3 có thể bị trình duyệt kill bất kỳ lúc nào → **không dùng `setTimeout`** cho bất kỳ nhắc nhở nào cần độ chính xác (đặc biệt Pomodoro).
- Dùng `chrome.alarms` cho mọi lịch trình định kỳ/hẹn giờ; khi alarm fire, background script gọi `notify()` trực tiếp — hoạt động dù NewTab không mở.

## 5. Quyền

- `notifications` permission xin **runtime**, đúng lúc user bật tính năng đầu tiên cần nó (VD lần đầu bật reminder cho Tasks) — không xin lúc cài đặt hay trong Onboarding mặc định.

## 6. Data model liên quan (IndexedDB)

Bảng `notifications-log` (xem thêm `../01d-storage-backup.md`): lưu lịch sử thông báo cho Notification Center, có `id, source, type, title, body, createdAt, readAt|null`.

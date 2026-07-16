# 09 — UI/UX: Animation & Quản lý Loading State

Đây là file quan trọng vì user ưu tiên trải nghiệm đẹp, mượt, và **không được để thành phần hiện ra ở trạng thái "vá lỗi" / dang dở**.

## 1. Nguyên tắc tổng quát

> **"Có thể load chậm, nhưng khi hiện ra phải hoàn thiện."**

Nghĩa là: không hiển thị 1 component ở trạng thái nửa vời rồi tự "sửa" bố cục khi dữ liệu về sau (layout shift, ảnh vỡ rồi mới hiện, chữ nhảy vị trí...). Mỗi component có đúng 2 trạng thái hiển thị: **Skeleton hoàn chỉnh** (đúng kích thước/bố cục cuối cùng) → **Nội dung thật hoàn chỉnh**. Không có trạng thái trung gian lộn xộn.

## 2. Chiến lược theo loại dữ liệu

| Loại | Chiến lược |
|---|---|
| Dữ liệu local tức thời (settings, theme, layout đã lưu) | Render ngay, không cần skeleton — nên có sẵn trước khi React mount nếu có thể (đọc từ `chrome.storage.local` cache nhanh trước khi Dexie load xong đầy đủ) |
| Ảnh/video wallpaper | Hiện placeholder màu nền lấy từ token theme đang chọn ngay lập tức → khi ảnh decode xong, **crossfade** sang ảnh thật (không "pop" đột ngột) |
| Dữ liệu mạng (weather, news, calendar, github, spotify) | Skeleton đúng layout cuối (khung chữ nhật mờ đúng kích thước dòng text/card thật) → khi có dữ liệu, fade-in nội dung thật tại chỗ, không thay đổi kích thước khung chứa |
| Danh sách dài (news, bookmark nhiều item) | Skeleton nhiều dòng ngay từ đầu theo số lượng ước tính hợp lý (ví dụ 5 dòng), khi data về nếu ít hơn/nhiều hơn thì animate thêm/bớt mượt chứ không "giật" |

## 3. Thứ tự xuất hiện khi mở tab mới (Staggered Reveal có chủ đích)

Thay vì mọi thứ pop cùng lúc hoặc theo thứ tự ngẫu nhiên do race condition mạng, định nghĩa **thứ tự cố định, có chủ đích**:

1. Wallpaper (placeholder màu → ảnh thật ngay khi sẵn sàng) — nền trước tiên.
2. Center zone: Clock (tức thời) + Search bar (tức thời).
3. Quick Access bar (bookmark).
4. Trigger icon 2 sidebar (trái/phải) — luôn xuất hiện, không phụ thuộc panel bên trong đã load xong hay chưa.
5. Nội dung bên trong panel/tool chỉ load khi user thực sự mở nó ra (lazy — không tải trước toàn bộ khi mở tab, trừ dữ liệu MVP đã liệt kê ở trên).

- Mỗi nhóm xuất hiện cách nhau ~50-80ms (stagger nhẹ, đủ để mắt cảm nhận nhịp điệu, không đủ để cảm thấy chậm).
- Dùng Framer Motion `AnimatePresence` + `staggerChildren` cho nhóm elements ở center/quick-access, còn lại dùng CSS transition thuần cho các phần tương tác nhỏ (hover, toggle) để nhẹ hơn.

## 4. Animation Guidelines chung

| Loại tương tác | Thời lượng | Easing gợi ý |
|---|---|---|
| Hover (bookmark, icon) | 120-180ms | ease-out |
| Mở/đóng panel sidebar | 250-300ms | cubic-bezier(0.16, 1, 0.3, 1) (kiểu "ease-out-expo" mượt) |
| Mở/đóng window (tool) | 200ms | ease-out, kèm scale từ vị trí icon gốc |
| Chuyển theme | 300ms | ease-in-out (crossfade token màu) |
| Chuyển wallpaper | 400-600ms | ease-in-out crossfade |
| Onboarding chuyển bước | 300ms | ease-out, slide ngang |

- **Low-power mode**: khi bật, giảm toàn bộ thời lượng animation về gần tức thời (~50ms hoặc tắt hẳn transition không thiết yếu), tắt particle/hiệu ứng nền theme, tắt video wallpaper.
- Luôn tôn trọng `prefers-reduced-motion` của hệ điều hành — tự động vào chế độ tương đương Low-power mode cho animation (không nhất thiết tắt hết tính năng, chỉ giảm chuyển động).

## 5. Quản lý State (kỹ thuật)

- Mỗi feature có store Zustand riêng với shape thống nhất:
  ```ts
  type AsyncState<T> = {
    status: "idle" | "loading" | "success" | "error";
    data: T | null;
    error?: string;
    lastFetchedAt?: number;
  };
  ```
- Component chỉ render 1 trong 2 nhánh: `status !== "success"` → Skeleton/placeholder đúng kích thước; `status === "success"` → nội dung thật. Không render nội dung thật "một phần" khi `data` chưa đầy đủ.
- Cache theo `lastFetchedAt` + TTL riêng từng loại dữ liệu (weather ~15-30 phút, news ~15 phút, github contribution ~1 giờ...) để tránh gọi API thừa mỗi lần mở tab, đồng thời giúp hiển thị dữ liệu cache ngay lập tức (rồi âm thầm refetch nền) thay vì luôn phải chờ loading.
- **Stale-while-revalidate pattern** khuyến nghị: hiện dữ liệu cache cũ ngay (không phải skeleton) nếu còn trong TTL hoặc gần hết hạn, đồng thời fetch mới nền; chỉ hiện skeleton khi hoàn toàn chưa có cache (lần đầu tiên).

## 6. Cache khi mất mạng (offline)

Helper chung `core/net` (`swr()`, `useOnlineStatus()`, `readCache/writeCache`) để mọi feature mạng dùng lại thay vì tự viết:
- Cache lưu ở `localStorage` (đọc **đồng bộ** ngay frame đầu, trước khi Dexie hydrate xong) theo namespace + key (VD `weather` + `city:hanoi`).
- Khi **mất mạng** (`navigator.onLine === false` hoặc fetch fail): **không thử gọi mạng**, giữ nguyên dữ liệu cache cũ và hiển thị chỉ báo nhẹ "Ngoại tuyến — dữ liệu đã lưu" (không hiện lỗi kỹ thuật).
- Tự động **fetch lại khi mạng trở lại** (lắng nghe event `online`) — feature chỉ cần phụ thuộc `useOnlineStatus()` trong effect.
- Áp dụng cho weather ở Phase 1; Phase 2+ (news, calendar, github, spotify) dùng chung cơ chế này.

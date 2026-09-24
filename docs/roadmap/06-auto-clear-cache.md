# Tool #6 — Auto Clear Cache/History

Chạy nền (background service worker), tự động dọn cache/lịch sử theo lịch đặt trước (không dùng `setInterval`). Chọn loại dữ liệu xoá (cache, cookie, history, form data, download history), tần suất, và một màn hình cấu hình + xem log các lần đã chạy.

Thư viện: không cần ngoài — `chrome.browsingData`, `chrome.alarms`, `chrome.storage`.

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool). Đây là tool **đơn giản nhất trong 8 cái** — không canvas, không engine riêng, không thư viện ngoài — nên file này ngắn hơn các file khác một cách có chủ đích, không phải làm qua loa.

## 1. Mô hình dữ liệu cốt lõi

```ts
interface ClearSchedule {
  enabled: boolean;
  frequency: "hourly" | "daily" | "weekly" | "onBrowserClose";
  dataTypes: {
    cache: boolean;
    cookies: boolean;
    history: boolean;
    formData: boolean;
    downloadHistory: boolean;   // chỉ xoá DANH SÁCH tải xuống, KHÔNG xoá file trên đĩa — xem §5
  };
  /** domain KHÔNG bị đụng tới — hạn chế của chrome.browsingData, xem §5 */
  excludedDomains: string[];
  lastRunAt: number | null;
}

interface ClearLogEntry {
  id: string;
  ranAt: number;
  trigger: "scheduled" | "manual";
  dataTypes: string[];          // snapshot loại dữ liệu đã xoá LẦN ĐÓ (lịch có thể đổi sau)
  success: boolean;
  errorMessage?: string;
}
```

**`excludedDomains` được lưu và hiển thị trong UI, nhưng KHÔNG được `chrome.browsingData` tôn trọng cho mọi loại dữ liệu** — nêu chi tiết ở §5, đây là hạn chế nền tảng phải biết trước khi thiết kế UI, không phải chi tiết code.

## 2. Luồng tương tác chính

Không có canvas — một màn hình cấu hình dạng form (giống `SettingsModal` đã có sẵn cho New Tab) + một danh sách log. "Mouse-first" ở quy mô này là: mọi lựa chọn bật/tắt/tần suất đều là control chuẩn (Toggle/Select có sẵn trong `shared/ui`), không có gì cần vẽ hay kéo.

1. **Màn hình cấu hình** (site app riêng, hoặc — cân nhắc — một mục trong `SettingsModal` hiện có thay vì site app mới, xem ghi chú cuối mục này): công tắc tổng "Bật tự động dọn", chọn tần suất (`Select`), danh sách 5 loại dữ liệu mỗi loại một `Toggle` riêng.
2. **"Dọn ngay"**: nút chạy thủ công tức thì, không đợi lịch — dùng đúng logic xoá giống lần chạy theo lịch, chỉ khác `trigger: "manual"` trong log.
3. **Xác nhận trước khi bật cookies**: riêng công tắc "Xoá cookie" khi bật lần đầu hiện cảnh báo tại chỗ (không phải modal chặn) — *"Xoá cookie sẽ đăng xuất bạn khỏi hầu hết trang web, kể cả trang bạn không muốn."* — vì đây là loại dữ liệu có hậu quả rõ rệt nhất, khác cache (vô hại, chỉ chậm tải lại).
4. **Danh sách domain loại trừ**: ô nhập thêm domain (Enter để thêm, giống tag input quen thuộc), mỗi domain có nút xoá — kèm dòng chú thích nhỏ nói rõ giới hạn: loại trừ chỉ áp dụng được cho cookie/site data theo domain cụ thể, KHÔNG áp dụng được cho cache/history (giải thích ở §5).
5. **Danh sách log**: bảng đơn giản (thời gian, loại dữ liệu đã xoá, thành công/lỗi), sắp xếp mới nhất trên đầu, giới hạn hiển thị ví dụ 50 dòng gần nhất.

**Ghi chú vị trí:** cân nhắc đặt tool này như một **mục mới trong `SettingsModal`** (New Tab) thay vì một site app riêng — nó gần với "cấu hình hệ thống" hơn là "công cụ mở ra dùng", và New Tab đã có sẵn khung form-driven cho đúng việc này (`defineSchema` + `SettingsForm` đã dùng cho mọi setting khác). Nếu chọn hướng đó, phần lịch/log vẫn cần code riêng (không phải setting đơn giản kiểu toggle), nhưng cấu hình chính (tần suất, loại dữ liệu) tận dụng được engine settings có sẵn thay vì tự vẽ form.

## 3. Component UI

| Component | Vai trò |
|---|---|
| `AutoClearCache.tsx` (hoặc mục trong `SettingsModal`, xem ghi chú §2) | Root cấu hình |
| `DataTypeToggles.tsx` | 5 `Toggle` cho từng loại dữ liệu, cảnh báo riêng cho cookie |
| `ScheduleSelect.tsx` | Chọn tần suất, dùng `Select` có sẵn |
| `ExcludedDomains.tsx` | Tag input thêm/xoá domain loại trừ + chú thích giới hạn |
| `ClearNowButton.tsx` | Chạy thủ công ngay, disable trong lúc đang chạy (dùng activity channel chung nếu thao tác đủ chậm để cần báo — thường `browsingData.remove` khá nhanh, có thể không cần) |
| `ClearLogTable.tsx` | Bảng log các lần đã chạy |
| `background/autoClear.ts` | Không phải component — đăng ký alarm, xử lý `chrome.alarms.onAlarm`, gọi `chrome.browsingData.remove()`, ghi log |

## 4. Undo/redo

**Không thể có, và không nên giả vờ có.** Dữ liệu bị `chrome.browsingData.remove()` xoá là xoá thật ở tầng trình duyệt — không có "hoàn tác" nào khôi phục lại cache/cookie/history đã mất (khác hẳn xoá một track trong Audio Editor, nơi dữ liệu vẫn nằm trong lịch sử snapshot). Đây chính là lý do UI phải xác nhận rõ **trước khi xoá** (đặc biệt cookie, mục 3 ở §2) thay vì dựa vào khả năng sửa sai sau đó — không có "sau đó" ở đây.

## 5. Rủi ro kỹ thuật cụ thể

**`chrome.browsingData` không hỗ trợ loại trừ theo domain cho mọi loại dữ liệu — đây là giới hạn nền tảng, không phải thiếu sót có thể code thêm để né.** API này xoá theo **loại dữ liệu + khoảng thời gian** (`since`), có tham số `originTypes` để phân biệt web thường/protected/extension nhưng **không có** tham số "trừ các domain sau" cho `cache`/`history`. Với `cookies`, thực tế cũng xoá theo `origins`/toàn bộ chứ Chrome extension API không cấp sẵn một danh sách allowlist domain gọn gàng qua `browsingData.remove` — cách khả thi duy nhất để thực sự "giữ đăng nhập vài trang" là loại trừ ở tầng khác (ví dụ chỉ xoá cookie của các domain **không** nằm trong `excludedDomains` bằng cách gọi `chrome.cookies.getAll()` + xoá từng cookie qua `chrome.cookies.remove()` theo từng domain một, **thay vì** dùng `browsingData.remove({cookies: true})` một phát cho tất cả) — phức tạp hơn nhiều, và chỉ áp dụng được cho cookie, không áp dụng được cho cache/history (hai loại này Chrome không cấp API xoá theo domain riêng lẻ ở mức extension). **Phải nói thẳng giới hạn này trong UI** (đã ghi ở mục 4, §2) thay vì để người dùng tưởng "loại trừ domain" bảo vệ được mọi loại dữ liệu.

**"Download history" chỉ là DANH SÁCH đã tải, không phải file trên đĩa.** `chrome.browsingData.remove({ downloadHistory: true })` xoá các dòng trong `chrome://downloads`, **không đụng tới file thật đã tải về máy** — nhãn trong UI phải ghi đúng "Xoá lịch sử tải xuống" chứ không phải "Xoá file đã tải", tránh hiểu lầm nghiêm trọng (người dùng có thể tưởng file bị xoá và hoảng khi tìm không thấy, dù thực ra chỉ mất bản ghi).

**Không dùng `setInterval`, đúng yêu cầu đề bài — vì service worker bị huỷ định kỳ khiến `setInterval` không đáng tin cậy, y hệt lý do đã áp dụng cho `GITHUB_ALARM` trong `background.ts` hiện có.** `chrome.alarms.create(name, { periodInMinutes })` là cơ chế đúng, đã có tiền lệ ngay trong `background.ts` của dự án — thêm một alarm mới (`"auto-clear"`) vào cùng listener `onAlarm` hiện có, không tạo file router riêng. Lưu ý: `periodInMinutes` tối thiểu Chrome cho phép là 1 (hoặc 0.5 ở một số bản cũ hơn với cảnh báo) — tần suất "hourly" map thẳng `periodInMinutes: 60`, còn "onBrowserClose" **không dùng alarm** mà dùng `chrome.runtime.onSuspend` hoặc theo dõi `chrome.windows.onRemoved` khi cửa sổ cuối cùng đóng — cơ chế khác hẳn, cần tách nhánh code riêng, không cố ép vào chung khung alarm.

**`chrome.browsingData.settings()` cho biết chính sách quản trị (enterprise policy) đang chặn loại dữ liệu nào** — nếu máy người dùng bị policy công ty khoá không cho xoá history, gọi `remove({history: true})` sẽ thất bại âm thầm hoặc bị bỏ qua tuỳ phiên bản Chrome. Gọi `settings()` trước để biết `dataRemovalPermitted` cho từng loại, disable đúng các `Toggle` tương ứng trong UI kèm chú thích "Bị chính sách hệ thống chặn" thay vì để người dùng bật một công tắc không có tác dụng gì.

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | Cấu hình cơ bản (loại dữ liệu, tần suất qua `chrome.alarms`), "Dọn ngay", log tối giản | Cao/Thấp — toàn bộ giá trị cốt lõi, không có gì phức tạp về kỹ thuật |
| 2 | Cảnh báo cookie, kiểm tra `browsingData.settings()` trước khi cho bật loại bị policy chặn | Trung bình/Thấp — tránh trải nghiệm gây hiểu lầm/vô tác dụng |
| 3 | Loại trừ domain cho cookie (qua `chrome.cookies`, không phải `browsingData`) | Trung bình/Trung bình — giá trị thật cho ai muốn giữ vài trang đăng nhập, nhưng chỉ áp dụng được cho cookie như đã nêu ở §5 |

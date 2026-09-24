# Tool #4 — Web Activity Time Tracker

Ghi nhận trang web truy cập thường xuyên + thời gian dùng mỗi trang, chạy nền trong service worker. Bắt buộc tránh race condition khi mở song song nhiều tab/cửa sổ — **chỉ một "phiên đang mở" đúng tại một thời điểm**. Dashboard xem tổng hợp theo domain/ngày/tuần.

Thư viện: không cần ngoài — `chrome.tabs`/`chrome.windows`/`chrome.idle`, Web Locks API, Dexie.

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool). Đây là tool duy nhất trong 8 cái mà **phần khó nhất không phải UI** — dồn phần lớn ngân sách thiết kế vào §1 và §5.

## 1. Mô hình dữ liệu cốt lõi

Hai bảng, tách theo đúng lý do tách bảng của Audio Editor (metadata nhẹ, ghi thường xuyên / dữ liệu tổng hợp đọc thường xuyên) — nhưng ở đây tách vì **tần suất ghi khác nhau**, không phải vì kích thước:

```ts
interface ActivitySession {
  id: string;
  domain: string;          // "github.com" — chuẩn hoá bỏ "www.", bỏ query/hash
  url: string;              // URL đầy đủ của trang lúc bắt đầu phiên, cho danh sách "gần đây"
  title: string;
  tabId: number;
  windowId: number;
  startedAt: number;
  endedAt: number | null;   // null = phiên ĐANG MỞ — chỉ được có TỐI ĐA MỘT dòng null tại một thời điểm
  activeMs: number;         // cộng dồn thời gian THẬT SỰ active (trừ lúc hệ thống idle/khoá màn hình)
}

interface DailyTotal {
  id: string;         // `${domain}|${dateISO}`
  domain: string;
  date: string;        // "2026-09-23"
  totalMs: number;
  visits: number;      // số phiên đã gộp vào ngày này
}
```

**Vì sao có `DailyTotal` riêng thay vì luôn tính trực tiếp từ `ActivitySession`.** Dùng cả năm, số dòng `ActivitySession` (mỗi lần chuyển tab là một dòng) dễ lên tới hàng chục nghìn — truy vấn "tổng theo domain 90 ngày qua" mỗi lần mở dashboard bằng cách quét hết session thô sẽ chậm dần theo thời gian dùng, đúng kiểu bug "càng dùng lâu càng ì" khó phát hiện sớm. `DailyTotal` là bảng **gộp sẵn**, cập nhật bởi một alarm nền (xem §5), giữ dashboard nhanh bất kể lịch sử dài bao nhiêu; `ActivitySession` chỉ cần giữ **gần đây** (ví dụ 30 ngày) rồi dọn, đủ cho "danh sách vừa ghé qua" mà không phải kho lưu trữ vĩnh viễn.

**Phiên đang mở sống ở `chrome.storage.session`, không phải biến JS trong service worker.** Đây là điểm mấu chốt của cả thiết kế — nêu chi tiết ở §5, không nhắc lại ở đây.

## 2. Luồng tương tác chính

Phần **ghi nhận** không có tương tác chuột nào — nó chạy hoàn toàn nền, không UI, đúng bản chất "time tracker". Phần **có UI** là dashboard, và ở đây "mouse-first" nghĩa là biểu đồ/danh sách phải thao tác được trực tiếp bằng chuột (hover xem chi tiết, click lọc), không phải chỉ đọc số tĩnh.

1. **Chọn khoảng thời gian**: thanh chuyển đổi "Hôm nay / Tuần này / 30 ngày" (giống `Segmented` đã có trong `shared/ui`), mỗi lựa chọn đổi truy vấn `DailyTotal` trong khoảng tương ứng.
2. **Biểu đồ thanh ngang theo domain** (top N domain dùng nhiều thời gian nhất trong khoảng đã chọn): hover một thanh hiện tooltip số phút chính xác + số lần ghé; **click một thanh** lọc toàn bộ dashboard xuống chỉ domain đó (breadcrumb "← Tất cả" để quay lại) — không cần trang riêng, lọc tại chỗ.
3. **Biểu đồ theo ngày** (khi đang lọc một domain, hoặc xem "tất cả" gộp lại): cột theo ngày trong tuần/tháng, hover xem tổng ngày đó.
4. **Danh sách "gần đây"**: các `ActivitySession` mới nhất (từ bảng chưa gộp), mỗi dòng có favicon (suy từ domain qua `chrome://favicon` hoặc Google's favicon service tự host lại — xem rủi ro §5), thời lượng, giờ bắt đầu — **click một dòng để mở lại đúng URL đó trong tab mới**, đúng tinh thần "chuột làm được mọi việc".
5. **Loại trừ domain khỏi theo dõi**: danh sách domain (ví dụ trang ngân hàng, trang nhạy cảm) người dùng gạt công tắc "Không theo dõi" — session tương lai của domain đó bị bỏ qua ngay từ tầng ghi nhận (không phải lọc ở dashboard, để dữ liệu thật sự **không bao giờ được ghi** — đúng kỳ vọng riêng tư của một tính năng "theo dõi bản thân").
6. **Xoá dữ liệu**: nút "Xoá toàn bộ lịch sử" trong màn hình cài đặt của tool (không phải trên dashboard chính, tránh bấm nhầm) — xoá cả hai bảng, có xác nhận.

## 3. Component UI

| Component | Vai trò |
|---|---|
| `TimeTrackerDashboard.tsx` | Site app root — quản khoảng thời gian đang chọn + domain đang lọc |
| `RangeSwitch.tsx` | Hôm nay/Tuần/30 ngày, dùng `Segmented` có sẵn |
| `DomainBarChart.tsx` | Thanh ngang theo domain, click để lọc — theo hướng dẫn `dataviz` skill của dự án cho màu/trục/tooltip nếu có |
| `DailyBarChart.tsx` | Cột theo ngày, đổi theo domain đang lọc |
| `RecentSessionsList.tsx` | Danh sách phiên gần đây, click mở lại URL |
| `ExcludedDomainsSettings.tsx` | Danh sách domain loại trừ + công tắc bật/tắt — sống trong màn hình cài đặt riêng của tool, không trên dashboard |
| `background/activityTracker.ts` | **Không phải component** — module chạy trong `background.ts`, xem §5 |

## 4. Undo/redo

**Không cần**, và không có gì tương tự để bàn. Dữ liệu là nhật ký sự kiện được hệ thống ghi tự động, người dùng không "biên tập" nó — thao tác duy nhất mang tính sửa đổi là loại trừ domain hoặc xoá lịch sử, cả hai đều có xác nhận tại chỗ, không cần undo riêng theo nghĩa Ctrl+Z.

## 5. Rủi ro kỹ thuật cụ thể

**Đây là phần quan trọng nhất của cả thiết kế.** MV3 service worker có thể bị trình duyệt **huỷ tiến trình bất cứ lúc nào** khi rảnh (thường sau khoảng 30 giây không hoạt động) và khởi động lại từ đầu khi có sự kiện mới — nghĩa là **biến JS thường trong `background.ts` không tồn tại đáng tin cậy**. Một biến `let currentSession = null` để nhớ "phiên đang mở" sẽ mất sạch bất cứ lúc nào giữa hai sự kiện, và service worker khởi động lại sẽ không biết có phiên nào đang mở hay không.

Cách né: **trạng thái "phiên đang mở" phải sống trong `chrome.storage.session`** (bộ nhớ nhanh, sống hết phiên trình duyệt, KHÔNG persist qua lần khởi động lại trình duyệt — đúng ngữ nghĩa "phiên", và đúng API đã có tiền lệ trong chính dự án ở [`core/handoff`](../../src/core/handoff/index.ts), kể cả phần rơi về `storage.local` + TTL trên Firefox MV2 do MV2 không có `storage.session` — tái dùng luôn helper đó thay vì viết lại). Mọi thao tác "đóng phiên cũ, mở phiên mới" đọc-sửa-ghi state này.

**Race condition thật sự xảy ra ở đâu, cụ thể.** `chrome.tabs.onActivated` (chuyển tab), `chrome.windows.onFocusChanged` (chuyển cửa sổ), và `chrome.tabs.onUpdated` (URL đổi trong cùng tab, ví dụ điều hướng SPA) đều có thể bắn gần như đồng thời — ví dụ user Alt-Tab sang cửa sổ khác đúng lúc trang cũ đang điều hướng. Nếu handler của cả hai sự kiện cùng chạy đoạn "đọc phiên đang mở từ storage → tính `endedAt`/`activeMs` → ghi session cũ vào Dexie → ghi phiên mới vào storage" mà không có khoá, cả hai có thể đọc **cùng một trạng thái cũ**, dẫn tới hai phiên "đang mở" (`endedAt: null`) tồn tại song song, hoặc một phiên bị ghi đè mất `activeMs` đã tích luỹ.

Cách né: **bọc toàn bộ chuỗi đọc-sửa-ghi trong một `navigator.locks.request("activity-session", async () => { ... })`.** Web Locks API chạy được trong ngữ cảnh service worker của Chrome hiện đại (đây là điều cần **xác nhận lại bằng thực nghiệm lúc code**, không giả định suông — nếu vì lý do gì đó không khả dụng ở phiên bản trình duyệt mục tiêu, phương án lùi là tự cài một khoá đơn giản bằng chính `chrome.storage.session` — ghi một token ngẫu nhiên, đọc lại xác nhận đúng token của mình trước khi tiếp tục, một dạng compare-and-swap thủ công). Mọi handler sự kiện (activated/focusChanged/updated/removed) đều đi qua đúng một hàm `switchSession(next)` được khoá bằng cơ chế này — không có đường tắt nào gọi thẳng vào storage mà bỏ qua khoá.

**Idle/khoá màn hình không nên tính là thời gian dùng.** `chrome.idle.onStateChanged` (cần quyền `idle`, hiện **chưa khai** trong `wxt.config.ts` — phải thêm) báo ba trạng thái `active`/`idle`/`locked`. Khi chuyển sang `idle`/`locked`, tool **không đóng phiên** (tab vẫn đang mở đúng nghĩa) nhưng dừng cộng dồn `activeMs` — dùng một mốc `pausedAt`, khi quay lại `active` thì trừ khoảng đã tạm dừng ra khỏi phép tính, không cộng nhầm "thời gian máy khoá" thành "thời gian đọc trang".

**Quyền `tabs` là chi phí thật, không lảng tránh được.** Muốn thấy `url`/`title` của MỌI tab (không chỉ tab đang active) để biết domain nào đang mở ở tab nền, cần quyền `tabs` trong manifest — `activeTab` (đang dùng cho embed tool) chỉ cấp quyền cho đúng tab người dùng vừa tương tác, không đủ cho một trình theo dõi hoạt động nền. Quyền `tabs` tạo cảnh báo cài đặt kiểu "xem các tab và lịch sử duyệt web của bạn" — đối lập với nguyên tắc §2.6 của file tổng quan ("không cảnh báo đọc toàn bộ trang web"). Đây là **đánh đổi cần người dùng dự án tự quyết định khi bắt tay code tool này**, không phải điều có thể thiết kế để né hoàn toàn — bản chất chức năng đòi hỏi đúng quyền đó. Có thể giảm nhẹ bằng cách đặt `tabs` trong `optional_permissions` và chỉ xin lúc user chủ động bật tính năng này lần đầu (qua `requestPermissions` đã có sẵn) thay vì bắt buộc lúc cài extension.

**Favicon của domain không có API "lấy favicon của URL bất kỳ" nội bộ đáng tin cậy trong MV3 mà không có quyền host.** `chrome://favicon/` cũ đã bị thu hẹp quyền truy cập ở MV3 (cần khai `chrome://favicon/` trong CSP `img-src` hoặc dùng API `chrome.action.setIcon`-adjacent, tuỳ bản Chrome) — cách chắc ăn hơn và không cần thêm quyền: dùng chính `favIconUrl` mà `chrome.tabs.query()` trả về sẵn cho từng tab (miễn đã có quyền `tabs`), lưu lại đúng URL đó trong `ActivitySession` thay vì cố tự suy ra favicon từ domain sau này.

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | Ghi nhận nền đúng đắn: một phiên mở tại một thời điểm, khoá bằng Web Locks + `storage.session`, xử lý idle | Cao/Cao — đây là toàn bộ giá trị kỹ thuật của tool; làm sai thì mọi số liệu sau này đều không đáng tin |
| 2 | Dashboard cơ bản: tổng theo domain, danh sách gần đây | Cao/Thấp — một khi dữ liệu đúng, hiển thị nó không khó |
| 3 | Alarm gộp `DailyTotal` + dọn `ActivitySession` cũ | Trung bình/Thấp — cần thiết để dùng lâu dài không chậm dần, nhưng không cấp bách ở tuần đầu dùng thử |
| 4 | Loại trừ domain, biểu đồ theo ngày, mở lại URL từ danh sách | Trung bình/Thấp — hoàn thiện trải nghiệm sau khi lõi đã chạy đúng |

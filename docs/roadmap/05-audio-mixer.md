# Tool #5 — Audio Mixer

Mở bằng popup (click icon extension), **không phải site app**. Liệt kê tab đang phát âm thanh, mute/unmute từng tab, click để nhảy tới tab đó. Mức nâng cao (tuỳ chọn): volume riêng từng tab qua `chrome.tabCapture`.

Thư viện: không cần ngoài cho mức cơ bản; `chrome.tabCapture` + `chrome.offscreen` cho mức nâng cao.

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool) — **đặc biệt §2.3**, vì đây là tool đầu tiên dùng registry mới (popup widget) thay vì site-registry/embed-registry.

## 1. Mô hình dữ liệu cốt lõi

Không lưu trữ gì — toàn bộ state suy trực tiếp từ `chrome.tabs.query({ audible: true })` mỗi lần popup mở, không có "dự án" hay "phiên làm việc" nào cần nhớ giữa các lần mở popup (popup của Chrome bị huỷ hoàn toàn mỗi khi đóng — không có vòng đời để giữ state qua đó).

```ts
interface MixerTab {
  tabId: number;
  windowId: number;
  title: string;
  favIconUrl?: string;
  audible: boolean;      // đang thực sự phát ra âm thanh ngay lúc này
  muted: boolean;         // đã bị mute (có thể mute mà vẫn audible=true — Chrome vẫn báo audible dù đang mute)
  /** chỉ có ở mức nâng cao — undefined nghĩa là chưa capture, dùng volume gốc của tab */
  capturedVolume?: number;  // 0..2 (100% = 1), điều khiển qua GainNode trong offscreen document
}

interface MixerState {
  tabs: MixerTab[];
  advancedAvailable: boolean;   // đã có quyền tabCapture + offscreen hay chưa
}
```

**Vì sao không có store Dexie.** Đây là bảng điều khiển tức thời cho trạng thái *hiện tại* của trình duyệt — lưu lại "tab nào đã mute" không có ý nghĩa vì `tabId` không tồn tại bền vững qua các lần mở trình duyệt (đóng tab, mở tab mới, ID khác hoàn toàn). Trạng thái mute/volume thật sự đã nằm sẵn trong chính trình duyệt (`tab.mutedInfo`) — tool chỉ đọc và điều khiển nó, không nhân đôi thành một nguồn sự thật thứ hai dễ lệch.

## 2. Luồng tương tác chính

Không có canvas — đây là một danh sách điều khiển ngắn, toàn bộ nằm gọn trong khung popup 340px đã có. "Mouse-first" ở quy mô này đơn giản là: mọi hàng đều thao tác được bằng chuột, không có phím tắt nào cần thiết cho một danh sách 1-5 mục thường gặp.

1. **Mở popup** → widget Audio Mixer chỉ xuất hiện khi có ít nhất một tab `audible: true` (ẩn hoàn toàn nếu không có gì đang phát — không chiếm chỗ trong popup lúc không cần, đúng nguyên tắc "tính năng disable → không render" đã đặt ra cho toàn dự án).
2. **Mỗi tab đang phát** là một hàng: favicon, tên tab cắt ngắn, nút mute/unmute (icon loa gạch/loa thường, bấm để đảo trạng thái ngay — gọi `chrome.tabs.update(tabId, { muted: !muted })`).
3. **Click vào tên tab** (không phải vào nút mute) → `chrome.tabs.update(tabId, { active: true })` + `chrome.windows.update(windowId, { focused: true })`, và **đóng popup** (popup luôn đóng khi điều hướng đi nơi khác, hành vi mặc định của Chrome khi mất focus — không cần code thêm).
4. **Mức nâng cao, nếu đã bật** (xem §5 điều kiện bật): mỗi hàng có thêm một thanh trượt volume nhỏ (0-200%) bên dưới tên tab — kéo bằng chuột, cập nhật `GainNode.gain.value` trong offscreen document theo thời gian thực. Dùng `ValueSlider`-style "chỉ ghi khi thả chuột" **không áp dụng ở đây** — khác Audio Editor, đây là điều khiển trực tiếp một node đang phát, kéo tới đâu nghe thay đổi tới đó là đúng kỳ vọng của một mixer, ghi liên tục là đúng chứ không phải cần tránh.
5. **Tab không hỗ trợ mức nâng cao** (trang `chrome://`, trang nội bộ trình duyệt, một số trang có CSP riêng chặn capture): thanh trượt volume bị disable với tooltip giải thích, nút mute cơ bản (không cần `tabCapture`) vẫn hoạt động bình thường — **luôn có lối lùi về mức cơ bản** cho từng tab riêng lẻ, không phải tất-cả-hoặc-không-gì.
6. **Bật mức nâng cao lần đầu**: nút nhỏ "Bật điều khiển âm lượng riêng từng tab" ở cuối danh sách → gọi `requestPermissions({ permissions: ["tabCapture", "offscreen"] })` đã có sẵn trong `core/permissions.ts` → nếu được cấp, `advancedAvailable = true` từ lần mở popup sau.

## 3. Component UI

| Component | Vai trò |
|---|---|
| `AudioMixerWidget.tsx` | Component đăng ký vào popup widget registry (§2.3 file tổng quan) — root của tool |
| `MixerTabRow.tsx` | Một hàng: favicon, tên, nút mute, (nâng cao) thanh trượt volume |
| `EnableAdvancedButton.tsx` | Nút xin quyền `tabCapture`/`offscreen`, chỉ hiện khi `advancedAvailable === false` |
| `background/tabMixer.ts` | Không phải component — lắng nghe `chrome.tabs.onUpdated`/`onRemoved` để dọn offscreen document khi tab đóng (xem §5) |

## 4. Undo/redo

**Không áp dụng.** Mute/volume là điều khiển tức thời của một thiết bị đang chạy (tab đang phát), không phải chỉnh sửa một tài liệu — không có khái niệm "hoàn tác về trạng thái trước" có ý nghĩa ở đây, cũng như không ai kỳ vọng Ctrl+Z hoạt động trên nút mute của hệ điều hành.

## 5. Rủi ro kỹ thuật cụ thể

**Mức cơ bản hoàn toàn an toàn, không quyền nhạy cảm mới.** `chrome.tabs.query`/`chrome.tabs.update({ muted })` chỉ cần quyền `tabs` — vẫn là chi phí cảnh báo cài đặt giống đã nêu ở tool #4, nhưng ở đây phạm vi hẹp hơn nhiều (chỉ đọc `audible`/`title`/`favIconUrl`, không theo dõi lịch sử theo thời gian) nên rủi ro quyền riêng tư thấp hơn hẳn. Vẫn nên đặt `tabs` là `optional_permissions`, xin ngay khi user lần đầu mở popup và thấy widget này bị ẩn/disable kèm nút "Cấp quyền để dùng Audio Mixer" — không xin sẵn lúc cài.

**Service worker MV3 không có `AudioContext`/`document` — điều khiển âm lượng thật cần Offscreen Document, không thể làm trong `background.ts` trực tiếp.** `chrome.tabCapture.getMediaStreamId()` cấp một ID stream, nhưng để BIẾN nó thành âm thanh nghe được kèm `GainNode` chỉnh volume, cần một `AudioContext` thật — service worker (không có DOM) không chạy được API này. Cách né: `chrome.offscreen.createDocument()` (quyền `offscreen`, MV3 cung cấp sẵn đúng cho ca này) tạo một trang ẩn có DOM đầy đủ, nơi thật sự chạy `navigator.mediaDevices.getUserMedia({ audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId } } })` → `MediaStreamAudioSourceNode` → `GainNode` (điều khiển bởi slider) → `audioContext.destination`. Một offscreen document dùng chung cho mọi tab đang được capture (không tạo nhiều document), giữ một `Map<tabId, GainNode>` bên trong nó.

**Capture "cướp" luồng ra loa của tab — bắt buộc phải route lại qua `destination` để tab không bị câm.** Đây là điểm dễ hiểu sai nhất của `tabCapture`: sau khi capture, âm thanh gốc của tab **không tự phát ra loa nữa**, nó chỉ tồn tại dưới dạng `MediaStream` trong tay extension — nếu offscreen document không nối `GainNode` xuống `audioContext.destination`, tab sẽ **im lặng hoàn toàn**, đúng thứ ngược lại với "mixer". Route đúng (capture → gain → destination) là bắt buộc, không phải tối ưu.

**Chrome hiện biểu tượng "đang ghi âm/chia sẻ tab" khi một tab bị capture.** Đây là chỉ báo bảo mật của chính trình duyệt, không tắt được từ phía extension — người dùng sẽ thấy icon đỏ/chấm trên tab đang bị capture dù mục đích chỉ là chỉnh volume. Cần nói rõ điều này trong UI (tooltip ở thanh trượt volume: "Bật điều khiển riêng sẽ hiện icon 'đang chia sẻ' trên tab này") để không ai nghĩ đây là lỗi hay bị theo dõi ngoài ý muốn.

**Phải dọn capture khi tab đóng hoặc điều hướng, nếu không rò rỉ tài nguyên.** `chrome.tabs.onRemoved`/`onUpdated` (URL đổi) phải kích hoạt đóng đúng `MediaStreamTrack` và gỡ entry khỏi `Map<tabId, GainNode>` trong offscreen document — bỏ sót thì icon "đang chia sẻ" dính lại trên tab đã đóng/điều hướng đi nơi khác cho tới khi extension reload, và `AudioContext` tích luỹ node chết dần.

**`getMediaStreamId` chỉ dùng được trong ngữ cảnh có tương tác người dùng gần đây** (giống lưu ý về gesture-safe đã ghi trong chính `core/permissions.ts` cho `requestPermissions`) — gọi nó từ một callback bất đồng bộ xa lần bấm chuột gốc (ví dụ sau một `await` dài) có thể bị từ chối. Chuỗi "bấm nút bật nâng cao → xin quyền → capture tab đầu tiên" nên chạy liền mạch trong cùng một handler click, không tách qua nhiều bước async xen giữa.

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | Popup widget registry (hạ tầng dùng chung cho tool tương lai khác) + danh sách tab đang phát, mute/unmute, click để nhảy tab | Cao/Thấp — đúng yêu cầu cốt lõi đề bài, không quyền lạ, không thư viện ngoài |
| 2 | Mức nâng cao: offscreen document + `tabCapture`, volume riêng từng tab | Trung bình/Trung bình — giá trị thật cho ai hay nghe nhiều tab cùng lúc, nhưng rủi ro kỹ thuật (icon "đang chia sẻ", dọn tài nguyên) đủ lớn để tách hẳn giai đoạn, không làm chung với #1 |

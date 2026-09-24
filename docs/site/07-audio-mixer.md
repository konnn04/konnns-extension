# Audio Mixer — đã xây

Widget popup (không phải site app): liệt kê tab đang phát tiếng, mute/unmute, click để nhảy tới tab, và chỉnh âm lượng riêng cho tab đang mở.

Thiết kế gốc: [docs/roadmap/05-audio-mixer.md](../roadmap/05-audio-mixer.md). File này ghi những chỗ **bản xây thật khác bản thiết kế**, và vì sao.

## 1. Đính chính quan trọng: không chỉnh được âm lượng tab nền tuỳ ý

Roadmap §2 mô tả mỗi hàng trong danh sách đều có thanh trượt volume riêng. **Chrome không cho phép điều đó.** Trích thẳng tài liệu `chrome.tabCapture.getMediaStreamId`:

> `targetTabId` — *"Only tabs for which the extension has been granted the **activeTab** permission can be used as the target tab."*

`activeTab` chỉ được cấp cho tab mà người dùng vừa "invoke" extension lên — tức tab đang active lúc bấm icon. Các tab nền khác không nằm trong diện đó, nên `getMediaStreamId` với `targetTabId` của chúng sẽ thất bại.

**Cách làm thật, và vì sao vẫn dùng được:** thanh trượt chỉ hiện ở hàng của **tab hiện tại**. Nhưng capture **sống sót qua việc chuyển tab và điều hướng trong cùng tab** (`"Capture is maintained across page navigations within the tab, and stops when the tab is closed"`). Nên luồng dùng thực tế là:

> sang tab đang ồn → mở popup → kéo xuống 40% → chuyển đi làm việc khác, âm lượng vẫn giữ nguyên.

Đây đúng là cách các extension "volume booster" phổ biến hoạt động. Thứ không khả thi là "mixer bàn điều khiển" chỉnh mọi tab cùng lúc từ một danh sách — giả định đó của roadmap là chỗ sai, không phải thiếu sót khi triển khai.

Các tab còn lại trong danh sách vẫn mute/unmute bình thường (`chrome.tabs.update({muted})` không cần capture gì cả).

## 2. Ba ngữ cảnh, vì không ngữ cảnh nào làm được cả ba việc

| Ngữ cảnh | Việc | Vì sao không thể là chỗ khác |
|---|---|---|
| **Popup** (`TabVolumeControl.tsx`) | xin quyền + `getMediaStreamId` | chỉ ở đây mới có "invocation" trên tab; cả hai lời gọi đều phải nằm trong đúng handler click, không được trôi qua `await` dài |
| **Service worker** (`background/tabMixer.ts`) | vòng đời, dọn dẹp, nhớ gain | popup bị huỷ ngay khi đóng, không thể giữ state hay listener |
| **Offscreen document** (`entrypoints/offscreen/main.ts`) | `AudioContext` + `GainNode` | service worker MV3 không có DOM, không tạo được AudioContext |

Gain hiện hành lưu ở `chrome.storage.session` (không phải biến module): worker bị huỷ sau ~30s rảnh, mà popup mở sau đó vẫn phải hiện đúng vị trí thanh trượt.

## 3. Cạm bẫy đã xử lý

**Capture "cướp" luồng ra loa.** Sau khi capture, tab **không còn tự phát ra loa**; tiếng của nó chỉ tồn tại trong `MediaStream`. Nếu đồ thị không nối tới `audioContext.destination` thì tab **câm hoàn toàn** — ngược hẳn mục đích. Vì vậy mọi nhánh lỗi trong `startCapture` đều gỡ capture xuống thay vì để lại đồ thị dựng dở.

**Message tự dội về chính mình.** `runtime.sendMessage` phát tới *mọi* ngữ cảnh, kể cả chính background — mà các message chuyển tiếp cho offscreen dùng chung `type` với case trong background. Không có cờ `target: "offscreen"` và guard tương ứng ở đầu listener của `background.ts` thì worker sẽ tự trả lời message của chính nó, lặp vô hạn.

**Rò rỉ capture.** `tabs.onRemoved` và `tabs.onUpdated` (đổi URL) đều gọi `releaseTab` — thiếu bước này thì icon "đang chia sẻ" dính lại trên tab đã đóng/điều hướng đi, và node audio tích tụ dần.

**Offscreen document rảnh vẫn tốn chỗ.** Mỗi extension chỉ được một offscreen document; khi không còn tab nào được capture thì đóng nó lại (`closeOffscreenIfIdle`).

**Firefox không có offscreen document.** `supportsTabVolume()` kiểm tra trước; thiếu thì widget chỉ hiện mute/unmute, không hiện thanh trượt.

## 4. Quyền

| Quyền | Loại | Xin lúc nào |
|---|---|---|
| `tabs` | optional | lần đầu mở popup thấy có tab đang phát tiếng |
| `tabCapture`, `offscreen` | optional | ngay tại nút bật thanh trượt, theo từng tab |

Không có quyền nào bắt buộc lúc cài — đúng nguyên tắc ở `docs/architecture.md §7.3`.

## 5. Chưa kiểm chứng được — cần thử tay

Tôi không chạy được trình duyệt, nên phần sau chưa ai xác nhận:

1. Bật thanh trượt trên một tab YouTube → **tiếng vẫn nghe được** (đây là ca hỏng nguy hiểm nhất: nếu sai, tab câm).
2. Kéo trượt → âm lượng đổi ngay theo, 0% im hẳn, 200% to gấp đôi.
3. Chuyển sang tab khác rồi quay lại → mức âm lượng vẫn giữ.
4. Bấm nút hoàn tác (↺) → tab trở lại âm lượng gốc, icon "đang chia sẻ" biến mất.
5. Đóng tab đang capture → không còn icon chia sẻ dính lại ở đâu.
6. Mở popup lại sau đó → thanh trượt hiện đúng mức đã đặt trước.

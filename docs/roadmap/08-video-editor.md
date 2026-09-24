# Tool #8 — Video Editor

Cắt ghép video chuẩn, đơn giản, nhanh — phục vụ freelance TestIO và edit video cá nhân. Track video + track audio riêng (audio để lồng tiếng/nhạc nền). Trim/split, ghép nhiều clip nối tiếp, crop khung hình. Xuất MP4, WebM, GIF.

Thư viện: **mediabunny** (đã dùng sẵn trong dự án cho MP3/OGG), **gifenc** riêng cho GIF — xem vì sao bắt buộc phải tách ở §5.

Xem hạ tầng dùng chung ở [00-tong-quan.md §2](./00-tong-quan.md#2-hạ-tầng-dùng-chung--đọc-1-lần-áp-dụng-ở-cả-8-tool). Đây là tool **nặng nhất trong 8 cái** — làm sau cùng, hưởng lợi trực tiếp từ Audio Editor (mô hình clip/track, split live/offline, activity channel) và Image Editor (canvas UI, crop) đã có kinh nghiệm.

## 1. Mô hình dữ liệu cốt lõi

**Khác biệt nền tảng với Audio Editor, phải nói trước khi vào chi tiết:** Audio Editor giữ **buffer đã giải mã** (`AudioBuffer`) làm nguồn dùng chung cho mọi clip — khả thi vì cả một bài hát giải mã ra PCM chỉ vài trăm MB. Video giải mã ra khung hình thô thì **không khả thi giữ trong RAM** — vài phút video 1080p ở dạng RGBA thô là hàng chục GB. Nên "nguồn" ở đây **không phải** dữ liệu đã giải mã, mà là **chính file gốc** (`Blob`), và khung hình chỉ được giải mã **theo yêu cầu**, tại đúng lúc cần xem (một khung để hiển thị lúc kéo playhead) hoặc lúc xuất (toàn bộ, qua `mediabunny.Conversion`).

```ts
interface SourceFile {
  id: string;
  blob: Blob;                 // file gốc — KHÔNG BAO GIỜ giải mã trước và giữ lại
  kind: "video" | "audio";
  duration: number;
  width?: number;              // chỉ video
  height?: number;
}

/** Track video là MỘT DÃY TUẦN TỰ — không phải timeline tự do như Audio Editor. Lý do ở §2. */
interface VideoClip {
  id: string;
  sourceId: string;
  start: number;               // do chính engine tính lại từ thứ tự mảng + duration, không sửa tay trực tiếp
  offset: number;               // điểm bắt đầu đọc trong source
  duration: number;
  crop?: CropRectangle;         // { left, top, width, height } — đúng type của mediabunny, dùng thẳng không đổi tên
  rotate: 0 | 90 | 180 | 270;
  keepOwnAudio: boolean;        // false = bỏ tiếng gốc của clip này khỏi bản trộn cuối
}

/** Track audio là timeline TỰ DO — giống hệt Track/Clip của Audio Editor, nhưng thu nhỏ (không hiệu ứng, không speed) */
interface AudioOverlayClip {
  id: string;
  sourceId: string;
  start: number;                // đặt tự do trên timeline, không ràng buộc theo video
  offset: number;
  duration: number;
  gainDb: number;
  fadeIn: number;
  fadeOut: number;
}
interface AudioOverlayTrack {
  id: string;
  name: string;
  clips: AudioOverlayClip[];    // một lane, không chồng lấn NHAU trong cùng track — luật giống Audio Editor
  muted: boolean;
  volumeDb: number;
}

interface VideoProject {
  sources: Map<string, SourceFile>;
  videoClips: VideoClip[];       // ĐÚNG MỘT dãy — xem §2 vì sao không phải "nhiều track video"
  audioTracks: AudioOverlayTrack[];
  outputSize: { width: number; height: number };
}
```

**Vì sao track video là một dãy tuần tự (playlist), không phải timeline tự do như Audio Editor.** Audio cho phép nhiều track *vang lên cùng lúc, chồng lên nhau* — đó là bản chất của âm thanh nhiều lớp. Video thì tại một thời điểm chỉ có **đúng một khung hình được nhìn thấy** — không có "chồng lớp video nghe được cả hai" như audio. Cho phép đặt hai clip video chồng thời gian lên nhau, rồi phải giải quyết ai đè ai (như `resolveOverlaps` của Audio Editor), là giải một bài toán mà bản chất dữ liệu video không cần có. Nên `videoClips` là một **dãy có thứ tự**, `start` của mỗi clip **luôn được tính lại** từ tổng `duration` các clip đứng trước nó — kéo-thả để sắp xếp lại thứ tự (chèn/đẩy), không kéo tự do theo trục thời gian. Đây là điểm khác biệt kiến trúc quan trọng nhất so với Audio Editor, không phải một chi tiết nhỏ.

**Audio track vẫn tự do, vì lồng tiếng/nhạc nền đúng là thứ cần đặt tuỳ ý so với video** — mô hình ở đây là bản thu nhỏ của `Track`/`Clip` bên Audio Editor (không có hiệu ứng, không có speed) chứ **không import trực tiếp code của Audio Editor** — quy tắc "một tool = một thư mục" (eslint chặn `import` xuyên tool, §2.1 file tổng quan) áp dụng đúng ở ca này. Viết một bản nhỏ riêng cho đúng nhu cầu của Video Editor là lựa chọn đúng ở MVP; tách phần chung thật sự lên `@/core` (ví dụ một primitive `clip-timeline` dùng chung) là việc cân nhắc **sau**, khi cả hai tool đã tồn tại và thấy rõ phần nào thật sự trùng — tránh trừu tượng hoá sớm dựa trên một tool chưa viết dòng nào.

## 2. Luồng tương tác chính

**Hai đường xử lý tách biệt, giống hệt tinh thần "một đồ thị cho cả phát lẫn xuất" của Audio Editor nhưng áp ngược lại — ở đây PREVIEW và XUẤT cố tình đi hai đường khác nhau, và đó là quyết định đúng:**

- **Preview/phát thử**: dùng thẳng thẻ `<video>` gốc của trình duyệt — trình duyệt đã giải mã/phát video hiệu quả hơn bất kỳ điều gì tự dựng bằng WebCodecs theo thời gian thực. Đổi `src`/`currentTime` của `<video>` tại đúng ranh giới giữa hai clip liên tiếp để tạo cảm giác phát liền mạch qua nhiều clip — không có API trình duyệt nào ghép nhiều file video thành một luồng phát mượt sẵn, nên việc "chuyển clip" luôn có một khoảng dừng rất ngắn khi đổi `src`, chấp nhận được cho mục đích xem thử, không chấp nhận được cho bản xuất cuối (đó là lý do có đường thứ hai).
- **Xuất file**: đi qua `mediabunny.Conversion` — không tự giải mã/ghép bằng canvas theo thời gian thực, xem chi tiết ở §5. Xuất luôn **chậm hơn thời lượng video thật** (khác audio, nơi `OfflineAudioContext` có thể render nhanh hơn thời gian thực) — cần activity channel + % tiến trình có thật (`Conversion.onProgress` mediabunny cung cấp sẵn), không phải thanh vô định.

1. **Kéo-thả file video/audio** vào dropzone → đọc metadata (`Input` của mediabunny mở nhanh, không giải mã hết) → thêm vào cuối `videoClips` (nếu là video) hoặc tạo track audio mới (nếu là audio, hoặc người dùng chọn "thêm vào track nhạc nền" thay vì "thêm vào timeline chính").
2. **Timeline video** vẽ dạng dãy khối nối liền nhau theo chiều ngang (giống một hàng track của Audio Editor nhưng luôn khít nhau, không có khoảng trống giữa các clip — khoảng trống không có nghĩa với video: "không có gì để hiển thị" không phải trạng thái hợp lệ của một video output).
3. **Kéo header một clip để sắp xếp lại thứ tự**: thả vào giữa hai clip khác → chèn vào đó, mọi clip từ điểm chèn trở đi tính lại `start`. Không có "kéo tự do theo trục X" như Audio Editor — chỉ có "kéo để đổi thứ tự trong dãy", tương tác gần với kéo-thả sắp xếp danh sách hơn là kéo-thả trên timeline.
4. **Trim**: kéo mép trái/phải một clip — thu hẹp/mở rộng cửa sổ đọc trong `SourceFile`, các clip đứng sau tự dịch `start` theo (vì đây là dãy tuần tự, trim một clip luôn ảnh hưởng vị trí mọi clip sau nó — khác Audio Editor nơi trim chỉ ảnh hưởng đúng một clip).
5. **Split**: playhead đứng ở đâu, bấm Split (hoặc phím `S`, giữ đúng phím tắt Audio Editor đã dùng) → cắt clip tại đó thành hai, giống hệt `splitAt` của Audio Editor về bản chất (không copy dữ liệu, chỉ chia cửa sổ `offset`/`duration`) — chỉ khác là ở đây không có khái niệm "track thứ hai" để cắt song song.
6. **Crop**: chọn một clip → khung crop hiện đè lên khung xem trước (canvas riêng, giống `CropOverlay` của Image Editor) → kéo bằng chuột để chỉnh khung, áp dụng lưu vào `clip.crop` — **không destructive, không giải mã lại gì lúc này**, khung crop chỉ là bốn con số áp dụng lúc xuất.
7. **Track audio (lồng tiếng/nhạc nền)**: nằm dưới track video, y hệt Audio Editor — kéo để đặt vị trí tự do, kéo mép để trim, kéo slider track để chỉnh volume, tất cả không ràng buộc theo ranh giới clip video.
8. **Tắt tiếng gốc của một clip**: icon loa trên mỗi clip video (giống nút mute track của Audio Editor) — bật/tắt `keepOwnAudio`, để dùng nhạc nền thay hẳn tiếng gốc.
9. **Xuất**: chọn định dạng (MP4/WebM/GIF), với GIF thêm tuỳ chọn khoảng thời gian (GIF cả video dài là vô lý về dung lượng — mặc định giới hạn ví dụ 10 giây, cảnh báo nếu chọn dài hơn).

## 3. Component UI

| Component | Vai trò |
|---|---|
| `VideoEditor.tsx` | Site app root — quản `VideoProject`, điều phối preview vs export |
| `PreviewPlayer.tsx` | Bọc `<video>`, đổi `src`/`currentTime` theo playhead, xử lý chuyển clip |
| `ScrubCanvas.tsx` | Vẽ một khung hình tại vị trí playhead khi **đang tạm dừng** (không phát) — giải mã theo yêu cầu qua `VideoSampleSink`, không phát qua `<video>` lúc đang kéo playhead vì kéo nhanh sẽ gọi decode liên tục, cần debounce |
| `VideoTrackRow.tsx` | Dãy clip video nối liền, kéo-thả sắp xếp, trim, split, icon mute từng clip |
| `AudioOverlayRow.tsx` | Track audio tự do — tái dùng tư duy layout của `TimelineCanvas`/`TrackHeaders` bên Audio Editor (không tái dùng code) |
| `CropOverlay.tsx` | Khung crop đè lên `PreviewPlayer`/`ScrubCanvas` khi đang chỉnh một clip |
| `ExportDialog.tsx` | Chọn MP4/WebM/GIF, độ phân giải, (GIF) khoảng thời gian + cảnh báo dung lượng |
| `ActivityBanner` | Bản nâng cấp `core/activity` (§2.8 file tổng quan) — xuất video luôn cần thanh tiến trình % thật, không phải tuỳ chọn |

## 4. Undo/redo

**Snapshot, cùng lý do đã áp dụng cho Audio Editor — và đơn giản hơn, vì không có bước "hiệu ứng destructive sinh source mới" nào ở MVP.**

`VideoProject` là một cây nhỏ (danh sách clip, mỗi clip vài con số) tham chiếu tới `SourceFile` bằng `sourceId` — `sources` (map giữ `Blob`) không đổi qua các thao tác, giống hệt lý do snapshot rẻ ở Audio Editor (buffer chia sẻ theo tham chiếu, không copy). **Khác Audio Editor:** crop/trim/rotate ở đây **luôn** không phá huỷ (chỉ là con số áp dụng lúc xuất, không có bước "render ra source mới" nào cả trong MVP) — nghĩa là không cần cơ chế dọn "source mồ côi" (`sweepOrphanSources`) mà Audio Editor phải có cho hiệu ứng destructive. Undo/redo ở tool này vì vậy **đơn giản hơn** bản gốc, không phải một bản sao chép nguyên si.

Gộp theo cử chỉ đúng như mọi tool khác trong bộ này: kéo trim/sắp-xếp chỉ tạo **một** bước lịch sử khi thả chuột, không phải mỗi khung hình di chuyển.

## 5. Rủi ro kỹ thuật cụ thể

**`mediabunny.Conversion` gánh gần hết phần khó — nhưng chỉ khi rendering là một chuỗi clip nối tiếp trên một track, đúng như mô hình đã chọn ở §1.** Đã xác nhận trực tiếp trong package đang cài ở dự án (`node_modules/mediabunny`, không suy đoán): `Conversion` nhận `trim: {start, end}` (trim gần như miễn phí — mediabunny tự copy packet thẳng không giải mã lại khi cắt trùng keyframe, chỉ giải mã lại khi cắt giữa GOP), và `video: { crop, rotate, width, height, fit }` — cả crop lẫn rotate là tham số **có sẵn**, không phải thứ phải tự dựng bằng cách vẽ canvas từng khung. `composable: true` cho phép nhiều `Conversion` (mỗi clip một cái) cùng ghi nối tiếp vào **một** `Output` — đây chính là cơ chế "ghép nhiều clip nối tiếp": lặp qua `videoClips`, mỗi clip mở `Input` từ `BlobSource(sourceFile.blob)` riêng, `Conversion.init({ input, output, trim, video: {crop, rotate}, composable: true })`, `execute()` lần lượt — **không cần tự viết vòng lặp giải mã/mã hoá bằng tay ở MVP.**

**Trộn audio lồng tiếng/nhạc nền với tiếng gốc của clip là việc `Conversion` KHÔNG làm hộ — đây là phần khó thật sự duy nhất, phải tự làm, và phải tách hẳn giai đoạn.** Mỗi `Conversion` chỉ copy/transcode track audio của **một** input vào track audio output — không có API "trộn nhiều nguồn audio thành một track" ở tầng `Conversion`. Muốn `AudioOverlayTrack` (nhạc nền) thật sự **hoà cùng** tiếng gốc video (không phải nằm cạnh như hai track audio riêng trong file — hầu hết trình phát chỉ phát track audio đầu tiên, không hữu dụng), phải giải mã cả hai nguồn ra sample (`AudioSampleSink`), cộng mẫu theo đúng cách `dsp.ts` của Audio Editor đã làm cho việc mix nhiều track, rồi mã hoá lại bằng `AudioBufferSource`/`AudioSampleSource` — về bản chất là mang một phần công việc của Audio Editor's `render.ts`/`mixdown()` sang ngữ cảnh video. Đây là lý do roadmap (§6) đặt tính năng lồng tiếng/nhạc nền ở giai đoạn **sau cùng**, tách hẳn khỏi trim/split/crop/ghép nối (những việc `Conversion` đã lo sẵn).

**GIF không nằm trong danh sách định dạng xuất của mediabunny — đã xác nhận, không phải giả định.** Quét toàn bộ danh sách `OutputFormat` có trong package: chỉ có Mp3/Ogg/Wav/Flac/Adts (audio) và Mp4/WebM/Mkv/Mov/Cmaf/MpegTs/Hls (video) — **không có GIF**. Đây chính là lý do đề bài tự nêu "tuỳ chọn gifenc riêng nếu cần" — xác nhận đúng, không có cách nào xuất GIF chỉ bằng mediabunny. Đường đi: giải mã các khung hình cần thiết từ bản output MP4/WebM đã xuất (hoặc trực tiếp từ nguồn đã crop/trim, qua `CanvasSink`/`VideoSampleSink` của mediabunny lấy từng khung dạng có thể vẽ lên `<canvas>`), đưa từng khung RGBA vào bộ lượng tử hoá màu + mã hoá LZW của `gifenc` (thư viện JS thuần, không cần WASM/worker riêng — nhẹ, dễ tích hợp, không phát sinh rủi ro CSP nào mới ngoài những gì đã nêu chung cho toàn dự án).

**Phát thử nhiều clip liên tiếp qua `<video>` có độ trễ chuyển cảnh, không mượt tuyệt đối — cần nói rõ đây là giới hạn chấp nhận được của preview, không phải lỗi.** Đổi `src` của thẻ `<video>` luôn tốn một khoảng buffer/seek nhỏ (vài chục đến vài trăm ms tuỳ định dạng/kích thước file) — không có cách nào loại bỏ hoàn toàn bằng API trình duyệt tiêu chuẩn mà không tự dựng một pipeline giải mã+phát thời gian thực bằng WebCodecs (độ phức tạp không tương xứng giá trị cho một "xem thử trước khi xuất"). Nói rõ trong thiết kế để không ai ngộ nhận đây là bug cần vá bằng mọi giá — bản xuất cuối (đi qua `Conversion`, không qua `<video>`) không có vấn đề này.

**Giải mã một khung theo yêu cầu để vẽ preview lúc kéo playhead cần debounce, tương tự bài học `stretchedSource`/`ensureStretch` của Audio Editor.** Kéo playhead nhanh bắn hàng chục yêu cầu "lấy khung tại thời điểm T" mỗi giây — không debounce thì hàng đợi giải mã dồn ứ, canvas hiển thị trễ so với vị trí con trỏ thật (đúng lớp lỗi "kéo mà không thấy phản hồi ngay" đã gặp và sửa nhiều lần ở Audio Editor trong quá trình phát triển thực tế của dự án). Cách né: chỉ giải mã khung tại vị trí **cuối cùng** sau khi con trỏ dừng lại một khoảng ngắn (~50-100ms), huỷ yêu cầu giải mã đang treo nếu có yêu cầu mới hơn đến trước khi xong.

**Hiệu năng và bộ nhớ khi làm việc với video dài/nặng trong một tab trình duyệt.** Khác audio (một bài hát vài chục MB, cả file load một lần không vấn đề gì), video vài trăm MB đến vài GB **không nên** đọc toàn bộ vào bộ nhớ — `BlobSource` của mediabunny đọc theo range trực tiếp từ `Blob` (giống đọc file, không cần load hết trước), giữ đúng nguyên tắc đó xuyên suốt thay vì vô tình gọi `blob.arrayBuffer()` load hết một file video lớn ở đâu đó trong code (một lỗi hiệu năng dễ mắc phải khi copy công thức xử lý audio nhỏ sang ngữ cảnh video lớn).

## 6. Roadmap

| Giai đoạn | Nội dung | Giá trị/công sức |
|---|---|---|
| 1 | Nhập một video, trim/split, xuất MP4/WebM qua `Conversion` (chưa có ghép nhiều clip) | Cao/Trung bình — đã giải quyết ca dùng đơn giản nhất ("cắt bớt một đoạn video") với phần lớn việc do mediabunny lo |
| 2 | Ghép nhiều clip nối tiếp (dãy tuần tự, kéo-thả sắp xếp), crop, tắt tiếng gốc từng clip | Cao/Trung bình — đúng trọng tâm đề bài, vẫn dựa trên `Conversion`/`composable`, không cần tự giải mã |
| 3 | Preview mượt hơn (thẻ `<video>` đổi clip, scrub theo khung), activity channel cho xuất file | Trung bình/Trung bình — trải nghiệm, không mở khoá tính năng mới |
| 4 | Xuất GIF qua `gifenc` | Trung bình/Trung bình — độc lập với phần còn lại, làm được bất cứ lúc nào sau giai đoạn 2 |
| 5 | Track audio lồng tiếng/nhạc nền, trộn thật với tiếng gốc (giải mã-cộng mẫu-mã hoá tay) | Cao/**Cao** — giá trị thật cho ca dùng "lồng nhạc nền", nhưng là phần kỹ thuật nặng nhất của cả 8 tool trong bộ này; cố tình đặt cuối cùng, sau khi mọi phần dựa-vào-`Conversion` đã chạy ổn |

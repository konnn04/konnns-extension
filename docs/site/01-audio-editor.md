# Site app #1 — Sửa âm thanh

Trình sửa âm thanh nhiều track kiểu Audacity, chạy hoàn toàn trong trình duyệt. Route `site.html#/audio`.

Toàn bộ code nằm trong **một thư mục duy nhất**: [`src/features/site/audio-editor/`](../../src/features/site/audio-editor/) — xem hợp đồng "một tool = một thư mục" ở [00-tong-quan §4](./00-tong-quan.md#một-tool--một-thư-mục).

```
audio-editor/
├── index.tsx          đăng ký site app + lazy entry
├── AudioEditor.tsx    khung: toolbar, stage, transport, phím tắt
├── TrackHeaders.tsx   cột trái: tên track, M/S, volume, pan
├── EffectsPanel.tsx   ba phạm vi hiệu ứng (§5)
├── HistoryPanel.tsx   danh sách bước + nhảy + Chốt
├── ProjectManager.tsx màn hình mở project kiêm quản lý dung lượng (§7)
├── ExportDialog.tsx · ContextMenu.tsx · audio-editor.css
├── store.ts           zustand: project, history, selection, transport
├── engine/            thuần, KHÔNG React — chạy được dưới Node
├── timeline/          canvas renderer + hit test (thuần trừ 1 component)
└── tools/             xử lý chuột, mỗi tool một handler
```

Ranh giới quan trọng nhất: **`engine/` không biết gì về React hay store.** Đó là lý do phần lớn assertion của dự án nằm ở đây và chạy được bằng Node với một polyfill `AudioBuffer` tối giản.

## 1. Thư viện dùng và không dùng

| Việc | Giải pháp | Ghi chú |
|---|---|---|
| Vẽ timeline, waveform, clip | **Tự viết** trên `<canvas>` | Xem §3 — vì sao không có thư viện nào dùng được |
| Giải mã file vào | `AudioContext.decodeAudioData` | mp3/wav/ogg/flac/m4a tuỳ trình duyệt |
| Phát lại, trộn nhiều track | Web Audio thuần (`AudioBufferSourceNode` hẹn giờ) | Xem §4 |
| Cắt / fade / gain / normalize… | **Tự viết** trên `Float32Array` | Không có "Audacity trong 1 package" trên npm |
| Compressor / EQ / highpass | Node gốc của Web Audio | Nhanh hơn và kiểm chứng kỹ hơn bất cứ thứ gì ta tự viết |
| Xuất WAV | **Tự viết** ([`engine/wav.ts`](../../src/features/site/audio-editor/engine/wav.ts)) | 16 / 24-bit PCM + 32-bit float |
| Xuất MP3 | [mediabunny](https://mediabunny.dev) + `@mediabunny/mp3-encoder` (MPL-2.0) | LAME WASM, nạp bằng dynamic import |
| Xuất OGG | mediabunny, container Ogg + codec **Opus** | Encoder Opus **của chính trình duyệt** (WebCodecs) — không WASM, không tải thêm |
| Gói nhiều clip thành 1 file tải về | `fflate` | **Đã có sẵn** trong dự án (dùng cho backup) |

**MPL-2.0 của mediabunny** là copyleft mức file: dùng làm dependency không sửa đổi thì tương thích với dự án MIT này.

**WASM cần CSP.** MV3 chặn WebAssembly nếu thiếu `'wasm-unsafe-eval'` trong `content_security_policy.extension_pages` — đã khai báo trong [`wxt.config.ts`](../../wxt.config.ts). Thiếu dòng đó thì MP3 hỏng **im lặng**. OGG không đụng tới WASM (Opus encode qua WebCodecs native) nên không phụ thuộc dòng CSP này — điều đó **không** có nghĩa OGG luôn xuất được, chỉ nghĩa là lý do hỏng (nếu có) sẽ khác.

> **wavesurfer.js đã bị gỡ.** Bản đầu tiên dựng trên nó, nhưng mỗi instance wavesurfer vẽ **một dải sóng liền mạch** — không có khái niệm clip. [`wavesurfer-multitrack`](https://github.com/katspaugh/wavesurfer-multitrack) cũng không cứu được: đọc source thì mỗi track đúng **một** nguồn audio, không split, không clip — nó là trình phát mixer chứ không phải trình sửa.

## 2. Mô hình dữ liệu — project → track → clip

[`engine/project.ts`](../../src/features/site/audio-editor/engine/project.ts), dữ liệu thuần:

```ts
interface Clip {
  id: string;
  sourceId: string;   // trỏ vào kho source dùng chung
  start: number;      // vị trí trên timeline (giây)
  offset: number;     // cửa sổ vào trong source: bắt đầu từ đâu
  duration: number;   // cửa sổ dài bao nhiêu
  fadeIn: number; fadeOut: number; gainDb: number;   // non-destructive
  name: string;
}

interface Track {
  id: string; name: string; clips: Clip[];
  muted: boolean; solo: boolean; volumeDb: number; pan: number;
  effects: EffectInstance[]; height: number;
}

interface Project {
  sources: Map<string, AudioBuffer>;   // audio đã decode, NHIỀU clip dùng chung
  tracks: Track[];
  sampleRate: number;
  masterEffects: EffectInstance[];
}
```

**Điểm then chốt: clip chỉ là một cửa sổ trỏ vào source dùng chung.** Source là **bất biến**. Nhờ vậy:

- **split = O(1)** — tách thành hai clip cùng `sourceId`, khác `offset`/`duration`. Không copy một mẫu nào.
- **di chuyển / xoá / trim / fade = O(1)** — chỉ sửa vài con số.
- Khoảng trống giữa các clip biểu diễn được tự nhiên.
- **Không encode lại gì sau mỗi thao tác.**

### Vì sao phải viết lại mô hình cũ

Bản đầu giữ **một `AudioBuffer` duy nhất bị thay nguyên khối sau mỗi thao tác**, còn "split" chỉ là một mảng mốc thời gian vẽ đè lên dải sóng liền mạch. Bốn lỗi người dùng báo đều mọc ra từ đúng một giả định đó, và **không vá lẻ được**:

| Triệu chứng | Gốc rễ | Mô hình clip xử lý thế nào |
|---|---|---|
| Chỉnh gain xong playhead nhảy về đầu | Phải `load()` lại player sau mỗi thay đổi buffer | Không còn nạp lại nguồn — playhead đọc từ `ctx.currentTime` |
| Fade in/out không áp lên đoạn đã chọn | Vùng chọn bị xoá sau **mọi** thao tác nên hiệu ứng kế tiếp áp lên cả bài | Vùng chọn **sống sót** qua commit |
| Lag khi chỉnh gain / hiệu ứng | Mỗi thao tác encode lại toàn bộ buffer thành WAV để phát | Không còn encode trên đường nóng |
| Split không chọn / kéo được từng đoạn | Marker chỉ là số, không có đối tượng clip | Clip là đối tượng thật, chọn và kéo được |

### Undo/redo bằng snapshot

Mô hình cũ phải **replay** vì state là một buffer khổng lồ. Giờ state là **một cây JSON nhỏ** (buffer chỉ được tham chiếu, không copy), nên mỗi bước lịch sử chỉ cần snapshot cây đó — **undo tức thì, không phải tính lại gì**.

`sources` chỉ phình thêm khi có hiệu ứng destructive; đó là chỗ tốn RAM nên [`HistoryPanel`](../../src/features/site/audio-editor/HistoryPanel.tsx) có nút **Chốt** (flatten) để bỏ các bước cũ và cho phép thu hồi source mồ côi (§7.2).

Mỗi bước mang `label` dạng **khoá i18n + tham số** ([`engine/commands.ts`](../../src/features/site/audio-editor/engine/commands.ts)), không phải chuỗi cứng — dự án song ngữ, một danh sách lịch sử toàn tiếng Anh trong giao diện tiếng Việt còn tệ hơn không có nhãn.

## 3. Timeline tự vẽ

[`timeline/`](../../src/features/site/audio-editor/timeline/) — tách làm bốn để phần lớn logic test được bằng Node:

| File | Vai trò |
|---|---|
| `viewport.ts` | `pxPerSec` / `scrollLeft`, `timeAtX` / `xAtTime`, `trackLayout`, `fitPxPerSec`, `zoomAround`, `rulerStep` |
| `hitTest.ts` | toạ độ → `{ track, clip, vùng }`. **Hàm thuần, 49 assertion** |
| `draw.ts` | vẽ thước, thân clip, tiêu đề, đường fade. Hàm thuần nhận `ctx` |
| `TimelineCanvas.tsx` | component duy nhất — quản vòng đời canvas và pointer |

**Hai lớp canvas chồng nhau:** lớp dưới vẽ sóng + clip (chỉ vẽ lại khi project/zoom/scroll đổi), lớp trên vẽ playhead + vùng chọn (vẽ lại mỗi frame). Gộp một lớp thì kéo playhead sẽ vẽ lại toàn bộ sóng mỗi khung hình.

**Mọi state vẽ nằm trong `ref`, không phải `useState`.** Component đăng ký `useAudioEditor.subscribe` và tự gọi `requestPaint()` — cuộn, zoom, kéo clip, chạy playhead đều **không** làm React re-render. Đây là thứ đã sửa lỗi "lag khi cuộn / chỉnh âm lượng": mỗi khung hình trước đây kéo theo một lượt render cả cây component.

Peaks lấy từ [`engine/peaks.ts`](../../src/features/site/audio-editor/engine/peaks.ts), memo hoá theo buffer bằng `WeakMap` — clip chỉ cắt một lát từ mảng peaks của source, không quét lại mẫu. Buffer nào bị undo bỏ đi thì mang theo cache của nó, không cần invalidate tay.

### Hai cái bẫy của canvas (đều từng làm waveform trắng trơn)

- **`ctx.font` không đọc được biến CSS.** `"10px var(--font-mono, monospace)"` là giá trị không hợp lệ, canvas **bỏ qua im lặng**. Phải viết cả stack font ra literal.
- **`color-mix()` làm `fillStyle` cũng bị bỏ qua** — và canvas **giữ nguyên màu trước đó**, nên trên theme tối là đen trên nền đen. `readPalette()` dò từng giá trị bằng `canvasSafe()` trước khi dùng.

### Sóng vẽ qua effect của clip

Gain và fade là phép tính mà trình vẽ tự làm được. **Filter thì không**: không có cách nào suy ra một shelf Bass làm biến dạng waveform ra sao mà không thật sự chạy audio qua nó.

Nên [`effectPeaks.ts`](../../src/features/site/audio-editor/engine/effectPeaks.ts) render **đúng cửa sổ đang nhìn thấy** qua chuỗi effect bằng `OfflineAudioContext`, rồi lấy peaks và cache lại:

- Trình vẽ hỏi **đồng bộ**. Trượt cache thì nhận `null`, vẽ peaks thô, và được đánh thức khi bản đã xử lý về tới (`onEffectPeaks`). Waveform chưa-qua-filter trong chốc lát vẫn hơn timeline khựng mỗi lần kéo slider.
- **Debounce 180ms**, và request mới thay chỗ request đang chờ — kéo slider sinh một key mới mỗi pointer move, chỉ cái cuối đáng render.
- Cửa sổ dài quá `MAX_WINDOW_SECONDS` thì bỏ qua: lúc đó bạn đang zoom xa tới mức ảnh hưởng của filter lên hình vốn đã không thấy được.
- Có **pre-roll 0.25s** đưa vào filter rồi bỏ đi, để những pixel đầu không phải là transient lúc filter khởi động.
- Render **chỉ chuỗi effect**; gain/fade do trình vẽ nhân vào sau. Với filter tuyến tính thì chính xác (gain giao hoán với filter); với compressor là xấp xỉ, và đây là hình vẽ.

### Sóng vẽ qua envelope của clip

`drawWaveform` không vẽ peaks thô của source mà nhân qua `clipEnvelopeAt()` — gain của clip, uốn theo fade hai mép. Đây đúng là thứ `renderClip` bake vào mẫu, nên **hình và tiếng luôn kể cùng một câu chuyện**; trước đó kéo gain lên thì nghe to hơn mà sóng y nguyên, đọc như là "chẳng có gì xảy ra". Có test so thẳng giá trị vẽ với mẫu `renderClip` sinh ra.

Fader **volume của track thì không** làm đổi hình, giống Audacity/Reaper/Audition: nó là nút chỉnh mixer nằm sau clip, không phải nội dung của clip. Nếu fader cũng co giãn sóng thì kéo xuống −40 dB sẽ trông như audio biến mất, và hai track ở fader khác nhau hết so sánh được với nhau bằng mắt.

### Biên `[start, end)`

Clip chiếm `[start, end)`, nên con trỏ đặt **đúng** mép sau rơi ra **ngoài** clip — nghĩa là không bao giờ nắm được mép phải để trim đuôi. `hitTest` vì vậy tìm hai lượt: lượt đầu theo thời gian, lượt sau nới rộng theo `EDGE_GRAB_PX`. Lỗi này do test bắt được, không phải người dùng.

## 4. Phát lại và render — một đồ thị dùng cho cả hai

[`engine/render.ts`](../../src/features/site/audio-editor/engine/render.ts) dựng **đúng một** đồ thị tín hiệu, dùng cho **cả phát lại lẫn xuất file**:

```
clip → gain clip + fade → gain track → chuỗi effect track → pan → chuỗi master → ra
```

`scheduleProject(ctx, project, destination, options)` chạy trên `AudioContext` khi phát, và trên `OfflineAudioContext` khi xuất. **Cái nghe được đúng bằng cái nhận được** — không phải vì ta cẩn thận, mà vì không có đường thứ hai để lệch.

[`engine/playback.ts`](../../src/features/site/audio-editor/engine/playback.ts) — class `Playback`: `play` / `pause` / `seek` / `playRange` / `syncLive` / `dispose`. Playhead **suy ra từ `ctx.currentTime`**, không phải bộ đếm riêng.

**`syncLive` là thứ làm nên realtime.** Đồ thị dựng một lần lúc bấm play; khi user kéo volume/pan/tham số effect, `applyLiveParams(graph, project)` **chỉnh lại node đang chạy** thay vì dựng lại từ đầu. Không có nó thì mọi thay đổi chỉ nghe thấy ở lần phát sau — đúng lỗi "một số cái không áp dụng realtime".

## 5. Hiệu ứng — OOP, ba phạm vi

[`engine/effects/Effect.ts`](../../src/features/site/audio-editor/engine/effects/Effect.ts) — lớp cơ sở:

```ts
abstract class AudioEffect {
  abstract readonly id: string;
  abstract readonly nameKey: string;      // khoá i18n, không phải chuỗi cứng
  abstract readonly params: EffectParam[]; // UI sinh ra TỪ ĐÂY
  abstract readonly scopes: EffectScope[]; // "master" | "track" | "selection"

  build(ctx, params): EffectNodes | null   // node sống, cho phát lại
  update(nodes, params): void              // chỉnh lại node đang chạy
  render(buffer, params)                   // ghi ra mẫu, cho vùng chọn
}
```

**Thêm một hiệu ứng = viết một class, không sửa gì khác.** UI sinh ra từ mảng `params`, registry ([`engine/effects/index.ts`](../../src/features/site/audio-editor/engine/effects/index.ts)) tự gom theo `scopes`.

Mấu chốt nhất của lớp cơ sở: nếu effect có `build()` thì nó **tự động có `render()` miễn phí** qua `OfflineAudioContext`. Trước khi có cái này, highpass / presence / compressor được liệt kê ở tab Vùng chọn nhưng **không làm gì cả** — vì chúng chỉ có node sống, không có đường ghi ra mẫu. Cũng do test bắt.

### Control mặc định vs. effect thêm vào

Mỗi phạm vi có sẵn vài control **không gỡ được**, vì chúng là thuộc tính của chính đối tượng chứ không phải effect đặt lên nó:

| Phạm vi | Mặc định |
|---|---|
| Track | Volume · Balance · Speed |
| Tổng | Volume |
| Clip | Volume · Fade in · Fade out · Speed |

Chúng **không** nằm trong chuỗi effect, vì một track không có volume thì không còn là track — liệt kê chúng như effect xoá được là hứa một nút Remove không thể hoạt động.

### Sửa khi đang phát: retune hay dựng lại

`syncLive` chỉ vặn được **núm** trên các node đã tồn tại. Một clip đã được hẹn giờ thì cứ thế phát theo lịch cũ — nên dời clip, cắt, thêm clip hay đổi speed giữa lúc đang nghe **không có tác dụng gì** cho tới khi bấm play lại.

`scheduleSignature()` phân biệt hai nhóm:

| Nhóm | Ví dụ | Xử lý |
|---|---|---|
| Núm | volume track, pan, mute/solo, volume tổng, tham số effect | `syncLive` — gần như miễn phí |
| Cấu trúc | dời / cắt / thêm / xoá clip, trim, speed, volume clip, fade | `reschedule` — dựng lại graph từ đúng vị trí đang phát |

Dựng lại = dừng rồi phát tiếp từ `currentTime()`. Mối nối nằm gọn trong một biên buffer; DAW nào cũng làm đúng vậy khi bạn sửa lúc đang chạy.

**Nhưng dựng lại có thể cần một bản stretch chưa tồn tại.** Đổi speed làm hỏng bản cũ, vì cache khoá theo rate. Dựng nó bên trong `reschedule` nghĩa là chạy WSOLA đồng bộ từ một `commit` bình thường, không có banner nào gần đó — app đứng hình ngay giữa lúc đang phát.

Nên thứ tự là **dựng trước sau banner, rồi mới reschedule**. Nhạc vẫn chạy theo lịch cũ trong lúc đó, là phần dễ chịu. Nếu một sửa đổi mới hơn ập tới giữa chừng thì lượt này bỏ qua — commit kia đã tự khởi động vòng dựng-rồi-reschedule của nó, hai bên không giành nhau.

`stretchedSource` (bản đồng bộ) giờ là **đường cuối cùng**, không phải đường thường: mọi lối tương tác đều gọi `ensureStretch` trước. Thứ còn chạm tới nó là xuất file — vốn đã nằm dưới banner, và ở đó kết quả đúng quan trọng hơn một frame mượt.

### Speed: đổi độ dài, giữ nguyên audio

`duration` vẫn là độ dài **trên timeline**; cửa sổ nguồn clip đọc là `duration * speed`. Giữ `duration` ở đơn vị timeline chính là thứ cho phép hit test, vẽ và xử lý chồng lấn **không cần biết gì về speed** — chỉ ba chỗ chạm mẫu nguồn phải biết:

| Chỗ | Làm gì |
|---|---|
| `scheduleProject` | `playbackRate`, và offset/độ dài đều nhân theo rate |
| `renderClip` | trim cửa sổ nguồn rồi `resampleLinear` |
| `drawWaveform` | cửa sổ peaks nhân theo rate |

`setClipSpeed` **giữ nguyên cửa sổ nguồn** và đổi độ dài timeline — đó mới là nghĩa của "phát nhanh gấp đôi": cùng một đoạn audio, xong sớm hơn. Co cửa sổ lại thì sẽ âm thầm tráo sang audio khác.

`resampleLinear` cố tình đồng bộ: `renderClip` là hàm sync và mọi caller của nó sẽ phải thành async chỉ vì một khác biệt chất lượng không ai nghe ra khi đổi tốc độ. Phát lại và mixdown **không** đi qua đó — chúng dùng resampler của chính trình duyệt qua `playbackRate`.

### Giữ cao độ khi đổi tốc độ

`playbackRate` rút ngắn audio **và** kéo cao độ lên cùng lúc — hiệu ứng giọng chipmunk. Giữ cao độ nghĩa là phải tổng hợp lại tín hiệu ở một nhịp tiến khác, và Web Audio không có sẵn gì cho việc đó.

`dsp.timeStretch` là **WSOLA** (waveform similarity overlap-add). Overlap-add thường đã ra đúng *độ dài*, nhưng nối khung ở điểm bất kỳ sẽ phá tính tuần hoàn của sóng và kết quả bị rung. WSOLA sửa bằng cách xê dịch mỗi khung trong một dung sai nhỏ tới chỗ khớp nhất với tín hiệu đã ghi — để mối nối rơi đúng pha. Độ khớp tính trên kênh 0 rồi **dùng chung offset cho mọi kênh**; căn từng kênh riêng sẽ làm nhoè ảnh stereo.

Lúc phát, clip giữ cao độ đọc một **bản đã stretch sẵn ở rate 1**, vì `playbackRate` chính là thứ làm đổi cao độ. [`stretchCache.ts`](../../src/features/site/audio-editor/engine/stretchCache.ts) stretch **cả source** một lần cho mỗi rate chứ không theo cửa sổ từng clip — cửa sổ đổi mỗi lần trim, nên khoá theo cửa sổ sẽ vứt công đi liên tục. Đổi lại cache chỉ giữ vài mục, vì một bản stretch to gần bằng bản gốc.

Đánh đổi phải nói rõ: bật lên thì **lần phát đầu tiên khựng một nhịp** với clip dài (WSOLA chạy đồng bộ), và chất lượng là mức WSOLA — tốt cho giọng nói và đa số nhạc, không bằng phase vocoder thương mại.

### Tách vocal: nói thẳng nó là gì

`centreChannel` là mẹo kênh giữa cổ điển: vocal chính thường mix chính giữa nên L−R triệt tiêu nó, còn (L+R)/2 giữ lại nó.

**Đây không phải stem separation thật.** Tách stem thật cần model đã huấn luyện (Demucs và họ hàng) — hàng chục MB trọng số và vài giây tính toán cho mỗi phút audio, không phải thứ nên giấu trong một extension trình duyệt. Mẹo này lấy đi cả bass và kick vì chúng cũng ở giữa, và **không làm gì cả** với file mono (trả về nguyên vẹn, vì biến file mono thành im lặng không phải điều ai bấm "xoá vocal" đang muốn). Tên hiệu ứng ghi rõ "(karaoke)" thay vì để chữ "tách vocal" hứa nhiều hơn nó làm được.

| Phạm vi | Bản chất | Gỡ ra được? |
|---|---|---|
| **Clip** | chuỗi node sống trên đúng một clip | **Được** — là một danh sách, xoá dòng là xong |
| **Track** | chuỗi node sống trên một track | **Được** |
| **Master** | chuỗi node sống trên cả bản trộn | **Được** |
| **Vùng chọn** | một lần, **destructive**, ghi ra source mới | **Chỉ bằng Undo** |

Ba cái đầu là **cùng một ý ở ba cỡ**, và cả ba đều là *danh sách*: thứ bạn thêm vào nhìn thấy được và xoá được. Chỉ cái thứ tư ghi thẳng vào mẫu.

**Đó chính là lý do chuỗi trên clip tồn tại.** Áp một hiệu ứng vào vùng chọn là viết đè lên mẫu, nên đường về duy nhất là Undo — mà Undo không thể gỡ riêng hiệu ứng đó trong khi vẫn giữ các sửa đổi làm sau nó. Muốn "áp Bass rồi đổi ý" thì dùng tab Clip.

Chuỗi clip nằm **giữa clip và track** trong đồ thị: `clip → gain/fade → chuỗi clip → gain track → chuỗi track → pan → chuỗi master → ra`. Nó đi theo clip qua split, move, copy/paste và cả overlap trim.

Tab **Clip** cố tình chỉ sửa **một** clip (clip đầu tiên đang chọn). Sửa nhiều clip cùng lúc thì lúc gỡ một hiệu ứng sẽ phải đoán xem làm gì với những clip có chuỗi đã khác nhau — đoán sai là xoá mất xử lý mà không báo gì.

Tên hiệu ứng và tên tham số **để nguyên tiếng Anh ở cả hai ngôn ngữ** — Gain, Bass, Treble, High-pass, Compressor, Threshold, Ratio… Đó là chữ in trên mọi thiết bị âm thanh và trong mọi trình sửa khác; dịch ra ("Cắt tiếng ù" cho High-pass) làm chúng khó nhận ra hơn chứ không dễ hơn. Phần văn xuôi giải thích quanh chúng thì vẫn dịch.

Vì vậy Master/Track **chỉ nhận được các effect có `build()`** (node Web Audio thật): Gain, Highpass, Lowpass, Presence, Compressor. Vùng chọn nhận thêm những thứ không có dạng node sống có nghĩa — Normalize (phải quét cả buffer tìm đỉnh trước), Reverse, Invert, Silence, Fade, Noise gate. Danh sách ngắn hơn ở Track/Tổng là **do bản chất**, không phải thiếu sót.

Hai cái đầu không có nút Áp dụng là **có chủ đích**: chúng là node Web Audio, đổi tham số là đổi đồ thị. Chỉ cái thứ ba mới thực sự ghi mẫu.

**Tab Vùng chọn bị khoá khi chưa chọn gì**, chứ không rơi về "áp lên cả bài". Fallback đó chính là cách một fade in ăn hết cả bài hát. Mất vùng chọn thì tab tự rơi về Track.

**Thêm/xoá effect bị khoá khi đang phát**, nhưng **chỉnh tham số thì không**: chỉnh tham số chỉ retune node có sẵn, còn thêm/xoá cần node chưa tồn tại. Nút **mờ đi chứ không biến mất**, kèm tooltip nói rõ lý do.

Fade mặc định **3 giây** (`DEFAULT_FADE_SECONDS`), không phải toàn bộ vùng chọn.

### Panel hẹp thì thành drawer

Dưới 1000px, `.ae__side` không còn xếp chồng dưới timeline mà trượt ra thành **drawer nổi** bên phải, có scrim bấm để đóng.

Xếp chồng là cách cũ, và nó biến mỗi slider thành một cuộc cuộn tìm: thứ đang chỉnh nằm khuất phía trên, chỉnh xong phải cuộn lên xem. Drawer giữ timeline trong tầm mắt và đặt control lên trên nó.

Nút mở nằm **dán vào mép phải màn hình** chứ không nằm trong toolbar: drawer trượt ra từ bên phải thì phải mở được từ bên phải, và toolbar vốn đã là dải đông đúc nhất. Nút trượt theo drawer khi mở, đổi mũi tên, và biến mất hoàn toàn ở màn rộng — chỗ đó panel chỉ là một cột bình thường.

## 6. Bốn tool chuột

`activeTool` nằm trong store (không phải state cục bộ) vì con trỏ, phím tắt và panel effect đều đọc nó. Mỗi tool là một `ToolHandler` trong [`tools/index.ts`](../../src/features/site/audio-editor/tools/index.ts).

| Tool | Phím | Kéo trên timeline |
|---|---|---|
| **Di chuyển** | `V` | Kéo clip để dời; mép = trim; góc = fade |
| **Chọn vùng** | `A` | Kéo để bôi đen một khoảng thời gian |
| Kéo khung nhìn | `H` | Trượt timeline |
| Split | `C` | Click = cắt clip tại con trỏ |
| Chỉnh gain | `N` | Kéo lên/xuống = gain clip (non-destructive) |

**Vì sao tách đôi.** Trước đây chỉ có một tool "Chọn", và hành vi phụ thuộc vào *chỗ* bạn bấm trong clip: thanh tiêu đề thì dời clip, thân clip thì bôi đen. Audacity làm vậy và đọc trong tài liệu thì hợp lý, nhưng thực tế người dùng bấm giữa clip định dời thì lại được một vùng chọn. Hai tool, mỗi tool làm đúng một việc, bỏ hẳn chỗ phải đoán. Tool Di chuyển giờ kéo clip **từ bất kỳ đâu trên clip**, và con trỏ ở thân clip đổi thành bàn tay thay vì I-beam — I-beam đang hứa một kiểu chọn mà tool đó không còn làm.

Tool Chọn làm nhiều việc, phân biệt bằng **chỗ bấm**, đúng như Audacity 3.x:

| Bấm vào | Hành vi |
|---|---|
| Thân clip, kéo ngang | Khoanh vùng thời gian |
| Thanh tiêu đề clip, kéo | **Di chuyển clip**, sang track khác được, hít vào mép clip khác |
| Mép trái/phải clip | Trim (non-destructive — kéo ra lại được) |
| Tam giác fade ở góc | Chỉnh fade in/out của clip |
| Thước thời gian, kéo | Khoanh vùng trên **mọi** track |
| Click đơn | Đặt playhead |
| Chuột phải | Menu theo ngữ cảnh ([`ContextMenu.tsx`](../../src/features/site/audio-editor/ContextMenu.tsx)) |

### `onDown` trả về một *gesture*

```ts
onDown(e, ctx): Gesture | null   // { onMove?, onUp? }
```

Bản trước giữ state kéo trong biến mức module — đó là cách một mốc scroll cũ sống sót sang lần kéo sau. **Một gesture không thể sống lâu hơn con trỏ đã tạo ra nó.**

Trong lúc kéo, tool gọi `preview(project)` để vẽ bản chưa commit; nhả chuột mới `commit()` **đúng một bước** lịch sử — kéo một clip không để lại năm mươi bước undo.

### Zoom & cuộn

| Thao tác | Kết quả |
|---|---|
| Ctrl/Cmd + lăn chuột | Zoom **quanh con trỏ** — điểm audio dưới chuột đứng yên |
| Giới hạn thu nhỏ | `minPxPerSec` = 1/4 mức vừa khung, không phải đúng mức vừa khung |
| Lăn chuột dọc | Cuộn ngang theo thời gian |
| Lăn ngang (trackpad) | Cuộn ngang trực tiếp — trục nào lớn hơn thì trục đó thắng |
| Nút zoom ở thanh transport | Phóng to / thu nhỏ / vừa khung, cho ai không biết mẹo Ctrl+lăn |

Khi đang phát, khung nhìn **tự chạy theo playhead** (`scrollToFollow`): nó nhảy trước một trang thay vì căn giữa liên tục, vì một khung nhìn căn giữa mỗi khung hình làm sóng trượt dưới một con trỏ đứng yên — khó đọc hơn hẳn.

Thu nhỏ **đi được quá cuối bài**. Dừng đúng ở mức vừa khung nghĩa là không bao giờ nhìn thấy phần sau đoạn audio — mà đó đúng là chỗ cần chừa để kéo clip tới, hoặc để ước lượng còn bao nhiêu khoảng lặng. Nút "vừa khung" vẫn snap về đúng mức fit.

Các nút zoom nằm ngoài `TimelineCanvas` nhưng viewport lại cố tình nằm trong `ref`, nên chúng với vào bằng một **imperative handle** (`TimelineHandle`) thay vì đẩy zoom vào state React và render lại cả editor.

Pan timeline dùng tool Di chuyển (`H`). Bản trước còn giữ-Space-để-pan, nhưng `Space` đã là phát/dừng nên phải phân biệt gõ với giữ — đợt viết lại bỏ đi để `Space` chỉ làm đúng một việc.

### Panel bám theo cái vừa chọn

| Bấm vào | Panel bên phải |
|---|---|
| Một clip | Tab **Clip** |
| Đầu track (cột trái) | Tab **Track**, track đó có vạch accent |
| Bôi đen một vùng | Tab **Vùng chọn** |
| Khoảng trống | Không tab nào — panel báo chưa chọn gì |

Cơ chế là một dấu `pick: { kind, seq }` trong store. Panel nghe theo **`seq`** chứ không theo bản thân vùng chọn, vì hai lý do: đổi tab bằng tay thì giữ nguyên cho tới **lần chọn kế tiếp** (không bị giật về), còn chọn lại cùng một *loại* (clip này sang clip khác) vẫn re-focus được.

Kéo chuột bắn `setSelection` mỗi pointer move, nên chỉ **lần chuyển vào** trạng thái "có vùng chọn" mới tính là một pick — nếu không panel sẽ giành tiêu điểm sáu mươi lần một giây.

### Chọn nhiều clip

| Bấm | Kết quả |
|---|---|
| Bấm thường | Chọn đúng clip đó |
| **Ctrl/Cmd + bấm** | Thêm / bỏ clip khỏi nhóm đang chọn |
| **Shift + bấm** | Chọn cả dải clip từ clip bấm gần nhất tới clip này |

`clipsBetween()` **cố tình từ chối bắc qua hai track**: "mọi thứ giữa hai clip này" không có nghĩa rõ ràng khi chúng nằm khác hàng, đoán bừa sẽ chọn phải audio mà người dùng không nhìn thấy mình đã chọn. Gặp trường hợp đó thì rơi về chọn đơn.

Bấm có Ctrl/Shift **không khởi động thao tác kéo**: đó là cử chỉ chọn, kéo luôn sẽ xê dịch clip mà người dùng chỉ định thêm vào nhóm.

Nhiều clip được chọn thì `effectiveRange()` gộp thành khoảng phủ từ clip trái nhất tới clip phải nhất, nên hiệu ứng và copy/cut dùng được ngay.

Kéo một clip **đang nằm trong nhóm** thì kéo cả nhóm: `moveClips()` làm việc theo **delta** chứ không theo vị trí tuyệt đối, vì dời từng clip tới một điểm tính sẵn sẽ bóp hết khoảng cách giữa chúng. Clip trái nhất quyết định nhóm lùi được tới đâu. Kéo một clip **ngoài nhóm** thì chỉ kéo mình nó.

### Một track là một làn — clip thả xuống thắng

Hai clip chồng nhau trên cùng một track thì **cả hai cùng phát**, nghe như lỗi chứ không như tính năng; xếp lớp là việc của track thứ hai. Nên `resolveOverlaps()` cắt phần bị che ra khỏi đường đi của clip vừa thả:

| Tình huống | Kết quả |
|---|---|
| Bị che hoàn toàn | Clip dưới biến mất |
| Che một mép | Clip dưới bị cắt ngắn tới mép clip trên |
| Che khúc giữa | Clip dưới **tách làm hai** |

Không có mẫu nào bị phá: clip chỉ là cửa sổ, nên việc này chỉ đổi `offset`/`duration`/`start` và **undo khôi phục nguyên vẹn** phần audio bị che. Cả kéo lẫn trim đều đi qua đây, và preview trong lúc kéo cũng vậy nên nhìn thấy ngay.

Overlap giờ không tạo ra được nữa; project cũ đã lỡ có thì sẽ tự dọn khi bạn chạm vào clip liên quan.

### Xoá: nối liền hay giữ khoảng trống

Toggle trên thanh công cụ, **mặc định TẮT**. Khoảng trống thường là có chủ ý — quãng nghỉ giữa hai take, chỗ chừa cho thứ khác — nên tự động hàn lại là phá đi ý đồ đó mà không có dấu hiệu gì. Menu chuột phải vẫn luôn có cả hai lựa chọn ghi rõ tên.

### Copy / Paste — mỗi lần dán là một instance mới

`copyRange` nhấc một khoảng thời gian ra khỏi các track đã chọn mà **không đụng vào project**: nó cắt trên một bản sao tạm (đúng mẹo của `applyEffectToRange`) rồi rebase `start` của từng clip về 0. Clipboard **mang theo cả buffer** — thiếu chỗ đó thì copy → xoá → dán sẽ dán một cửa sổ trỏ vào source không còn tồn tại.

`pasteAt` **split trước rồi mới đẩy**, nên chèn vào giữa một clip sinh ra các instance độc lập chứ không phải một khối liền:

```
trước:   [ aaaaaaa ]                     1 clip
dán bbbb tại t=3
sau:     [ aaa ][ bbbb ][ aaaa ]         3 clip, 3 id khác nhau
```

`aaa` và `aaaa` vẫn **dùng chung một source** (chỉ khác cửa sổ), còn `bbbb` trỏ sang source của clipboard. Cả ba chọn / kéo / xoá riêng được. Dán hai lần luôn sinh id mới, nếu không thì hai clip sẽ tranh nhau một danh tính.

Copy nhiều track giữ **từng lane riêng**: lane thứ i rơi vào track thứ i, lane nào không có track tương ứng thì tạo track mới.

### "Vùng chọn" gồm cả clip đang chọn

`effectiveRange()` trả về khoảng thời gian đang được nhắm tới: vùng chọn tường minh nếu có, **không thì là clip vừa bấm**. Trước đó bấm vào một clip rồi thấy tab Vùng chọn vẫn xám là ngõ cụt không có gì giải thích — người dùng phải tự biết "bấm clip" và "kéo ra một khoảng" là hai chuyện khác nhau. Copy/cut cũng dùng chung hàm này.

**Phím tắt:** `Space` phát/dừng · `S` split tại playhead · `Delete` xoá vùng chọn · `Home`/`End` · `Ctrl+C`/`Ctrl+X`/`Ctrl+V` · `Ctrl+Z` / `Ctrl+Shift+Z` · `Ctrl+E` xuất · `V`/`H`/`C`/`N` đổi tool.

Nhập thêm file vào project đã có audio đi qua `commit`, nên **undo được**; bản trước reset history ở đúng chỗ đó, tức là thêm track thứ hai là mất sạch mọi bước trước đó.

Có hai kiểu nhập: **song song** (file thành một track riêng, phát từ đầu) và **nối tiếp** (`appendToTrack` — nối vào cuối track hiện có, dùng chung volume/pan/effect của track đó).

Nút **Thêm track** hỗ trợ dạng menu dropdown gồm:
- **Nhập âm thanh**: Chọn file âm thanh để thêm track song song.
- **Tạo track rỗng**: Tạo một track mới tinh chưa có clip (`addEmptyTrack`), sẵn sàng để dán audio hoặc thu âm.

### Ghi âm thanh (Overdub) trên track
Khi chọn một track (trong tab Track ở panel bên phải `ae__aside`), bảng điều khiển cung cấp tính năng **Ghi âm**:
- **Chọn microphone**: Liệt kê các thiết bị thu âm thực tế của hệ thống (`navigator.mediaDevices.enumerateDevices`).
- **Cơ chế Overdub**: Vừa ghi âm tín hiệu microphone vừa phát các track hiện có để người dùng nghe nhạc nền và hát/thu âm theo nhịp.
- Dừng ghi: Tự động giải mã tín hiệu thu thành clip âm thanh mới, đặt đúng vị trí playhead bắt đầu, xử lý tự động chống chồng lấn (`resolveOverlaps`) và lưu snapshot vào lịch sử để hỗ trợ Undo/Redo nguyên vẹn. Spacebar trong lúc thu âm cũng tự động dừng thu và chèn clip.

### Xoá khi đang phát

Node sống lâu hơn cái cây dựng ra nó: xoá một track hay một clip giữa chừng thì `AudioBufferSourceNode` đã hẹn giờ vẫn chạy tiếp — đó là lý do tiếng vẫn phát sau khi clip đã biến mất khỏi màn hình.

`applyLiveParams` vì vậy **tắt hết rồi mới bật lại những gì project còn giữ**: mọi track gain về 0, mọi clip gain không còn trong cây cũng về 0 (kèm `cancelScheduledValues`, vì envelope fade là automation đã lên lịch chứ không phải một giá trị). Không phải dựng lại graph, nên vẫn giữ được nguyên tắc "không rebuild khi đang phát".

Xoá sạch track thì transport tự dừng — để playhead bò trên một timeline rỗng là vô nghĩa.

### Dự án rỗng vẫn là dự án đang mở

Xoá track cuối cùng **không** rơi về màn hình mở file. Trước đây nó rơi về, và đọc như "ứng dụng vứt dự án của tôi đi rồi tự về trang chủ". Giờ editor ở nguyên đó với một stage trống mời thêm track; đường ra tường minh là nút đóng file.

## 7. "Nó đang làm gì vậy?" — kênh activity

[`engine/activity.ts`](../../src/features/site/audio-editor/engine/activity.ts) là **một** kênh duy nhất cho mọi việc nặng.

Vấn đề nó giải rất cụ thể: phần lớn việc nặng ở đây là **đồng bộ** — giải mã, time-stretch, render hiệu ứng, encode WAV. Bật cờ "busy" rồi chạy vòng lặp **trong cùng một lượt** thì trình duyệt không bao giờ kịp vẽ, nên thông báo chỉ hiện ra *sau khi việc đã xong* — đúng lúc nó vô dụng. Người dùng chỉ thấy trang đứng hình và không biết vì sao.

`report()` giải quyết bằng cách **nhường một frame đã vẽ thật** giữa lúc thông báo và lúc bắt đầu:

```
begin(label) → requestAnimationFrame → setTimeout(0) → chạy việc → end()
```

`rAF` rơi ngay *trước* một lần vẽ, nên task đặt từ bên trong nó là thời điểm sớm nhất mà frame đã lên màn hình. Mọi thứ đắt đều đi qua đây: mở file, mở project đã lưu, lưu, xuất file, áp hiệu ứng lên vùng chọn, và dựng bản giữ cao độ.

Kênh này nằm ở `engine/` nên **không phụ thuộc React hay store** — đúng ranh giới của tầng đó, và chạy được dưới Node trong test. UI đọc thẳng bằng `useSyncExternalStore`, nên một lần render dài không kéo theo re-render timeline.

`getSnapshot()` trả về **đúng một object cho tới khi có gì đó thật sự đổi**. Trả object mới mỗi lần gọi sẽ làm `useSyncExternalStore` lặp vô hạn — cái bẫy dự án này đã dính một lần rồi.

**Đồng hồ đếm giây quan trọng hơn vẻ ngoài của nó.** Một thanh chỉ quay thì không nói được là còn chạy hay đã treo; một con số cứ tăng thì phân biệt được ngay. Và nếu main thread bị chặn thật thì con số cũng đứng — bản thân điều đó đã là câu trả lời.

**Làm nóng trước khi phát.** WSOLA chạy đồng bộ, nên bấm play trên clip giữ cao độ sẽ đứng hình. `play()` vì vậy dựng sẵn các bản stretch còn thiếu **sau tấm banner** rồi mới khởi động transport.

### Nhường frame GIỮA các khúc, không chỉ lúc bắt đầu

Nhường một lần trước khi chạy đủ để banner **hiện ra**, nhưng chưa đủ để nó **sống**: việc đồng bộ chạy liền một mạch thì `setInterval` không nổ, đồng hồ đứng ở 0.0s và trông y hệt như hỏng.

Nên mọi vòng lặp dài đều gọi `yieldToUI()` giữa các khúc:

| Chỗ | Cắt theo |
|---|---|
| `loadProject` | từng source — `decodeWav` là đồng bộ và một source WAV có thể cả trăm MB |
| `applyEffectToRange` | từng clip |
| Dựng bản giữ cao độ | từng source |
| Xuất từng clip | vốn đã `await` mỗi vòng |

Mỗi khúc cũng báo `i/total`, nên thanh chuyển từ vạch chạy vô định sang phần trăm thật.

**Thanh vô định chạy bằng `transform`, không phải `margin-left`.** Animation trên `transform` chạy ở compositor nên **vẫn nhúc nhích khi main thread bị chặn** — đúng lúc cần nhất: đồng hồ đứng (nó cần JS), còn vạch này là thứ duy nhất còn nói được là trang vẫn sống chứ không chết.

**WSOLA cũng bị cắt khúc.** Cắt giữa các source là chưa đủ: người dùng thường chỉ có **một** clip, nên cả bài chạy trong một khối và thanh đứng ở 0% cho tới lúc xong. Nên thuật toán tách thành `beginStretch` / `stretchFrames(n)` / `finishStretch`, và bản async chạy từng lát rồi nhường.

Lát cắt đo bằng **thời gian, không phải số khung**. Một con số khung cố định không thể vừa hợp clip hai giây vừa hợp bài sáu phút: chọn số đủ lớn cho bài dài thì clip ngắn xong trong một lát, không nhường lần nào và không báo lần nào — đúng lại là cái thanh đứng ở 0%. Làm việc trong ~12ms rồi nhường thì tự thích nghi với cả hai, và với cả tốc độ máy.

Có test khẳng định bản cắt khúc và bản chạy một mạch cho ra kết quả **giống nhau từng mẫu** — nếu cắt mà đổi số học thì nó là một thuật toán khác đội lốt cùng tên.

**Chỗ vẫn chưa che được:** `peaksForWindow` quét mẫu ngay trong lúc vẽ canvas. Không có chỗ nào để nhường frame ở giữa một lần paint. Triệt để thì phải đẩy sang Web Worker.

## 8. Lưu project — và cơ chế dọn đi kèm

Audio là dữ liệu nặng nhất dự án từng lưu (một bài 3 phút stereo ≈ 30 MB). Lưu mà không có đường dọn thì IndexedDB phình vô hạn, nên hai thứ này thiết kế cùng nhau.

### 7.1. Hai bảng, tách source khỏi cây

[`engine/persist.ts`](../../src/features/site/audio-editor/engine/persist.ts) trên `db.version(7)`:

```ts
audioProjects: "id, updatedAt"    // { id, name, tracks, updatedAt }   ← JSON nhỏ
audioSources:  "id, projectId"    // { id, projectId, blob, sampleRate } ← WAV nặng
```

Tách đôi là điểm mấu chốt: **source bất biến**. Cắt, di chuyển, trim, fade chỉ đổi cây track/clip — vài KB JSON. Chỉ hiệu ứng destructive mới sinh source mới. Nhờ vậy **autosave chỉ ghi cây** (debounce ~1s, gần như miễn phí); blob chỉ ghi khi thật sự có source mới. Gộp một bảng thì mỗi lần kéo clip sẽ ghi lại vài chục MB.

### 7.1. Tùy biến Lưu & Tự động lưu (Auto-save)
- **Hỏi 1 lần khi bắt đầu (`ae__save-prompt`):** Khi tạo dự án mới hoặc mở file, ứng dụng hiển thị thanh thông báo hỏi người dùng có muốn lưu vào bộ nhớ trình duyệt hay không.
  - Nếu bấm **"Lưu dự án"**: Lưu ngay vào IndexedDB (`saveNow()`), nút Lưu trên thanh công cụ sáng đèn (`ae__save-btn--active`), và kích hoạt chế độ **tự động lưu** (`autoSave: true`). Từ đó về sau mọi thay đổi đều tự động ghi vào IndexedDB.
  - Nếu bấm **"Không lưu"**: Ẩn thanh thông báo, không lưu dữ liệu vào IndexedDB.
- **Nút Lưu trên thanh công cụ (`ae__save-btn`):**
  - Luôn hiện diện trên toolbar. Bấm vào bất kỳ lúc nào để lưu dự án và kích hoạt tự động lưu (nút sẽ bật sáng viền/nền và có chấm pulsing báo hiệu).
  - Khi mở lại một dự án đã lưu từ trước trong `ProjectManager`, ứng dụng tự động nhận diện dự án đã kích hoạt lưu và bật sáng nút Lưu.

### 7.2. Tạo dự án mới (New Project)
- Ngay tại màn hình khởi đầu (`!hasProject`), thay vì chỉ có thao tác kéo thả hoặc nút "Mở file", giao diện cung cấp nút **"Dự án mới"** nổi bật.
- Bấm vào sẽ khởi tạo ngay một dự án rỗng với "Track 1" sẵn sàng để ghi âm mic hoặc chỉnh sửa mà không cần phải có file âm thanh mẫu từ trước.
- Nút icon "Dự án mới" cũng được đặt trên thanh meta của editor để tạo mới bất cứ lúc nào. Khi dự án chưa được lưu, thao tác đóng hoặc tạo mới đều có hộp thoại xác nhận bảo vệ người dùng khỏi mất dữ liệu.

**Ưu tiên lưu chính file gốc.** Một source nhập từ file giữ nguyên bytes đã nén của file đó (`Project.origins`); chỉ audio do chính editor sinh ra — kết quả của hiệu ứng destructive — mới phải ghi thành WAV **32-bit float** (`SOURCE_BIT_DEPTH`), vì đó là bản gốc đang làm việc chứ không phải bản giao.

Khác biệt này rất lớn chứ không nhỏ: một bài 6 phút stereo 48 kHz encode lại thành WAV float là **~138 MB**, trong khi file mp3 sinh ra nó chỉ vài MB. Bản trước encode lại tất cả, nên thêm **một** bài 4 MB làm màn hình quản lý báo hơn một trăm MB.

Đổi lại, lúc mở project phải giải mã lại file nén — và phải giải mã **đúng tần số đã lưu** bằng `decodeAtRate` (`OfflineAudioContext`), không phải tần số của thiết bị.

Cả hai đường đọc đều phải chống một cái bẫy: `decodeAudioData` resample về tần số của context, nên mở lại một project 48 kHz trên máy chạy 44.1 kHz sẽ **âm thầm viết lại cả project** ở tần số khác. Đường WAV tránh bằng `decodeWav` **tự parse chunk**; đường file nén tránh bằng `decodeAtRate`, dùng `OfflineAudioContext` ở đúng tần số đã lưu và không đụng tới sound card.

> Sửa luôn một lỗi có sẵn: `DB_SCHEMA_VERSION` là `5` trong khi file đã khai báo tới `db.version(6)`. Hằng số này chính là thứ [`backup.ts`](../../src/core/storage/backup.ts) dùng để từ chối bản backup mới hơn, nên nó đang sai. Giờ là `7`.

### 7.2. Dọn rác: source mồ côi

Chỗ rò rỉ âm thầm nhất. Mỗi hiệu ứng destructive đẻ ra một source mới; undo rồi làm việc khác thì source cũ **không còn clip nào trỏ tới** nhưng vẫn nằm trong DB.

`sweepOrphanSources(projectId, keep)` gom mọi `sourceId` mà cây track/clip **và toàn bộ lịch sử undo** đang tham chiếu, xoá phần còn lại. **Phải tính cả lịch sử** — nếu không thì undo sẽ trỏ vào source đã bị xoá. Đây là chỗ dễ sai nhất và hỏng thì mất dữ liệu, nên có test riêng cho đúng ca đó.

### 7.3. Dọn bằng tay — người dùng phải nhìn thấy và tự quyết

[`ProjectManager.tsx`](../../src/features/site/audio-editor/ProjectManager.tsx) là màn hình mở file kiêm trình quản lý, theo pattern của `WallpaperManager`:

- Danh sách project: tên, thời lượng, số track, **dung lượng chiếm**.
- **Xoá từng project** — xoá luôn source của nó.
- **Xoá tất cả** — có xác nhận, hiện rõ sẽ giải phóng bao nhiêu.
- **Chốt lịch sử** trong editor: bỏ bước undo cũ để `sweepOrphanSources` thu hồi được source — giảm dung lượng **mà không mất bài đang làm**.
- Cảnh báo khi gần hết quota, dùng `estimateStorage()` có sẵn.

### 7.4. Không nhét vào backup

[`backup.ts`](../../src/core/storage/backup.ts) xuất file zip cấu hình — nhét vài trăm MB audio vào đó là biến tính năng backup thành vô dụng. Project audio **không** nằm trong backup; muốn mang đi thì dùng Xuất file. Điều này ghi rõ cho user ngay ở màn hình quản lý, đừng để họ tưởng backup có kèm.

## 9. Xuất file

`mixdown()` ([`engine/render.ts`](../../src/features/site/audio-editor/engine/render.ts)) trộn mọi track qua `OfflineAudioContext` bằng **đúng đồ thị của §4** — cùng một `scheduleProject()` với lúc phát. [`engine/export.ts`](../../src/features/site/audio-editor/engine/export.ts) nhận buffer đã trộn, cho qua `conform()` (mono/stereo, sample rate) rồi encode.

- **WAV** — encoder tự viết, 16 / 24-bit PCM hoặc 32-bit float.
- **MP3** — mediabunny + LAME WASM, `await import(...)` nên WASM chỉ tải khi thực sự xuất MP3.
- **OGG** — mediabunny với container `OggOutputFormat`, codec **Opus** qua encoder gốc của trình duyệt (`AudioEncoder` trong WebCodecs). Không có gói WASM nào đi kèm cho nhánh này — không giống MP3, chưa có bản Vorbis/Opus encoder nào của mediabunny trên npm, và mọi trình duyệt chạy được extension này (Chrome, Edge…) đã có sẵn encoder Opus native. `canEncodeAudio("opus", {...})` được hỏi trước; nếu trình duyệt không hỗ trợ thì báo lỗi rõ ràng (`audio.errOggUnsupported`) thay vì âm thầm ra file rỗng hoặc hỏng.

  **Vì sao Opus chứ không phải Vorbis** — cái tên "Ogg" hay gắn với Vorbis, nhưng không trình duyệt nào lộ ra encoder Vorbis qua WebCodecs, còn Opus thì có ở khắp nơi và tốt hơn Vorbis ở mọi mức bitrate thực tế sẽ dùng. Nên "Xuất OGG" ở đây luôn luôn là Ogg + Opus.

> Bẫy: `new Quality(192000)` **không** có nghĩa là 192 kbps — số trần được đọc là mức chất lượng 0..1. Phải viết `new Quality({ bitrate: 192000 })`. Áp dụng như nhau cho cả MP3 lẫn OGG.

**Xuất từng clip:** encode từng clip rồi gói vào một `.zip` bằng `fflate` (level 0 — WAV/MP3/OGG gần như không nén được nữa, deflate chỉ tốn CPU).

Xuất từng clip báo phần trăm thật vì vòng lặp do ta điều khiển; xuất một file thì indeterminate — mediabunny không phát tín hiệu tiến trình, bịa ra một con số là nói dối.

## 10. Kiểm thử

**Tự động** (Node + polyfill `AudioBuffer`, bundle bằng esbuild):

| Bộ | Assertion | Bảo vệ điều gì |
|---|---|---|
| `project-smoke` | 59 | split/move/trim/delete giữ đúng tổng thời lượng; lịch sử giữ source sống |
| `hittest-smoke` | 49 | bấm vào header/body/mép/fade ở mọi mức zoom và scroll |
| `audio-smoke` | 35 | tầng DSP |
| `effects-smoke` | 28 | mọi effect có `scopes` chứa `selection` thì thật sự render ra mẫu |
| `wav-correctness` | 23 | encode khớp bản tham chiếu trong 1 LSB; header; packing 24-bit |
| `export-smoke` | 10 | `extensionFor`/`DEFAULT_EXPORT` đúng cho cả ba format; đường WAV chạy hết `exportBuffer` (là format duy nhất không cần API trình duyệt nên kiểm được trọn vẹn dưới Node); `conform()` (mono/stereo) áp dụng trước khi encode, dùng chung cho MP3 lẫn OGG dù không tự chạy được hai nhánh đó ở đây |

**Kiểm thử tay** (phần không tự chạy được):

1. Mở file → thấy 1 track, 1 clip.
2. Khoanh vùng giữa bài → chỉnh gain → **playhead đứng yên**, **vùng chọn vẫn còn**, fade áp đúng vùng đó.
3. Split 2 chỗ → thành 3 clip **chọn được riêng từng cái**.
4. Kéo clip giữa sang phải → để lại khoảng lặng; kéo sang track 2.
5. Kéo mép clip → trim; kéo tam giác góc → fade.
6. Thêm track, mute/solo, kéo volume **trong lúc đang phát** → nghe đổi ngay.
7. Xuất → file khớp với cái nghe được. Thử cả ba format (WAV/MP3/OGG) — OGG phải mở nghe được trong trình phát ngoài trình duyệt, không chỉ trong tab.
8. Đóng tab, mở lại → project còn nguyên, đúng sample rate.
9. Áp vài hiệu ứng rồi undo → bấm **Chốt** → dung lượng trong màn hình quản lý **giảm thật**.
10. Xoá một project → dung lượng giảm đúng phần của nó; "Xoá tất cả" đưa về mức nền.
11. Mở New Tab kiểm tra backup/restore vẫn chạy sau khi bump schema.

## 11. Chưa làm

- **Minimap** — bị gỡ trong đợt viết lại, chưa dựng lại cho nhiều track.
- **Kéo thả file thẳng vào một track** — hiện phải qua nút Thêm track / Nối tiếp.
- **Vẽ đường bao gain nhiều điểm** — tool "Chỉnh gain" hiện là dạng rút gọn (một cử chỉ kéo đặt `gainDb` của clip). Envelope đầy đủ cần mô hình automation riêng.
- **Chọn nhiều vùng rời rạc**.
- **Web Worker cho xử lý nặng** — chưa đo thấy cần; `OfflineAudioContext` vốn đã chạy phần lớn off-main-thread, và `AudioBuffer` không transferable nên worker kéo theo một lớp copy `Float32Array` từng kênh.
- **Kéo clip sang track khác** đã có trong `moveClip` và có test, nhưng chưa kiểm tay.

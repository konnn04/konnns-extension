# Thiết kế nâng cấp Video Editor — Timeline, Tool chuột, Effect, Xuất video

Sep 24, 2026 · @Nguyen Thanh Trieu

## 0. Vấn đề hiện tại & nguyên tắc thiết kế

### 0.1. Hiện trạng (từ ảnh chụp)

Bản hiện tại đã có: nút Thêm clip, Thêm nhạc/lồng tiếng, khối crop (Crop trái/trên/Rộng/Cao) và một track hiển thị tên file (`@roro046.mp4`) trên timeline. Nhưng thiếu gần hết phần khiến một editor "dùng được": không có đầu kim seek trên timeline (chỉ có số `0:06 / 0:19` dạng chữ), không thấy waveform/thumbnail preview trên track để định hướng khi cắt, crop nhập số tay không kéo được trực tiếp trên preview, và không có track riêng biệt rõ ràng cho video/audio khi thêm nhạc.

Bản thiết kế này viết lại từ đầu phần UX của Video Editor, tham chiếu trực tiếp **Adobe Premiere Pro** (chuẩn timeline chuyên nghiệp) và **CapCut** (chuẩn đơn giản hoá cho người không chuyên) — mục tiêu là điểm giữa hai chuẩn đó: đủ mạnh để cắt ghép chính xác, nhưng không phức tạp hoá quá mức cho nhu cầu freelance TestIO + edit nhanh cá nhân.

### 0.2. Nguyên tắc xuyên suốt

1. **Timeline là trung tâm, preview đồng bộ 1:1.** Mọi thao tác trên timeline (kéo playhead, trim, split) phải phản ánh ngay trên preview trong cùng một khung hình — không có độ trễ, không cần bấm nút riêng để "cập nhật xem trước".
2. **Mỗi track một hàng riêng, có nhãn rõ loại.** Video và audio tách hàng ngay từ đầu (khác hiện tại đang gộp chung một khối) — đúng chuẩn Premiere/CapCut, giúp nhìn là hiểu bố cục bài dựng.
3. **Effect chia hai nhóm rõ ràng**: nhóm **mặc định** (audio volume, transform: vị trí/scale) — luôn có sẵn trên mọi clip, chỉnh trực tiếp qua Properties Panel khi chọn clip, không cần "thêm" effect; và nhóm **tuỳ chọn** (crop, chỉnh màu cơ bản, fade in/out) — cần chủ động thêm vào clip qua panel effect, giống hai nhóm "Motion/Opacity mặc định" và "Effects thêm tay" trong Premiere.
4. **Thao tác chuột là đường chính, ô nhập số là đường phụ.** Crop hiện tại chỉ có ô nhập số — sai hướng ưu tiên. Chuột kéo trực tiếp trên preview/timeline luôn phải có, ô số chỉ để tinh chỉnh chính xác sau khi đã kéo tay được đại khái.
5. **Không chặn preview trong lúc chỉnh** — khác nguyên tắc "chỉ áp effect khi dừng" của Audio Editor: video cần xem preview effect (màu, crop, blur) cập nhật *ngay khi đang kéo*, vì đây là thao tác trực quan theo mắt, không đo bằng tai. Chỉ riêng lúc **export** mới cần khoá thao tác.

## 1. Timeline & Preview UX

### 1.1. Đầu kim seek (playhead) — đang thiếu hoàn toàn

Một đường kẻ dọc chạy suốt chiều cao timeline (qua mọi track), có phần đầu hình tam giác/cờ nhỏ nhô lên trên cùng để kéo bằng chuột — đúng chuẩn mọi timeline editor. Ba cách di chuyển:

- **Click bất kỳ đâu trên thước thời gian** (ruler phía trên track) → playhead nhảy ngay tới đó, preview cập nhật tức thì.
- **Kéo trực tiếp đầu playhead** dọc timeline, preview chạy theo real-time trong lúc kéo (scrubbing) — đây là thao tác hay dùng nhất để tìm điểm cắt chính xác.
- **Click trên chính track clip** cũng di chuyển playhead tới điểm đó (không chỉ giới hạn ở thước thời gian trên cùng) — nếu đang ở tool Select thì click vào clip vừa chọn clip vừa dời playhead, giống Premiere.

Số thời gian hiện tại (`0:06 / 0:19`) giữ lại nhưng chuyển thành hiển thị **cạnh đầu playhead** (tooltip nổi khi kéo) thay vì chỉ đứng yên một góc cố định — người dùng cần thấy số ngay tại chỗ tay đang kéo, không phải liếc chỗ khác.

### 1.2. Thumbnail & waveform trên track — thay cho khối màu trơn hiện tại

Hiện tại track chỉ là một khối nâu trơn ghi tên file — không đủ để định hướng cắt. Cần:

- **Track video**: dải thumbnail nhỏ trải dọc theo clip (lấy mẫu vài khung hình đại diện, giống dải phim âm bản) — giúp nhìn lướt là biết đoạn nào đang có gì mà không cần tua thử.
- **Track audio** (kể cả audio đi kèm video gốc lẫn nhạc/lồng tiếng thêm vào): waveform thật, tái dùng đúng cách vẽ peaks đã có trong Audio Editor (`computePeaks`) — nhất quán trải nghiệm giữa hai tool.

### 1.3. Zoom & cuộn ngang — áp lại đúng thiết kế đã có cho Audio Editor

Không thiết kế lại từ đầu: Video Editor dùng **chung nguyên tắc zoom/scroll đã viết cho Audio Editor** (Ctrl+lăn chuột zoom quanh con trỏ, lăn chuột thường cuộn ngang, giữ Space để pan) — chỉ khác là áp dụng cho nhiều track xếp chồng thay vì một track âm thanh duy nhất. Thêm minimap nếu bài dài (giống đề xuất ở Audio Editor).

### 1.4. Track header — vùng điều khiển riêng từng track

Bên trái mỗi track (ngoài vùng clip) là một cột hẹp cố định, không cuộn theo zoom ngang, chứa: tên track, nút mute/ẩn track (icon loa gạch/con mắt gạch), nút khoá track (không cho chọn/kéo nhầm), và với track audio thêm một fader dọc nhỏ chỉnh volume tổng cả track — đúng bố cục track header chuẩn của Premiere.

### 1.5. Snapping — nam châm hút khi kéo

Khi kéo playhead, trim mép clip, hoặc kéo clip để sắp xếp lại, tự động hút (snap) vào các điểm mốc gần đó trong khoảng vài pixel: đầu/cuối clip khác, vị trí playhead hiện tại, các marker đã đặt — bật/tắt được bằng phím giữ (ví dụ giữ `Alt` để tạm tắt snap khi cần độ chính xác dưới-frame). Đây là chi tiết nhỏ nhưng ảnh hưởng lớn tới cảm giác "chuyên nghiệp" vì giảm hẳn số lần phải zoom sâu để canh tay.

### 1.6. Preview — vùng xem trước

Giữ nguyên vùng preview lớn phía trên (đã đúng bố cục), bổ sung: nút play/pause **đè lên góc dưới trái preview** (không chỉ dựa vào timeline) để không phải rời mắt khỏi khung hình khi bấm; phím `Space` phát/dừng (nhất quán Audio Editor); thanh tiến trình mỏng ngay dưới preview phản chiếu đúng vị trí playhead, kéo được luôn tại đây như một scrubber phụ gọn hơn timeline đầy đủ.

## 2. Hệ thống Tool chuột

Áp cùng mô hình state máy `activeTool` đã thiết kế cho Audio Editor — một toolbar cố định phía trên timeline, tool đang chọn có viền sáng, con trỏ đổi hình theo tool.

| Tool | Phím tắt | Hành vi trên timeline |
| --- | --- | --- |
| Select (mặc định) | `V` | Click chọn clip (viền sáng quanh clip được chọn, Properties Panel hiện thông số của nó); kéo clip sang trái/phải để đổi vị trí trên track hoặc sang track khác; kéo mép clip để trim (kéo mép trái/phải co giãn điểm vào/ra, không đổi tốc độ phát) |
| Split (dao cắt) | `C` | Click tại vị trí bất kỳ trên clip = cắt clip thành hai tại đúng điểm playhead hoặc điểm click (theo cấu hình: cắt tại playhead nếu đã có sẵn, hoặc tại điểm click nếu không) |
| Slip | `Y` | Kéo bên trong một clip đã trim — thay đổi **phần nội dung nguồn** đang hiển thị mà không đổi độ dài/vị trí clip trên timeline (đúng khái niệm "slip edit" của Premiere) — hữu ích khi đã canh đúng độ dài clip nhưng muốn đổi đoạn nào trong file gốc được dùng |
| Move/Pan | `H` hoặc giữ `Space` | Kéo = pan timeline, không tương tác với clip |

### 2.1. Trim bằng kéo mép — chi tiết quan trọng nhất đang thiếu

Mỗi clip trên track, ở tool Select, khi hover gần hai mép trái/phải hiện con trỏ resize ngang (`↔`). Kéo mép:

- **Kéo mép phải vào trong** → rút ngắn clip (cắt bớt đoạn cuối), giữ điểm bắt đầu
- **Kéo mép trái vào trong** → rút ngắn từ đầu, giữ điểm kết thúc, các clip/track khác không dịch chuyển theo trừ khi đang bật chế độ **ripple trim** (xem 2.2)
- Trong lúc kéo, hiện tooltip số giây đang trim + preview snap tại đúng khung hình đó (không chỉ hiện số, phải thấy hình)

### 2.2. Ripple vs Overwrite — hai chế độ ảnh hưởng tới clip khác

CapCut mặc định luôn ripple (mọi thứ tự dồn lại khi trim/xoá), Premiere cho chọn cả hai. Với nhu cầu "nhanh gọn" của bạn, nên **mặc định ripple** (giống Audio Editor: xoá là nối liền) — bật một icon bấm-giữ (magnet có gạch chéo hoặc tương tự) để tạm chuyển sang overwrite khi cần giữ khoảng trống có chủ đích (ví dụ chừa chỗ chèn clip khác vào giữa).

### 2.3. Kéo-thả clip mới vào timeline

Thay vì chỉ có nút "Thêm clip" mở dialog chọn file, cho phép **kéo-thả file trực tiếp từ ngoài vào track** (đúng vị trí track và thời điểm nào thả, chèn đúng đó) — vừa nhanh hơn, vừa là hành vi người dùng đã quen từ CapCut/Premiere.

### 2.4. Chọn nhiều clip cùng lúc

Giữ `Shift` hoặc `Ctrl` click để chọn thêm clip vào selection hiện có, hoặc kéo một khung chọn (marquee) trên vùng track trống để chọn hết clip nằm trong khung — cần thiết cho thao tác hay gặp: chọn nhiều clip cùng lúc để xoá, hoặc để áp effect tuỳ chọn hàng loạt (mục 4).

## 3. Hiệu ứng mặc định — luôn có sẵn trên mọi clip

Giống Premiere (mọi clip tự có sẵn "Motion" và "Volume" trong Effect Controls, không cần thêm tay), ba nhóm sau **luôn hiện trong Properties Panel** khi chọn một clip, không cần bấm "thêm effect":

### 3.1. Audio — volume của clip

- Slider **Volume** riêng cho từng clip (kể cả clip video có tiếng lẫn clip audio rời) — đơn vị dB, khoảng ±30dB giống Audio Editor để nhất quán
- Nút **Mute** nhanh riêng clip đó (không phải mute cả track)
- Đường **keyframe volume** đơn giản (tuỳ chọn nâng cao, có thể để giai đoạn sau): thêm 2 điểm để tạo volume tăng/giảm dần trong nội bộ một clip — nếu chưa cần độ phức tạp này ngay, chỉ cần constant volume/clip là đủ cho v1

### 3.2. Vị trí (Position/Transform)

- Hai giá trị **X/Y** dịch chuyển clip trong khung hình xuất — cần khi clip nhỏ hơn khung xuất (ví dụ ghép video dọc vào khung ngang, hoặc overlay logo góc)
- Thao tác chính: **kéo trực tiếp trên preview** khi clip đang chọn (khung viền + 8 handle quanh clip, giống chọn object trong PowerPoint/Premiere) — ô nhập số X/Y bên panel chỉ để tinh chỉnh chính xác sau khi đã kéo

### 3.3. Scale (tỉ lệ)

- Một giá trị phần trăm hoặc kéo handle góc trên preview (giữ tỉ lệ mặc định, giữ `Shift` để scale tự do biến dạng nếu cần — hiếm dùng nhưng nên có)
- Nút **Fit/Fill** nhanh: Fit (thu để vừa khung, có thể có viền đen hai bên) và Fill (phóng để lấp đầy khung, có thể crop bớt) — hai nút này giải quyết ngay bài toán hay gặp nhất khi ghép video khác tỉ lệ khung hình mà không cần chỉnh tay từng số

### 3.4. Vì sao ba nhóm này không thuộc "effect tuỳ chọn"

Khác biệt với nhóm ở mục 4: ba nhóm trên là thuộc tính nội tại của việc "đặt một clip vào khung hình" — mọi clip đều cần một giá trị volume, vị trí, tỉ lệ nào đó (kể cả giá trị mặc định 100%/0,0/căn giữa) để hiển thị đúng, không phải một "hiệu ứng" được chọn thêm. Tách rõ hai khái niệm này giúp Properties Panel không bị rối — người dùng luôn biết chỗ nào để chỉnh cơ bản (luôn hiện), chỗ nào để thêm hiệu ứng nâng cao (phải chủ động bấm thêm, mục 4).

## 4. Panel hiệu ứng tùy chọn: Crop, chỉnh màu cơ bản, Fade in/out

### 4.1. Crop — sửa lại toàn bộ cách nhập

Vấn đề hiện tại: 4 ô số (Crop trái/trên/Rộng/Cao) không kéo tay được, dễ nhập số sai kích thước gây lỗi hiển thị (như ảnh chụp: Rộng 3840, Cao 2160 — đúng bằng kích thước gốc, tức crop chưa hoạt động thực chất). Thiết kế lại:

- Khi bật Crop trên clip đang chọn, preview hiện **khung crop có 8 handle** đè lên khung hình, vùng ngoài khung tối đi (giống crop tool của mọi app ảnh/video) — kéo handle góc/cạnh để đổi vùng crop trực tiếp bằng mắt.
- Bốn ô số hiện tại **giữ lại nhưng chuyển vai trò phụ** — đồng bộ hai chiều với khung kéo (kéo tay thì số tự cập nhật, gõ số thì khung tự di chuyển theo).
- Thêm các **tỉ lệ khung crop dựng sẵn** (nút bấm nhanh): Gốc, 16:9, 9:16 (dọc, hay dùng khi ghép video ngang thành short/story), 1:1, 4:3 — giải quyết đúng nhu cầu hay gặp khi đổi định dạng video cho các nền tảng khác nhau mà không cần tính tay tỉ lệ.
- Nút **Bỏ crop** (đã có, giữ nguyên) để reset về full khung hình gốc.

### 4.2. Chỉnh màu cơ bản

Không cần bộ công cụ color-grading chuyên nghiệp (curves, wheels như Premiere/DaVinci) — mức "cơ bản" phù hợp CapCut hơn: 4 slider đơn giản áp qua CSS filter hoặc WebGL shader đơn giản trên khung preview/khi xuất:

- **Độ sáng** (Brightness), **Tương phản** (Contrast), **Độ bão hoà** (Saturation), **Nhiệt độ màu** (Temperature — ấm/lạnh, hay dùng nhất để chỉnh tông video quay điện thoại bị ám vàng/xanh)
- Mỗi slider có nút reset riêng về 0, và nút **Reset tất cả** cho cả clip
- Preset nhanh (tuỳ chọn, không bắt buộc v1): "Rực rỡ", "Ấm", "Lạnh" — vài preset đơn giản để chọn nhanh không cần tự mò slider

### 4.3. Fade in/out

Áp cho cả hình lẫn tiếng, tách biệt hai loại:

- **Fade hình** (fade to/from black, hoặc fade to/from trong suốt nếu clip đang ở track trên đè lên track dưới): kéo trực tiếp **tam giác nhỏ ở góc trên hai đầu clip trên timeline** — đúng thao tác chuẩn CapCut/Premiere, kéo dài tam giác = kéo dài thời gian fade, không cần mở panel riêng cho thao tác nhanh này.
- **Fade tiếng**: tái dùng đúng UI fade đã có trong Audio Editor (4 đường cong: thẳng, mũ, log, chữ S) — áp lên volume của clip đó, nhất quán trải nghiệm giữa hai tool.
- Hai loại fade độc lập nhau (có thể chỉ fade hình mà giữ tiếng, hoặc ngược lại) vì đây là nhu cầu thực tế phổ biến (ví dụ giữ tiếng nói liên tục qua điểm cắt trong khi hình fade để chuyển cảnh mượt).

### 4.4. Cách thêm/gỡ effect tuỳ chọn

Trên clip đang chọn, panel bên phải có ba tab/nhóm gập-mở: **Crop**, **Màu**, **Fade** — mỗi nhóm có toggle bật/tắt riêng (bật mới hiện điều khiển bên trong, tắt thì giữ giá trị đã chỉnh nhưng ngưng áp dụng, để bật lại không mất công chỉnh lại từ đầu). Không cần một dialog "Add Effect" riêng biệt như Premiere — với chỉ ba loại effect tuỳ chọn, để cố định trong panel đơn giản hơn cho người dùng tìm thấy ngay, không cần mở thêm cửa sổ.

## 5. Tách âm thanh từ video

### 5.1. Đường vào

Chuột phải trên clip video ở timeline → **Tách âm thanh** (Extract Audio), hoặc nút riêng trong Properties Panel khi clip đang chọn. Không đặt trong menu Export vì đây là thao tác chỉnh sửa trong lúc dựng (ví dụ tách để đưa audio qua Audio Editor chỉnh riêng), không phải bước cuối cùng.

### 5.2. Video có một track âm thanh

Trường hợp phổ biến nhất: tách ra ngay một clip audio mới, tự động thêm vào track audio ngay bên dưới clip video gốc, đúng vị trí thời gian khớp với clip video — cho phép ngay sau đó mute track video gốc (nếu muốn chỉ giữ audio đã tách) hoặc giữ cả hai để mix.

### 5.3. Video có nhiều track âm thanh — cần hỏi trước khi tách

Một số file video (quay từ máy quay chuyên nghiệp, hoặc export từ phần mềm dựng khác) có nhiều track âm thanh song song (ví dụ track mic chính + track ambient, hoặc track lồng nhiều ngôn ngữ). Khi phát hiện file có nhiều audio track (đọc metadata qua mediabunny lúc decode), hiện **dialog chọn**:

- Liệt kê từng track kèm nhãn nếu file có metadata tên track (ví dụ "Track 1", "Stereo", codec) — cho nghe thử preview ngắn từng track trước khi chọn
- Cho chọn **một track cụ thể** để tách, hoặc **tách tất cả** thành nhiều clip audio riêng (mỗi track một clip, xếp vào các track audio khác nhau trên timeline để không đè lẫn)
- Nếu không phát hiện nhiều track (trường hợp thường gặp nhất với video quay điện thoại), bỏ qua bước hỏi này hoàn toàn — tách thẳng luôn theo 5.2, không làm phiền người dùng bằng một dialog thừa cho trường hợp đơn giản

### 5.4. Sau khi tách

Clip audio mới tách hoạt động như bất kỳ clip audio nào khác trên timeline — trim, fade, volume đều dùng chung UI đã thiết kế (mục 3.1, 4.3). Nếu người dùng muốn chỉnh sâu hơn (enhance, normalize, các thao tác DSP đã có trong Audio Editor), thêm một nút tắt **"Mở trong Sửa âm thanh"** trên clip đã tách — chuyển sang site app Audio Editor với đúng file đó đã nạp sẵn, tránh phải tự export rồi import lại thủ công.

## 6. Độ mờ (Blur)

### 6.1. Vì sao đây là tính năng đáng làm sớm cho TestIO

Video quay màn hình lúc test thường vô tình lộ thông tin nhạy cảm (mật khẩu, email, dữ liệu khách hàng, token trong URL) — blur để che trước khi gửi report là nhu cầu thực tế, không phải hiệu ứng trang trí. Vì vậy thiết kế blur ở đây khác hẳn kiểu "filter làm mờ toàn khung hình" cho đẹp — cần **blur theo vùng và theo thời gian**.

### 6.2. Hai chế độ blur

- **Blur toàn khung hình** trong khoảng thời gian chọn trên clip (kéo chọn đoạn trên timeline như tool Split ở Audio Editor mục 3.1, rồi bật Blur) — dùng khi cả khung hình đều nhạy cảm trong một đoạn ngắn.
- **Blur theo vùng cố định** (region blur): vẽ một khung chữ nhật (hoặc oval) trên preview, khung đó áp blur trong toàn bộ (hoặc một đoạn) thời lượng clip — dùng khi chỉ một góc màn hình (ví dụ ô nhập mật khẩu) cần che trong khi phần còn lại vẫn cần thấy rõ để minh hoạ bug.
- Vùng blur là **tĩnh** (không tự bám theo chuyển động) cho v1 — theo dõi đối tượng di chuyển (motion tracking blur, như CapCut có) là bài toán computer-vision phức tạp hơn hẳn, không cân xứng với nhu cầu quay màn hình cố định của TestIO. Nếu vùng nhạy cảm di chuyển (ví dụ con trỏ rê qua nhiều chỗ), giải pháp thực tế hơn là **nhiều đoạn blur tĩnh nối tiếp** (vài khung chữ nhật ở các thời điểm khác nhau) thay vì tracking tự động.

### 6.3. Điều khiển vùng blur

Khung blur trên preview có handle kéo góc để resize, kéo giữa để di chuyển — y hệt UX của khung crop (mục 4.1), tái dùng cùng một component khung-kéo-resize cho cả hai tính năng thay vì viết riêng. Độ mạnh blur (nhẹ/vừa/mạnh, hoặc slider Gaussian radius) để chỉnh mức che — mạnh nhất nên đủ để không đọc được chữ nhỏ, không chỉ mờ nhẹ mang tính minh hoạ.

### 6.4. Kỹ thuật (cô đọng)

Áp qua canvas 2D `filter: blur(Npx)` khi render từng khung hình vùng được chỉ định (dùng `ctx.save()`/`clip()` theo khung vùng trước khi vẽ blur, tương tự cách crop dùng clipPath) — không cần thư viện riêng, chạy được cả lúc preview lẫn lúc export vì cùng một pipeline render khung hình.

## 7. Tùy chọn xuất video

### 7.1. Bố cục dialog Export

Giữ nút **Xuất video** đã có ở góc trên phải, nhưng mở ra một dialog đầy đủ thay vì xuất thẳng với mặc định cố định — bốn nhóm tuỳ chọn:

### 7.2. Độ phân giải

- Preset nhanh: **Gốc**, 1080p, 720p, 480p — dropdown hoặc nút bấm nhanh, đủ cho hầu hết nhu cầu (TestIO thường không cần hơn 1080p, video cá nhân có thể cần giữ Gốc)
- Tuỳ chỉnh số tự nhập (Rộng × Cao) cho trường hợp đặc biệt (ví dụ khớp đúng tỉ lệ nền tảng cụ thể)
- Hiển thị ngay dung lượng file **ước tính** cạnh mỗi lựa chọn (tính sơ bộ theo bitrate mặc định của mức đó) — giúp quyết định nhanh mà không cần xuất thử để biết

### 7.3. FPS (khung hình/giây)

- Preset: **Gốc**, 30fps, 60fps, 24fps (chuẩn điện ảnh, hữu ích nếu muốn) — mặc định chọn sẵn Gốc để tránh vô tình đổi FPS làm video giật (nếu người dùng không chủ động cần)

### 7.4. Chất lượng/Nén

Đây là phần dễ gây hiểu lầm nhất nếu làm không rõ ràng — thiết kế theo đúng yêu cầu "nén dung lượng nếu chất lượng cao, gốc":

- Ba mức đặt tên theo **mục đích sử dụng** thay vì số bitrate khó hình dung: **Gốc** (giữ nguyên bitrate nguồn, dung lượng lớn nhất, dùng khi cần lưu trữ/chỉnh tiếp), **Cao** (nén vừa phải, chất lượng gần như không đổi bằng mắt thường, phù hợp gửi report/chia sẻ — nên là mặc định), **Nén nhẹ** (dung lượng nhỏ nhất, ưu tiên gửi nhanh qua chat/email có giới hạn dung lượng đính kèm, chấp nhận giảm chất lượng thấy rõ hơn)
- Mỗi mức hiển thị dung lượng ước tính ngay cạnh, cùng cách với độ phân giải (7.2) — người dùng nhìn số mà quyết định, không cần hiểu khái niệm bitrate/CRF

### 7.5. Định dạng xuất

- **MP4** (H.264) — mặc định, tương thích rộng nhất, đúng chuẩn để gửi report/chia sẻ mọi nơi
- **WebM** (VP9) — dung lượng nhỏ hơn ở cùng chất lượng, phù hợp lưu nội bộ hoặc nhúng web, nhưng kém tương thích hơn khi gửi cho người khác mở bằng phần mềm khác
- Cả hai encode qua `mediabunny` (đã dùng sẵn, hardware-accelerated qua WebCodecs) — không cần thêm thư viện

### 7.6. Tiến trình xuất & tránh chặn thao tác khác

Áp đúng nguyên tắc đã thiết kế cho Audio Editor: progress bar (thật nếu mediabunny expose được tiến trình theo % frame đã encode, indeterminate nếu không) + nút Cancel + không chặn phần UI không liên quan (vẫn xem được timeline khi đang xuất, chỉ khoá nút Export khác và cảnh báo nếu người dùng sửa timeline giữa lúc đang xuất — nên **khoá chỉnh sửa timeline trong lúc xuất** vì khác âm thanh, video xuất theo từng khung hình tuần tự, sửa giữa chừng dễ gây lỗi khung hình không khớp).

## 8. Roadmap — ưu tiên sửa để đạt mức tối thiểu dùng được

Bản hiện tại đang thiếu những thứ nền tảng nhất, nên roadmap ưu tiên khác hẳn kiểu "thêm tính năng mới" — ưu tiên **sửa đúng cái đã có trước khi thêm cái mới**.

### Giai đoạn 1 — Nền tảng timeline (bắt buộc trước mọi thứ khác)

- Đầu kim seek kéo được + click thước thời gian để nhảy (mục 1.1)
- Tách track video/audio rõ ràng, thumbnail trên track video, waveform trên track audio (mục 1.2)
- Trim bằng kéo mép clip (mục 2.1) — đây là thao tác cắt-ghép cơ bản nhất, hiện đang thiếu hoàn toàn nên phải làm trước Split
- Split bằng click/tool (mục 2, đã có nút kéo nhưng cần gắn đúng vào state máy tool)

### Giai đoạn 2 — Sửa Crop + thêm hiệu ứng mặc định

- Crop bằng khung kéo trên preview, đồng bộ với 4 ô số (mục 4.1) — sửa đúng lỗi đang thấy trong ảnh chụp
- Volume/Position/Scale mặc định trên Properties Panel (mục 3) — bao gồm nút Fit/Fill nhanh
- Zoom/scroll timeline theo chuẩn đã có ở Audio Editor (mục 1.3)

### Giai đoạn 3 — Effect tuỳ chọn & tính năng đặc thù

- Fade in/out hình + tiếng (mục 4.3)
- Chỉnh màu cơ bản (mục 4.2)
- Tách âm thanh từ video, kể cả xử lý nhiều track (mục 5)
- Blur theo vùng/thời gian (mục 6) — ưu tiên cao cho TestIO dù nằm giai đoạn 3, có thể đẩy lên sớm hơn nếu nhu cầu che thông tin nhạy cảm cấp thiết hơn màu/fade

### Giai đoạn 4 — Export đầy đủ & tinh chỉnh

- Dialog Export đầy đủ 4 nhóm tuỳ chọn (mục 7) — hiện tại có nút Xuất video nhưng chưa rõ có tuỳ chọn gì, cần làm đầy đủ trước khi coi tool này "hoàn thiện"
- Snapping, ripple/overwrite, Slip tool, marquee chọn nhiều clip (mục 1.5, 2.2, 2.4) — tinh chỉnh nâng cao, không bắt buộc để dùng được nhưng nâng hẳn cảm giác chuyên nghiệp

### Ghi chú

Khác các tool khác trong roadmap tổng (Whiteboard, PDF→Text...), Video Editor **đã có code chạy**, nên phần lớn công sức Giai đoạn 1-2 là sửa lại UI/UX trên nền dữ liệu đã có (track, clip, crop state) chứ không phải xây từ đầu — cần xem lại đúng cấu trúc `core/video`/`features/site/video-editor` hiện tại trước khi bắt tay, có thể nhiều phần chỉ cần đổi cách hiển thị/bắt sự kiện chuột, không cần đổi model dữ liệu.

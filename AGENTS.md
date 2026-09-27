# AGENTS.md

Hướng dẫn cho AI coding agent làm việc trên repo này. Người thật đọc cũng được — đây là những quy ước mà nhìn code không tự suy ra ngay.

## 1. Chạy cái gì để kiểm tra

```bash
pnpm compile     # tsc --noEmit  — chạy đầu tiên, rẻ nhất
pnpm lint        # eslint
pnpm build       # bắt buộc trước khi báo xong: nhiều lỗi chỉ lộ lúc bundle
```

Không có test runner (không jest/vitest). Cách kiểm logic ở mục 5.

## 2. Bốn tầng, phụ thuộc chỉ đi một chiều

```
entrypoints → app → features → core / shared
```

`core` và `shared` **không bao giờ** import ngược lên `app` hay `features`. Đây là quy tắc quan trọng nhất; phá nó là cách dự án thành một cục.

| Tầng | Là gì |
|---|---|
| `entrypoints/` | mỗi bề mặt trình duyệt một thư mục (newtab, popup, site, embed.content, background) |
| `app/` | "vỏ" của từng bề mặt — bố cục, modal, router |
| `features/` | tính năng/tool, mỗi cái một thư mục, **tự đăng ký** |
| `core/` | dịch vụ nền độc lập bề mặt (storage, theme, i18n, registry…) |
| `shared/` | UI kit, icon, hàm thuần dùng mọi nơi |

## 3. Một tool = một thư mục

Trong `features/site/`, `features/embed/`, `features/popup/`, mỗi tool phải **xoá được mà không ai gãy**.

ESLint chặn cứng: một specifier `@/features/**` **bên trong** các thư mục đó là lỗi build. Trong tool của mình thì dùng đường dẫn tương đối; cần dùng chung thì **nâng lên** `@/core` hoặc `@/shared`.

> Hệ quả thực tế: nếu Audio Editor và Video Editor cần cùng một thuật toán, **chép** nó hoặc nâng lên `core`. Đừng import chéo. Video Editor có `engine/waveform.ts` riêng chính vì lý do này, dù Audio Editor đã có `engine/peaks.ts` gần giống.

`features/newtab/` ra đời trước quy ước nên được miễn trừ (vẫn còn vài import chéo). Đừng thêm cái mới.

## 4. Thêm một tool mới

Không đụng code lõi. Đúng hai bước:

1. Tạo `features/site/<ten>/index.tsx` gọi `registerSiteApp({ ... })` (hoặc `features/newtab/<ten>/index.tsx` gọi `registerFeature`).
2. Thêm một dòng `import "./<ten>"` vào barrel `index.ts` của thư mục cha.

Bốn registry (`feature-registry`, `site-registry`, `embed-registry`, `popup-widget-registry`) đều là `Map` + hàm `register*()`, và đăng ký là **side effect của việc import**. Không chỗ nào hardcode danh sách.

Các trường hay bị quên:

| Registry | Trường | Để làm gì |
|---|---|---|
| `registerSiteApp` | `category` | nhóm trên rail trái + trang chủ (`media`/`text`/`dev`/`other`) |
| `registerSiteApp` | `dataTables` | **khai báo mọi bảng Dexie app ghi vào** — trang Cài đặt site dùng để đo dung lượng, backup riêng, xoá dữ liệu. Thiếu = dữ liệu vô hình ở đó |
| `registerFeature` | `overlay` | component vẽ ngoài zone (tự `position: fixed`), mount cả khi panel đóng — vd bong bóng tin tức, bong bóng thời tiết |
| `registerFeature` | `settingsExtra` + `settingsExtraPosition` | UI tuỳ biến cạnh form schema; `"top"` khi phải cấu hình trước (kết nối GitHub) |
| `registerFeature` | `defaultEnabled` | tính năng tốn tài nguyên / cần quyền (music-fx, spotify…) để `false` |

Bảng mới của New Tab thì thêm vào `NEWTAB_TABLES` (`core/storage/scopes.ts`), nếu không nó không nằm trong backup New Tab.

## 5. Logic nặng phải tách khỏi React

Quy ước xuyên suốt: **thuật toán nằm trong `engine/`, là hàm thuần, không import React.**

Vì repo không có test runner, cách kiểm là bundle file thuần đó bằng esbuild rồi chạy dưới Node:

```bash
pnpm exec esbuild <file-test>.ts --bundle --platform=node --format=esm \
  --alias:@=./src --outfile=<out>.mjs && node <out>.mjs
```

Viết file test vào thư mục scratchpad, **không** vào repo. Một hàm chỉ test được khi nó không chạm DOM — đó là lý do thật của quy ước này, không phải vì đẹp.

Ví dụ đang có: `video-editor/engine/tracks.ts`, `compose.ts`, `frameGeometry.ts`; `audio-editor/engine/dsp.ts`; `web-time-tracker/engine/session.ts`; `core/audio-signal/engine.ts` (dải tần, onset, bắt nhịp); `core/storage/backup.ts` (`dehydrate`/`hydrate` — chạy được dưới Node vì chỉ cần `Blob`).

## 5b. Giữ file ngắn

Component quá ~400 dòng thì tách, theo các khuôn đã dùng:

| Tách cái gì | Thành | Ví dụ |
|---|---|---|
| một `useEffect` lớn tự đứng được | hook `useX.ts` cạnh component | `wallpaper/useParallax.ts`, `useWallhavenRandom.ts` |
| migration chạy một lần khi settings hydrate | module side-effect `migrations.ts`, import từ `index.tsx` | `wallpaper/migrations.ts` |
| hằng số / id cần import mà không kéo cả component | `id.ts`, `*-data.ts` | `wallpaper/id.ts`, `settings/contribute-data.ts` |
| sub-component / bước wizard | file riêng cùng thư mục | `overlays/WallpaperStep.tsx`, `bookmark-bar/FolderButton.tsx` |
| thành phần UI kit lớn | file riêng, **re-export** từ `shared/ui/index.tsx` | `Modal.tsx`, `Collapsible.tsx` — import vẫn là `@/shared/ui` |

Tách để dễ đọc, **không đổi hành vi**; `index.tsx` của feature vẫn giữ `registerFeature` và re-export những gì chỗ khác đang import (vd `WALLPAPER_FEATURE_ID`).

Comment: giải thích *vì sao*, không kể lại code. Không để code bị comment-out.

## 6. i18n

Mọi chuỗi hiển thị đi qua `t("namespace.key")`.

- **Dùng chung / vỏ hệ thống**: nằm ở `src/core/i18n/locales/{vi,en}.json`.
- **Mỗi feature/tool riêng**: tự quản lý file `locales/{vi,en}.json` ngay trong thư mục của nó và đăng ký qua `registerI18nResources({ vi: { namespace: vi }, en: { namespace: en } })` trong `index.tsx` (tuân thủ quy tắc 1 tool = 1 thư mục).
- Kiểm tra tính đồng bộ khoá (parity) bằng lệnh:
```bash
pnpm i18n:check   # node scripts/check-i18n-parity.mjs
```
Lệnh này tự động kiểm tra cả `core` lẫn tất cả thư mục `features/**/locales` để đảm bảo khớp 100% giữa `vi` và `en`.


## 7. CSP: không CDN, không eval

`script-src 'self' 'wasm-unsafe-eval'`. Thư viện cần asset ngoài (tesseract, excalidraw…) phải **vendor vào `public/`** và trỏ đường dẫn tường minh. `eslint.config.js` bỏ qua `public/**` — đó là file minified của bên thứ ba, đừng lint hay sửa.

## 8. Những cái bẫy đã cắn rồi

Ghi lại để không đạp lại:

- **StrictMode bật** (`entrypoints/*/main.tsx`). React 18 chạy mount → unmount → remount. **Không bao giờ** đặt thao tác xoá không hoàn tác được vào cleanup của `useEffect` — nó sẽ chạy khi dữ liệu để đối chiếu còn rỗng. Đã từng xoá sạch media của project vì lỗi này.
- **Cleanup `useEffect` với deps `[]` bắt closure của lần render ĐẦU.** Muốn đọc giá trị mới nhất lúc unmount thì dùng ref.
- **Huỷ autosave đang chờ = mất dữ liệu.** Cleanup nên *chạy nốt* thay vì `clearTimeout` rồi thôi.
- **Firefox build là MV2**, Chrome là MV3. `core/messaging` feature-detect để rơi từ `scripting.executeScript` về `tabs.executeScript`.
- **Kiểm API bên thứ ba bằng `.d.ts` trong `node_modules`**, đừng tin trí nhớ. Đã có hai lần tài liệu thiết kế nội bộ mô tả sai API mediabunny và bị bắt ở bước này.
- **Quyền optional: namespace chỉ tồn tại SAU khi được cấp.** `chrome.offscreen`, `chrome.tabCapture` là `undefined` trước khi user đồng ý — đừng dùng chúng để kiểm "trình duyệt có hỗ trợ không" (bản đầu làm thế → nút xin quyền không bao giờ hiện). Và `requestPermissions` phải gọi **đồng bộ trong user gesture** (`core/permissions`): gọi sau một `await` là mất gesture.
- **Service worker không tự nạp code mới.** Bản unpacked: trang (popup/newtab/site) đọc file mới mỗi lần mở, nhưng background chạy code cũ tới khi bấm Tải lại extension. Message mới gửi tới worker cũ nhận về `undefined` — xử lý thành lỗi có tên (`audioMixer.errStaleWorker`) thay vì im lặng.
- **`openPopup()` do code gọi không cấp `activeTab`.** Chỉ cú bấm icon/phím tắt thật mới cấp; `tabCapture` cần nó.
- **Âm thanh: `AnalyserNode.maxDecibels` mặc định −30 làm bass bão hoà** (median dải sub ≈ 0.99 trên nhạc remix) → bắt nhịp chết. Nguồn dùng −10; bus audio-signal scale lại cột visualizer. Hiệu chỉnh bắt nhịp bằng file nhạc thật giải mã qua ffmpeg + giả lập AnalyserNode dưới Node, đừng chỉnh mò trên trình duyệt.
- **`backdrop-filter`/`filter` tạo stacking context mới** → dropdown (gợi ý tìm kiếm) bị widget bên cạnh đè dù `z-index` cao. Sửa bằng nâng cả khối đang focus: `.zone-center > *:focus-within { z-index: 5 }`.
- **PowerShell nuốt dấu `"`** khi truyền chuỗi làm tham số cho `node`/script → `import React from react;`. Dùng nháy đơn hoặc ghi file bằng công cụ Write.

## 9. Commit

Conventional Commits, xem `CONTRIBUTING.md`. Chỉ commit khi được yêu cầu.

## 10. Bản đồ tài liệu

| Đọc khi cần | File |
|---|---|
| Kiến trúc, đặt file ở đâu | `docs/architecture.md` |
| Nguyên tắc chung | `docs/00-tong-quan-va-nguyen-tac.md` |
| Custom Site + quy tắc 1 tool = 1 thư mục, trang Cài đặt site | `docs/site/00-tong-quan.md` |
| Tool nhúng | `docs/embed/00-tong-quan.md` |
| Storage, bảng thuộc ai, backup v2, dọn dung lượng | `docs/core-he-thong/03-storage-backup.md` |
| Audio Mixer (bắt âm thanh tab, offscreen) | `docs/site/07-audio-mixer.md` |
| Hiệu ứng âm nhạc, bus audio-signal, bắt nhịp | `docs/new-tab/05-hieu-ung-am-nhac.md` |
| Các tính năng New Tab gần đây (thời tiết, tin tức, GitHub, hình nền) | `docs/new-tab/06-tinh-nang-gan-day.md` |
| Thiết kế từng tool | `docs/roadmap/*.md`, `docs/site/*.md` |

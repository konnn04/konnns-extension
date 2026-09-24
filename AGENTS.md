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

1. Tạo `features/site/<ten>/index.tsx` gọi `registerSiteApp({ ... })`.
2. Thêm một dòng `import "./<ten>"` vào `features/site/index.ts`.

Ba registry (`feature-registry`, `site-registry`, `embed-registry`) đều là `Map` + hàm `register*()`, và đăng ký là **side effect của việc import**. Không chỗ nào hardcode danh sách.

## 5. Logic nặng phải tách khỏi React

Quy ước xuyên suốt: **thuật toán nằm trong `engine/`, là hàm thuần, không import React.**

Vì repo không có test runner, cách kiểm là bundle file thuần đó bằng esbuild rồi chạy dưới Node:

```bash
pnpm exec esbuild <file-test>.ts --bundle --platform=node --format=esm \
  --alias:@=./src --outfile=<out>.mjs && node <out>.mjs
```

Viết file test vào thư mục scratchpad, **không** vào repo. Một hàm chỉ test được khi nó không chạm DOM — đó là lý do thật của quy ước này, không phải vì đẹp.

Ví dụ đang có: `video-editor/engine/tracks.ts`, `compose.ts`, `frameGeometry.ts`; `audio-editor/engine/dsp.ts`; `web-time-tracker/engine/session.ts`.

## 6. i18n

Mọi chuỗi hiển thị đi qua `t("namespace.key")`. Hai file locale phải **khớp khoá tuyệt đối**:

```bash
node -e '
const f=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"?f(v,p+k+"."):[p+k]);
const a=f(require("./src/core/i18n/locales/en.json")).sort();
const b=f(require("./src/core/i18n/locales/vi.json")).sort();
console.log("parity", JSON.stringify(a)===JSON.stringify(b));'
```

## 7. CSP: không CDN, không eval

`script-src 'self' 'wasm-unsafe-eval'`. Thư viện cần asset ngoài (tesseract, excalidraw…) phải **vendor vào `public/`** và trỏ đường dẫn tường minh. `eslint.config.js` bỏ qua `public/**` — đó là file minified của bên thứ ba, đừng lint hay sửa.

## 8. Những cái bẫy đã cắn rồi

Ghi lại để không đạp lại:

- **StrictMode bật** (`entrypoints/*/main.tsx`). React 18 chạy mount → unmount → remount. **Không bao giờ** đặt thao tác xoá không hoàn tác được vào cleanup của `useEffect` — nó sẽ chạy khi dữ liệu để đối chiếu còn rỗng. Đã từng xoá sạch media của project vì lỗi này.
- **Cleanup `useEffect` với deps `[]` bắt closure của lần render ĐẦU.** Muốn đọc giá trị mới nhất lúc unmount thì dùng ref.
- **Huỷ autosave đang chờ = mất dữ liệu.** Cleanup nên *chạy nốt* thay vì `clearTimeout` rồi thôi.
- **Firefox build là MV2**, Chrome là MV3. `core/messaging` feature-detect để rơi từ `scripting.executeScript` về `tabs.executeScript`.
- **Kiểm API bên thứ ba bằng `.d.ts` trong `node_modules`**, đừng tin trí nhớ. Đã có hai lần tài liệu thiết kế nội bộ mô tả sai API mediabunny và bị bắt ở bước này.

## 9. Commit

Conventional Commits, xem `CONTRIBUTING.md`. Chỉ commit khi được yêu cầu.

## 10. Bản đồ tài liệu

| Đọc khi cần | File |
|---|---|
| Kiến trúc, đặt file ở đâu | `docs/architecture.md` |
| Nguyên tắc chung | `docs/00-tong-quan-va-nguyen-tac.md` |
| Custom Site + quy tắc 1 tool = 1 thư mục | `docs/site/00-tong-quan.md` |
| Tool nhúng | `docs/embed/00-tong-quan.md` |
| Thiết kế từng tool | `docs/roadmap/*.md`, `docs/site/*.md` |

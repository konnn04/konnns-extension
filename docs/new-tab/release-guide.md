# Hướng dẫn Release (dành cho người chỉ biết pull/merge)

Tài liệu này giải thích hệ thống tự động **build + đánh phiên bản + tạo bản phát hành** đã được cài sẵn trong `.github/`. Bạn gần như **không cần làm gì thủ công** ngoài việc push code và merge.

---

## 1. Mô hình 2 nhánh (rất đơn giản)

| Nhánh | Vai trò | Khi có code mới | Kết quả tự động |
|---|---|---|---|
| **`dev`** | Nơi làm việc hằng ngày | push / merge vào `dev` | Tạo **1 bản Beta** (tag `beta`) — *luôn ghi đè*, không tăng version |
| **`main`** | Bản chính thức, ổn định | merge (PR) từ `dev` vào `main` | **Tăng version** + changelog AI + tạo **Release chính thức** |

Nói cách khác:
- Code chưa chắc chắn → để ở `dev` → có Beta để test.
- Khi ổn → merge `dev` vào `main` → ra bản chính thức mới.

3 workflow đã cài trong `.github/workflows/`:
- `ci.yml` — kiểm tra typecheck + build mỗi khi push/PR (cả `main` và `dev`).
- `beta.yml` — chạy khi push vào `dev` → ra bản Beta.
- `release.yml` — chạy khi push/merge vào `main` → ra bản chính thức.

---

## 2. Thiết lập lần đầu (chỉ làm 1 lần)

### 2.1. Đưa code lên GitHub

Trong thư mục dự án, chạy (thay `<user>/<repo>` bằng repo của bạn):

```bash
git init
git add .
git commit -m "chore: initial commit"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

> `.gitignore` đã có sẵn nên `node_modules/`, `.output/`… sẽ **không** bị đẩy lên — yên tâm.

### 2.2. Tạo nhánh `dev`

```bash
git checkout -b dev
git push -u origin dev
```

Từ giờ: **làm việc trên `dev`**, `main` chỉ nhận qua merge.

### 2.3. Cho phép Actions ghi (BẮT BUỘC)

Trên GitHub: **Settings → Actions → General → Workflow permissions** →
chọn **"Read and write permissions"** → **Save**.
(Để workflow có quyền commit version bump và tạo Release.)

### 2.4. (Tùy chọn) Bật changelog AI bằng DeepSeek

Nếu muốn bot viết tóm tắt thay đổi bằng AI:
1. Lấy API key tại <https://platform.deepseek.com>.
2. GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
3. Name: `DEEPSEEK_API_KEY`, Value: dán key vào → **Add secret**.

> Không thêm secret cũng **vẫn chạy được**: changelog sẽ tự tạo từ danh sách commit (nhóm theo Tính năng / Sửa lỗi / Khác). GitHub Copilot **không** có API dùng trong Actions nên ta dùng DeepSeek (hoặc bản fallback).

---

## 3. Quy trình hằng ngày (phần bạn thực sự làm)

### Làm tính năng / sửa lỗi

```bash
git checkout dev
# ...sửa code...
git add .
git commit -m "feat: thêm biểu đồ mặt trời cho thời tiết"
git push
```

→ Workflow **Beta** tự chạy, tạo/ghi đè bản **Beta** ở trang *Releases*. Vào tải zip về test.

### Khi đã ổn, phát hành chính thức

Cách chuẩn (khuyến nghị) — dùng Pull Request:
1. Trên GitHub bấm **Compare & pull request**: base = `main`, compare = `dev`.
2. Đặt tiêu đề PR theo quy ước (xem mục 4) → **Merge pull request**.

→ Workflow **Release** tự: tăng version → build → viết changelog → tạo Release `vX.Y.Z` kèm file `.zip`.

> Nếu thích merge bằng lệnh:
> ```bash
> git checkout main && git pull
> git merge dev && git push
> ```

---

## 4. Version tự tăng thế nào?

Workflow đọc **commit/PR mới nhất** để quyết định (theo chuẩn SemVer `MAJOR.MINOR.PATCH`):

| Nội dung commit/PR | Mức tăng | Ví dụ |
|---|---|---|
| Có `BREAKING CHANGE` hoặc `#major` | **major** | `1.4.2 → 2.0.0` |
| Bắt đầu bằng `feat` hoặc có `#minor` | **minor** | `1.4.2 → 1.5.0` |
| Còn lại (`fix`, `chore`, …) | **patch** | `1.4.2 → 1.4.3` |

Bạn **không cần** tự sửa số version trong `package.json` — workflow tự làm và commit lại (kèm `[skip ci]` để không lặp vô hạn). WXT tự đồng bộ số này vào `manifest.json` khi build, nên **version trong pack luôn khớp**.

Gợi ý đặt commit theo [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`…

---

## 5. Người dùng tải bản phát hành ở đâu?

Trang **Releases** của repo:
- **vX.Y.Z** (Latest) = bản chính thức, mỗi lần merge `main` sẽ có bản mới.
- **Beta (dev)** = bản thử nghiệm mới nhất (luôn ghi đè).

Mỗi release có sẵn zip Chrome + Firefox → tải về → `chrome://extensions` → Bật Developer mode → *Load unpacked* (giải nén) hoặc kéo thả zip.

---

## 6. Xử lý sự cố thường gặp

- **Release không chạy / báo lỗi push:** kiểm tra lại mục **2.3** (Read and write permissions). Nếu `main` có *Branch protection* chặn bot push, vào **Settings → Branches**, cho phép GitHub Actions bypass, hoặc tạo PAT và lưu thành secret rồi dùng ở bước checkout.
- **Beta không thấy:** đảm bảo đã push đúng nhánh `dev` và mục 2.3 đã bật.
- **Changelog chỉ là danh sách commit:** bình thường — nghĩa là chưa thêm `DEEPSEEK_API_KEY` (mục 2.4).
- **Muốn ép ra bản chính thức ngay:** merge một PR bất kỳ vào `main` (dù nhỏ) — patch sẽ tự tăng.

---

## 7. Tóm tắt 1 dòng

> Làm việc trên **`dev`** (được Beta để test) → khi ưng thì **merge vào `main`** → có **bản chính thức mới** hoàn toàn tự động.

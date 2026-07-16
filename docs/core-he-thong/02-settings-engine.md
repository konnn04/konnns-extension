# 06 — Settings System

## 1. Truy cập

- Icon gear ở góc phải dưới màn hình NewTab, chỉ hiện khi hover khu vực đó (tránh chiếm không gian thị giác lúc bình thường).
- Click mở modal toàn màn hình (hoặc gần toàn màn hình) với animation fade + scale nhẹ (~200ms).

## 2. Cấu trúc modal

- Sidebar danh mục bên trái modal = **auto-generate** từ danh sách feature đã `registerFeature` (xem `01-tech-stack-va-kien-truc.md` §3) — không hardcode danh sách category trong UI settings.
- Mỗi category tương ứng 1 feature, hiển thị:
  - Toggle bật/tắt tổng cho feature đó (đặt ngay đầu panel setting của feature).
  - Form các option chi tiết riêng, sinh từ `settingsSchema` của feature.
- Có category "Chung" (General) riêng, không gắn với feature cụ thể: ngôn ngữ, Low-power mode, layout mặc định (single-open vs multi-open sidebar trái), quản lý backup/import-export, mở lại Onboarding.

## 3. Schema-driven Form

- Dùng `react-hook-form` + custom field renderer theo `type` khai báo trong schema:
  - `text`, `number`, `toggle`, `select`, `color`, `slider`, `file` (ví dụ chọn ảnh mặc định), `css-editor` (dùng riêng cho custom clock — xem `05`).
- Ví dụ schema tối giản:
  ```ts
  export const weatherSettingsSchema = defineSchema({
    apiProvider: { type: "select", options: ["open-meteo", "openweathermap", "weatherapi"], default: "open-meteo" },
    apiKey: { type: "text", showIf: (v) => v.apiProvider !== "open-meteo", secret: true },
    location: { type: "text", placeholder: "Nhập tên thành phố hoặc dùng vị trí hiện tại" },
    useGeolocation: { type: "toggle", default: false },
  });
  ```
- Field đánh dấu `secret: true` (API key...) hiển thị dạng password-mask, không log ra console ở bất kỳ đâu.

## 4. Hiệu năng khi disable feature

- Feature bị tắt → **unmount hoàn toàn** khỏi cây component (không chỉ `display: none`), tránh tốn re-render/effect ngầm.
- Store (Zustand) của feature bị tắt vẫn giữ dữ liệu đã lưu (để bật lại không mất cấu hình), nhưng không subscribe/update khi feature đang tắt.

## 5. Validate & Feedback

- Mọi thay đổi setting áp dụng **live** (không cần nút "Lưu" riêng) trừ các trường cần xác nhận rủi ro (ví dụ đổi nguồn bookmark từ API gốc sang danh sách riêng — có thể mất liên kết cũ, cần confirm dialog).
- Lỗi input (ví dụ API key sai định dạng) hiển thị inline ngay dưới field, không dùng alert/toast rời rạc gây rối luồng.

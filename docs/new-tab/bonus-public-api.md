# Bonus — Danh mục Public API dùng cho các feature

Danh sách API công khai để chọn nguồn dữ liệu cho từng feature qua các phase. Nguyên tắc: **ưu tiên nguồn không cần key làm mặc định** (dùng được ngay khi cài), nguồn cần key chỉ là tùy chọn user tự cấu hình trong Settings (field `secret: true`, không log).

> **Đã triển khai (Phase 1):**
> - Weather: **Open-Meteo** (không key) — mặc định.
> - Geocoding tên thành phố → tọa độ: **Open-Meteo Geocoding** (không key).
> - Wallpaper từ nguồn công khai: **Lorem Picsum** (không key) — nút "Ảnh ngẫu nhiên" trong thư viện hình nền.
>
> **Sẽ dùng ở phase sau:** News (RSS + GNews/NewsData...), Dịch (LibreTranslate), Air Quality (OpenAQ), Geoapify/Nominatim autocomplete, Unsplash/Pexels/Pixabay/Wallhaven cho wallpaper cao cấp.
>
> Mọi API cần key đi qua **cùng một cơ chế**: khai báo field `type:"text", secret:true` trong `settings.schema.ts` của feature → form tự sinh ô nhập password-mask, key lưu trong settings (per-feature), không hardcode.

### 🌤️ Weather (NewTab core + Panel chi tiết)
| API | Auth | Mục đích cho extension |
|---|---|---|
| **Open-Meteo** *(đã chọn làm mặc định)* | Không cần key | Nguồn chính — miễn phí, không giới hạn, phù hợp dùng ngay cho MVP |
| **WeatherAPI** | `apiKey` | Lựa chọn phụ cho user tự cấu hình — có kèm luôn Astronomy API (giờ mặt trời mọc/lặn) hữu ích cho panel chi tiết |
| **Weatherstack** (APILayer) | `apiKey` | Lựa chọn phụ khác, dữ liệu real-time + historical nếu sau này làm biểu đồ nhiệt độ theo lịch sử |

### 📍 Geocoding / Vị trí (để lấy tọa độ cho Weather khi không dùng Geolocation API)
| API | Auth | Mục đích |
|---|---|---|
| **ipapi.co** | Không cần key | Tự động đoán vị trí theo IP làm fallback khi user không cấp quyền Geolocation |
| **Nominatim** (OpenStreetMap) | Không cần key | Cho user nhập tên thành phố → chuyển thành tọa độ (search-to-coords) |
| **Geoapify** | `apiKey` | Lựa chọn dự phòng nếu cần autocomplete địa danh mượt hơn Nominatim |

### 🖼️ Wallpaper (nguồn ảnh cho tính năng đổi hình nền)
| API | Auth | Mục đích |
|---|---|---|
| **Lorem Picsum** *(đã đề xuất)* | Không cần key | Nguồn ảnh mặc định đơn giản nhất, không cần đăng ký |
| **Unsplash** | `OAuth` | Chất lượng ảnh cao nhất, có category search (nature, ocean...) khớp với 5 theme |
| **Pexels** | `apiKey` | Thay thế Unsplash, có cả **video** miễn phí — hợp với tính năng video wallpaper |
| **Pixabay** | `apiKey` | Thêm nguồn ảnh/video đa dạng, free tier rộng rãi |
| **Wallhaven** | `apiKey` | Chuyên wallpaper độ phân giải cao, hợp gu nếu muốn phong cách "wallpaper cộng đồng" thay vì ảnh chụp thực tế |

### 📰 News Feed
| API | Auth | Mục đích |
|---|---|---|
| **GNews** | `apiKey` | Đa nguồn tin quốc tế, dễ filter theo từ khóa/chủ đề |
| **NewsData** | `apiKey` | Có hỗ trợ nhiều ngôn ngữ — hợp với yêu cầu song ngữ |
| **Currents** | `apiKey` | Multilingual, real-time, làm nguồn dự phòng |
| **Mediastack** (APILayer) | `apiKey` | Cùng hệ sinh thái APILayer với Weatherstack — tiện nếu dùng chung 1 dashboard/API key |

*(RSS công khai vẫn nên là nguồn chính theo khuyến nghị trước — các API trên chỉ dùng khi user muốn thêm nguồn có filter/search mạnh hơn.)*

### 🌐 Dịch nhanh (nút "Dịch nhanh" trong News panel)
| API | Auth | Mục đích |
|---|---|---|
| **LibreTranslate** | Không cần key (self-host được) | Nhẹ, miễn phí, phù hợp làm mặc định cho tính năng dịch song ngữ thay vì bắt buộc user tự có key |

### 🌫️ Air Quality (bổ sung optional cho Weather chi tiết)
| API | Auth | Mục đích |
|---|---|---|
| **OpenAQ** | `apiKey` | Dữ liệu chất lượng không khí mở, hợp bổ sung AQI vào panel Weather chi tiết (Phase 2) |


# 🎓 Học Viện 4D Gia Đình — Ứng Dụng Tự Học Song Não 4D (Lớp 4 • Lớp 7 • Lớp 10)

Ứng dụng học tập tương tác thuần **HTML5 + CSS3 + Vanilla JS (ES6)** dành cho gia đình Việt Nam, chạy trực tiếp trên trình duyệt web hoặc **GitHub Pages** — không cần máy chủ, không cần cài đặt phần mềm nặng, bảo mật tuyệt đối khóa API trên trình duyệt của người dùng.

---

## ✨ Tính năng nổi bật

1. **2 Phiên bản giao diện dùng chung dữ liệu:**
   - **Bản Cổ Điển (`./index.html`):** Sáng sủa, tinh gọn, dễ thao tác ngay cho mọi lứa tuổi.
   - **Bản Rạp Chiếu 4D Cinema (`./cinema4d.html`):** Sân khấu chia đôi kéo giãn được, 3 chế độ bảo vệ mắt (*Điện Ảnh 4D / Dịu Mắt / Sketchnote*), Bảng vẽ dạ quang phủ trực tiếp lên bài giảng, Nhạc tập trung 432Hz, Hiệu ứng SFX & Pháo hoa chúc mừng, **Gia Sư AI 4 Nhân Vật** và **Nhật Ký Học Tập 4D**.

2. **✨ Xưởng Tạo Bài Giảng 4D Tự Động (1 Chạm):**
   - Hỗ trợ đồng thời: dán ảnh chụp trang sách / bìa sách bằng `Ctrl + V` (tự động nén gọn `≤ 1280px` JPEG `0.8` tiết kiệm RAM), tải ảnh / `.pdf` (< 10MB) / `.txt` / `.md`, chụp trực tiếp từ camera điện thoại, hoặc gõ tên chủ đề.
   - Tự động phân tầng sư phạm chuẩn cho **Lớp 4** (6 trang), **Lớp 7** (8 trang), **Lớp 10** (10 trang) kèm Thẻ lật 3D chuyển hóa tư duy và Trắc nghiệm kiểm tra nhanh tích sao.

3. **🔍 Tự Động Tìm Ảnh, Video YouTube An Toàn & Sơ Đồ SVG Ngoại Tuyến:**
   - Tầng 1: YouTube Data API v3 (`safeSearch=strict`, xác thực quyền nhúng trực tiếp ngay trên màn hình bài học).
   - Tầng 2: Pixabay API (nếu nhập key) hoặc **Wikimedia Commons miễn phí 100%**.
   - Tầng 3: Sơ đồ minh họa vector `fallback_svg` được AI vẽ riêng cho từng slide và làm sạch an toàn tuyệt đối (không bao giờ có trang trống).

4. **🎙️ Phòng Thu Giọng Giảng Việt Nam Truyền Cảm:**
   - Tích hợp 5 giọng AI người Việt giàu cảm xúc (*Cô Minh Châu, Cô Thảo Nhi, Chị Hà My, Thầy Quang Minh, Anh Khôi Nguyên*) và tự động dự phòng sang giọng Việt Tự Nhiên trên trình duyệt khi ngoại tuyến.

---

## 🚀 Hướng dẫn sử dụng nhanh cho Phụ huynh & Học sinh

1. **Mở ứng dụng:** Truy cập link **GitHub Pages** của gia đình (hoặc chạy tệp `Mo_HocVien4D_Cinema.bat` / `Mo_HocVien4D.bat` khi dùng trên máy tính cá nhân).
2. **Cài đặt khóa API (chỉ làm 1 lần trên mỗi máy):**
   - Bấm nút **👨‍👩‍👧 Chế Độ Phụ Huynh**.
   - Dán **Gemini API Key** (lấy miễn phí tại Google AI Studio) → bấm **🧪 Kiểm tra kết nối API Key** → bấm **💾 Lưu Cài Đặt**.
   - *(Tùy chọn)* Có thể dán thêm `YouTube Data API Key` và `Pixabay API Key` nếu muốn tự tìm video YouTube và ảnh Pixabay.
3. **Tạo bài giảng 1 chạm:**
   - Bấm **✨ Tạo Bài Học Mới (1 Chạm)** → Chọn lớp của con (**Lớp 4 / Lớp 7 / Lớp 10**).
   - Dán ảnh trang sách (`Ctrl + V`), thả tệp PDF/Ảnh hoặc gõ chủ đề cần ôn tập → bấm **🚀 Khởi Tạo Bài Giảng 4D**.
   - Xem nhanh danh sách trang, bấm **🎓 Bắt Đầu Học Ngay** (và có thể bấm **💾 Tải File JSON Sao Lưu** để chia sẻ hoặc lưu giữ).

---

## 🔒 Cam kết bảo mật
- Mã nguồn công khai **tuyệt đối không chứa bất kỳ API Key nào**.
- Mọi API Key, bài học, điểm sao và nhật ký học tập chỉ được lưu cục bộ trong `localStorage` của trình duyệt người dùng cuối.

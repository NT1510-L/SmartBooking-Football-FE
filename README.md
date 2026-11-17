# SmartBooking Football Web

React UI cho User đặt và thanh toán sân, Manager quản lý sân và bảng giá, Admin quản lý chi nhánh, phân công và đối soát.

User cọc 50% để xác nhận lịch. Chi tiết lịch hiển thị tổng giá, tiền cọc và phần còn lại thu tại sân. Manager/Admin có thao tác check-in và xác nhận khoản đã thu. Lịch quá mười phút sau giờ bắt đầu mà chưa check-in hiển thị trạng thái không đến sân. Mỗi chi nhánh có tối đa ba sân.

Chạy `npm ci`, sau đó `npm run dev`. Vite chuyển tiếp `/api` tới Booking API tại `http://localhost:5045`. Chạy `npm run build` để tạo bản build. Docker Compose ở repo backend build frontend và cấu hình Nginx chuyển tiếp API.

Trên Vercel, `vercel.json` build bằng mode `vercel` và chuyển tiếp `/api` sang Render. Trình duyệt gọi API cùng domain với frontend, bao gồm các Preview. Khi đổi URL backend, cập nhật rewrite trong `vercel.json`. Các bản build khác có thể dùng `VITE_API_BASE_URL`.

Backend cần migration `07-deposit-check-in.sql` cho nghiệp vụ cọc/check-in. Để chạy kiểm thử API và Chrome cho cả ba vai trò, mở repo backend và chạy `./scripts/test.ps1` sau khi đã `npm ci` ở frontend.

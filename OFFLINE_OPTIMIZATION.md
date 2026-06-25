# HƯỚNG DẪN TỐI ƯU HÓA HOẠT ĐỘNG NGOẠI TUYẾN (OFFLINE RUNTIME OPTIMIZATION)

Tài liệu này ghi lại kiến thức và cách tối ưu hóa ứng dụng CDEViewer để có thể hoạt động hoàn toàn ngoại tuyến (Offline), không phụ thuộc vào kết nối Internet khi tải mô hình 3D.

---

## 1. Vấn đề Web Worker trước đây
Trong phiên bản gốc, đường dẫn Web Worker nạp mô hình 3D được cấu hình từ xa (Remote URL):
```typescript
export const WORKER_URL =
  'https://thatopen.github.io/engine_fragment/resources/worker.mjs';
```
* **Rủi ro:** Khi trình duyệt của người dùng cuối không có kết nối Internet (ví dụ: mang máy tính ra công trường, chạy trong mạng nội bộ intranet bảo mật của doanh nghiệp), trình duyệt sẽ báo lỗi mạng khi `fetch` tệp tin `worker.mjs` này, dẫn đến ứng dụng bị treo và không nạp được mô hình BIM.

---

## 2. Giải pháp tối ưu hóa Offline đã triển khai
1. **Tải Web Worker về máy cục bộ:**
   - Tệp tin `worker.mjs` đã được tải trực tiếp từ máy chủ OpenBIM và lưu trữ trong thư mục public của dự án:
     `public/worker.mjs`
2. **Cấu hình lại đường dẫn tương đối (Relative Path):**
   - Trong tệp `src/config.ts`, hằng số `WORKER_URL` đã được thay thế thành:
     ```typescript
     // Sử dụng đường dẫn tương đối trỏ tới thư mục /public/ của dự án để hỗ trợ chạy Offline hoàn toàn
     export const WORKER_URL = '/worker.mjs';
     ```
3. **Cơ chế hoạt động:**
   - Do thư mục `public/` được Vite đóng gói và phân phối trực tiếp ở gốc của server khi biên dịch, trình duyệt sẽ tải tệp tin `/worker.mjs` trực tiếp từ chính domain đang chạy ứng dụng (ví dụ: `http://localhost:5173/worker.mjs` khi chạy dev hoặc domain thật khi deploy).
   - Ứng dụng giờ đây hoạt động ngoại tuyến 100% khi người dùng nạp mô hình 3D.

---

## 3. Các lưu ý bảo trì tương lai
* **Cập nhật thư viện:** Nếu trong tương lai bạn nâng cấp phiên bản thư viện `@thatopen/components` hoặc `@thatopen/fragments`, hãy kiểm tra xem tệp `worker.mjs` của họ có thay đổi cấu trúc không. Nếu có, hãy tải bản mới nhất của file worker tương thích từ kho thư viện của `@thatopen` và thay thế vào tệp `public/worker.mjs` cục bộ.

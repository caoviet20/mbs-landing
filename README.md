# MakeViral.Pro — Membership Landing Page

Landing page giới thiệu cộng đồng học tập MakeViral.Pro, giúp người xem tìm hiểu cách học, khám phá quyền lợi và lựa chọn giữa Membership và Membership Plus.

**[Xem landing page](https://makeviral-membership-blue-design.rarebean4.chatgpt.site/)**

## Chạy trên máy

Đây là website tĩnh bằng HTML, CSS và JavaScript; không cần cài dependency hay chạy bước build.

Clone repo, rồi phục vụ thư mục `dist` bằng một static server. Ví dụ, nếu đã có Python:

```sh
git clone https://github.com/caoviet20/mbs-landing.git
cd mbs-landing
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Mở [http://127.0.0.1:4173](http://127.0.0.1:4173). Nhấn `Ctrl+C` tại terminal để dừng server. Trên Windows có thể dùng `py` thay cho `python` nếu máy cài Python Launcher.

## Chỉnh sửa ở đâu?

| Nội dung cần sửa | File sở hữu |
| --- | --- |
| Bố cục trang, nội dung section, CTA và đường dẫn thanh toán/liên hệ | [dist/index.html](dist/index.html) |
| Dữ liệu case study, tính năng, FAQ và bảng quyền lợi | [dist/content.js](dist/content.js) |
| Màu sắc, khoảng cách, component và bố cục responsive | [dist/styles.css](dist/styles.css) |
| Font và text styles | [dist/typography.css](dist/typography.css) |
| Điều khiển case study, FAQ, menu và hộp thoại | [dist/app.js](dist/app.js) |
| Showcase tính năng và chuyển video | [dist/feature-showcase.js](dist/feature-showcase.js) |
| Logo, hình ảnh, font và giấy phép tài sản đi kèm | [dist/assets](dist/assets) |

Giữ đường dẫn tài sản tương đối để trang có thể được phục vụ từ thư mục `dist` trên các nền tảng hosting tĩnh khác.

## Nguyên tắc khi cập nhật

- Giữ hệ nhận diện xanh, typography và các trạng thái tương tác hiện có.
- Khi đổi nội dung, kiểm tra desktop và mobile, đặc biệt dải cuộn ngang của case study/tính năng, bảng quyền lợi, menu và FAQ.
- Case study và một số số liệu hiện là nội dung minh họa phục vụ review. Cần thay bằng dữ liệu có nguồn và tư liệu được duyệt trước khi sử dụng làm bằng chứng kết quả thực tế.
- Video tính năng và trích đoạn livestream còn chờ bổ sung. Nguồn video/poster của showcase nằm trong [content.js](dist/content.js); giữ vùng chờ khi chưa có tư liệu thật.
- Giá, quyền lợi và phạm vi hỗ trợ phải được người phụ trách xác nhận trước khi thay đổi. Không tự tạo tham số chọn gói cho URL thanh toán.
- Giữ các file giấy phép font/icon trong thư mục tài sản khi phân phối lại mã nguồn.

## Hosting và xuất bản

Cấu hình Sites hiện tại nằm trong [.openai/hosting.json](.openai/hosting.json), trỏ tới thư mục tĩnh `dist`.

Push lên GitHub lưu mã nguồn; repo chưa có workflow tự động xuất bản. Để đưa thay đổi lên Site hiện tại, cần đồng bộ nguồn và xuất bản qua Sites. Nếu triển khai ở nền tảng khác, đặt thư mục public/output là `dist`; không cần lệnh build.

Repo này chứa mã nguồn landing page và tài sản cần để chạy trang. Bộ design system xuất riêng cùng hồ sơ làm việc nội bộ không nằm trong repo.

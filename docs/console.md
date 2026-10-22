# Trang quản lý (/console)

Trang web để quản lý dữ liệu của Xóm Đảo: người dùng, vật phẩm và sự kiện. Bản thật ở
https://xomdao.vercel.app/console, trên máy ở http://localhost:5033/console khi chạy `npm run dev`.

## Vào trang

Trang hỏi một câu; trả lời đúng thì được vào. Không phân biệt hoa thường và khoảng trắng thừa,
nhưng phải đúng dấu. Sai 5 lần trong 10 phút thì phải chờ. Lần vào giữ 12 giờ trong tab đó; server
khởi động lại (Render ngủ, triển khai mới) thì phải trả lời lại.

Đổi câu trả lời: đặt biến môi trường `XOMDAO_CONSOLE_ANSWER` cho server (trên Render). Không đặt
thì dùng câu trả lời mặc định có sẵn trong code.

## Người dùng

Danh sách tài khoản, mới nhất trước, tìm theo tên đăng nhập hoặc tên hiển thị.

- **Thêm**: tên đăng nhập, mật khẩu, tên hiển thị; cùng luật như khi đăng ký trong game. Ảnh đại
  diện là một ảnh miễn phí chọn ngẫu nhiên.
- **Sửa**: đổi tên hiển thị hoặc đặt mật khẩu mới. Mật khẩu mới đăng xuất tài khoản khỏi mọi máy.
- **Xoá**: xoá tài khoản cùng xu, túi đồ, điểm sự kiện, thống kê và thành tích. Lịch sử ván vẫn
  giữ tên người chơi. Không hoàn tác được.

## Vật phẩm

Mọi món có trong Chợ và Túi đồ, lưu ở bảng `items` trong database. Sửa ở đây thì Chợ đổi ngay.

- **Loại**: ảnh đại diện, khung, lưng bài, biểu cảm.
- **Hình**: chỉ chọn được hình mà client đã có tranh. Mỗi hình chỉ thuộc một món; muốn bán một hình
  mới thì phải thêm tranh vào client trước.
- **Giá**: tính bằng xu; 0 là miễn phí, ai cũng có.
- **Mã món**: dạng `core:frame-jade`, không đổi được sau khi tạo. Đừng dùng lại mã của món đã xoá,
  vì túi đồ của người đã mua vẫn nhớ mã đó.
- **Xoá**: món biến mất khỏi Chợ và Túi đồ. Ai đang đeo thì vẫn giữ tới khi đổi sang món khác.

## Sự kiện

Chưa làm; trang đang để trống.

## Mã nguồn

- Trang: `apps/console` (Vite + React). `npm run build -w @xomdao/console` build vào
  `apps/console/dist`; `npm run dev` tự build lại khi sửa.
- API: `apps/server/src/console` (`/api/console/*`), danh sách vật phẩm ở `apps/server/src/items`.

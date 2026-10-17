# Làm lại hình ảnh Cờ tỷ phú

Làm liên tục theo thứ tự dưới đây; dừng khi đã có một thay đổi đủ lớn để xem trong Godot và
nhận phản hồi. Các mục là hướng ưu tiên, không phải cổng duyệt bắt buộc. Điều chỉnh phạm vi
checkpoint theo kết quả thực tế, tránh làm công cụ duyệt riêng khi bàn thật đã đủ để xem.

## Hướng làm

1. **Bàn tĩnh và vật liệu:** dựng bề mặt, các ô, dấu sở hữu, công trình và quân bằng Blender;
   ghép vào bàn Godot thật. Làm sạch bố cục và giảm diện tích bảng lượt nếu cần.
2. **Trạng thái:** xem đất trống/có chủ, 1–4 nhà/khách sạn, thế chấp, bộ đất, nhiều quân cùng ô
   và các quyết định của ván. Dùng tình huống cố định khi cần, không chờ chơi ngẫu nhiên.
3. **Idle:** chọn vài chi tiết trang trí có giá trị để thử image-to-video, sau khi hình tĩnh ổn.
   Khóa camera và vị trí; chỉ lá, nước, cờ hoặc ánh sáng chuyển động. Giữ bản tĩnh dự phòng.
4. **Phản hồi và VFX:** chọn ô, di chuyển, xúc xắc, tiền, xây dựng, thẻ, tù/sân bay và chiến thắng.
   Godot điều khiển thời điểm và kết quả đúng snapshot; xem lại cả chuỗi hành động.
5. **Hoàn thiện:** kiểm tra khung điện thoại/web, độ rõ, chi phí atlas, tải game và độ mượt.

## Cách làm asset

- Dùng chung camera, ánh sáng, tỷ lệ và điểm neo. Tạo ảnh bàn và tọa độ ô từ cùng nguồn.
- Tách model để dễ chỉnh nhưng xuất theo cụm khi giúp ghép đẹp và gọn hơn. Một ô ghép mặt,
  dấu chủ, cụm nhà, dấu thế chấp và dấu chọn; không bake mọi tổ hợp thành ảnh toàn ô.
- Blender lo hình khối, vật liệu và bóng. Godot lo chữ, số và trạng thái động; UI dùng kit chung.
- Image-to-video dùng cho trang trí idle, không dùng để quyết định hình xúc xắc, số nhà hoặc
  vị trí quân. Tách clip thành atlas phù hợp, kiểm tra viền alpha, điểm nối và bộ nhớ thực.
- Tận dụng nguồn đang có nếu đạt chất lượng. Giữ luật và dữ liệu server hiện tại.

## Checkpoint

Xem trực tiếp bàn thật bằng Godot đã ghim của dự án (`npm run godot -- --editor`) và sandbox
bản web debug `/?play=co-ty-phu-classic`. Khi cần một tình huống khó gặp, tạo cảnh mẫu nhỏ dùng
chính phần hiển thị của game. Mỗi checkpoint ghi ngắn những gì đã làm và phần còn lại.
Agent tự kiểm tra hình bằng screenshot headless, chạy các check liên quan theo AGENTS.md,
rồi dừng để chủ dự án xem và góp ý. Không bắt buộc duyệt từng thành phần nhỏ.

Tham chiếu: [hướng nghệ thuật](../../docs/art-direction.md),
[khung trải nghiệm](../../docs/experience.md), [luật](RULES.md).

## Checkpoint đầu tiên

Đã dựng lại bàn tĩnh bằng Blender, thu gọn bảng lượt, thêm dải màu bộ đất và ghép atlas dấu
chủ/nhà có mái/khách sạn trong bàn Godot. Tọa độ bàn được sinh trực tiếp cho Godot.
`godot/visual_review.tscn` là scene nhỏ dùng bàn thật với các tình huống mẫu để xem ngay bằng F6.
Phần idle image-to-video, hiệu ứng bộ đất và các VFX mới còn làm sau phản hồi về hình tĩnh.

## Checkpoint màu và trạng thái

Công trình được kết xuất đủ bốn màu, gồm cả thân và mái. Badge sở hữu, biểu tượng và công trình
đổi đồng bộ khi đổi chủ; màu bộ monopoly cố định. Đã thêm viền hai ô/đủ bộ và cảnh xem đổi chủ,
thế chấp, thu hồi. Các cảnh dùng cùng bộ hiển thị với bàn thật. Chuyển động idle và VFX sự kiện
vẫn là phần tiếp theo sau khi xem độ rõ của màu và các trạng thái này.

Chữ và biểu tượng tài sản hiện chia ba hàng: tên, biểu tượng lớn, giá. Giữ hướng đọc trên cả
bốn cạnh; kích thước và trục chữ bám phối cảnh mặt ô. Biểu tượng SVG đổi màu theo chủ, giọt
nước có dòng sáng chuyển động và tia điện có nhịp chớp nhẹ.

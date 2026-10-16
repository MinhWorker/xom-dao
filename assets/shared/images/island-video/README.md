# Ảnh đầu vào cho video đảo

Năm ảnh PNG ngang 16:9 (`*-16x9.png`), tạo lại bằng công cụ `image_gen` tích hợp từ từng
ảnh đảo đã duyệt. Giữ phong cách, góc nhìn và các chi tiết nhận diện của mỗi đảo.
Công cụ trả ảnh 1672 × 941 px (xấp xỉ 16:9 do làm tròn pixel); khi tạo video chọn 16:9. Ảnh nguồn giữ nền magenta để đưa vào công cụ image-to-video rồi tách
nền sau khi có clip.

| Ảnh | Đảo |
| --- | --- |
| [bai-16x9.png](bai-16x9.png) | Bài: quạt bài, đình mái ngói, cờ xanh và thác nước |
| [co-16x9.png](co-16x9.png) | Cờ: bàn cờ đá, quân tròn đỏ/đen, đình và tre |
| [su-kien-16x9.png](su-kien-16x9.png) | Sự kiện: đèn ông sao, dây đèn lồng, bàn trà |
| [hanh-dong-16x9.png](hanh-dong-16x9.png) | Hành động: bom hoạt hình, hòm gỗ, thùng và cây dừa |
| [sap-co-16x9.png](sap-co-16x9.png) | Sắp có: cổng gỗ đóng, trụ đá, cây và tre |

Đã kiểm tra từng ảnh: toàn bộ đảo, thác nước và dây leo nằm trong khung. Sắp có được tạo đủ
màu; trạng thái khóa và sương sẽ do Godot thêm.

Prompt tạo ảnh chính xác cùng thông tin file nằm trong [prompts.json](prompts.json), đồng thời
được ghi vào `assets/prompts.json` với tên `island-<id>-video-source`. Prompt image-to-video cho
mỗi ảnh nằm trong [island-prompts.md](../../../sources/island-prompts.md); mỗi prompt có câu
`Make entire island inside the frame.` Bản sao riêng để dán trực tiếp:
[Bài](bai-image-to-video.txt), [Cờ](co-image-to-video.txt), [Sự kiện](su-kien-image-to-video.txt),
[Hành động](hanh-dong-image-to-video.txt), [Sắp có](sap-co-image-to-video.txt).

Dùng bản `*-16x9.png` làm ảnh đầu vào, chọn video 16:9, khóa camera và giữ phần nền trống quanh
đảo. Chỉ chuyển động nước, lá, cờ, đèn hoặc ánh than; toàn bộ khối đảo giữ nguyên vị trí, góc
nhìn và kích thước. Chuyển động lên xuống sẽ do game xử lý. Các bản vuông `co.png`,
`su-kien.png`, `hanh-dong.png`, `sap-co.png` được giữ lại làm nguồn tham chiếu. Nếu công cụ hỗ trợ
frame đầu/cuối, có thể dùng cùng ảnh cho cả hai. Ảnh PNG không được tải trực tiếp vào sảnh; cả năm đảo
đang dùng bộ clip đã xử lý từ `.blender/bai-diorama/new/`. Công thức chuyển đổi nằm trong
[README bản thử](../../../sources/previews/README.md).

# Bản thử đảo Bài

Diorama Blender để duyệt hướng hình ảnh cho đảo Bài ở sảnh. Bản thử có sân đá tròn, quạt bài
viền đồng, mái vải đỏ, cờ xanh, cây, đèn và thác nước. Cây, cờ và nước có chuyển động vòng lặp.

Từ thư mục gốc, dùng Blender có Cycles và Pillow:

```bash
blender -b --python assets/sources/previews/bai_diorama.py -- --still --size 800 --samples 32
blender -b --python assets/sources/previews/bai_diorama.py -- --frames 32 --size 720 --samples 24
python3 assets/sources/previews/pack_bai_diorama.py
```

Kết quả nằm trong `.blender/bai-diorama/` (được git bỏ qua):

- `bai-diorama.blend`: cảnh có mô hình, vật liệu, đèn, camera và animation dài 64 frame.
- `still.png`, `frame-*.png`: render nền trong suốt.
- `bai-diorama-review.png`, `bai-diorama-review.gif`: ảnh và GIF trên nền trời để duyệt.

GIF dùng một bảng màu chung để hạn chế nhấp nháy, lặp khoảng bốn giây. Nền trời chỉ được ghép
khi đóng gói bản xem trước. Script chưa thay ảnh, atlas hay scene đảo trong Godot.

## Thử animation từ video AI

Cả năm đảo trong sảnh dùng bộ clip mới do chủ dự án cung cấp trong
`.blender/bai-diorama/new/`. MP4 nguồn được giữ nguyên; không dùng âm thanh của clip.
Script cần Python có Pillow, NumPy và `ffmpeg`, `ffprobe` trong PATH.

| Đảo | MP4 nguồn |
| --- | --- |
| Bài | `Animate_card-game_island_loop_20261016114614.mp4` |
| Cờ | `gemini_generated_video_142c61de.mp4` |
| Sự kiện | `gemini_generated_video_006be33f.mp4` |
| Hành động | `gemini_generated_video_1bc169a7.mp4` |
| Sắp có | `gemini_generated_video_d40df302.mp4` |

Mỗi clip được cắt khung vuông `(720, 720, 280, 0)` từ video 1280 × 720 để bỏ vùng magenta
thừa hai bên và watermark ở góc phải. Không cắt vào đảo. Thu vừa khung 512 × 512, giữ tỷ lệ,
thêm lề 12 px mỗi cạnh. Dùng từ giây 0, lấy 56 frame ở 12 fps; 48 frame thành vòng lặp 4 giây,
8 frame dùng chuyển tiếp. Chuyển động nhấp nhô của cả đảo do Godot xử lý.

Lệnh tái tạo cho từng dòng trong bảng (thay `<file>` và `<id>`):

```bash
python3 assets/sources/previews/key_island_video.py .blender/bai-diorama/new/<file> --island <id> --crop 720:720:280:0 --start 0 --fps 12 --inset 12 --matte-padding 8 --install
```

`--matte-padding 8` giới hạn alpha theo hình đảo ở frame đầu, mở rộng 8 px để giữ chuyển động
lá, cờ và nước, đồng thời bỏ phần hạt sáng/lá bay được model thêm trên nền trống. Tùy chọn này
chỉ phù hợp clip camera cố định; mặc định tắt cho các clip khác.

Mỗi đảo có ba atlas `<island>-video-*.webp` trong `apps/client/hub/genres/`, được phát bằng
`<island>.tscn`. Script tách nền magenta, khử màu nền ở viền và ghép chuyển tiếp tám frame cuối.
Các PNG alpha, MP4 đã cắt và `recipe.json` ở `.blender/<island>-video/`; nếu không có `--install`,
atlas và scene cũng ở đó. GIF `<island>-video-review.gif` có nền trời; `edge-check.png` kiểm tra
viền trên nền sáng và tối.

Mỗi bộ ba atlas có 48 MiB điểm ảnh RGBA khi giải nén. Năm đảo dùng tổng 240 MiB điểm ảnh
trước các tối ưu của renderer. Lệnh Blender cũ ghi đè scene; để giữ video, không bake lại các
đảo này hoặc chạy lại lệnh chuyển đổi tương ứng.

Prompt tạo ảnh và image-to-video nằm trong [island-prompts.md](../island-prompts.md).

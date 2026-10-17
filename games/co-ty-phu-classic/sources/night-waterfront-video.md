# Nền phố ven đảo về đêm

Ảnh đầu vào: [night-waterfront.webp](../assets/night-waterfront.webp), 1920 × 1080 (16:9).
Ảnh được tạo bằng công cụ imagegen tích hợp; prompt ảnh nằm trong `prompts.json`.
Bàn cờ và HUD do Godot vẽ phía trên, không xuất hiện trong ảnh hay video.

## Prompt image → video

```text
Animate this exact image as a subtle seamless idle background for a board game.
Maintain the exact 16:9 composition, architecture, colours and lighting of the input image.
Camera is completely locked: no zoom, dolly, pan, tilt, orbit, reframing or camera shake.
The entire environment stays anchored in place: no global floating, no up-and-down bobbing,
no breathing scale, no drifting islands or buildings. Make entire island inside the frame.
Only animate very slow small water ripples and their warm reflected lantern light.
Allow barely perceptible palm-leaf movement at the outer edges and a tiny gentle lantern flicker.
Keep boats moored in the same place. Keep all houses, piers and rocks completely still.
Preserve the quiet dark teal open water in the middle for an overlaid game board.
Do not introduce people, birds, particles, fireworks, waves, rain, new objects, text or UI.
Keep exposure constant. No dramatic lighting changes or moving shadows across the centre.
Create an 8-second continuous loop: end on the same composition and motion phase as the first
frame, with no fade, cut, transition, black bars or borders. Output landscape 16:9.
```

## Dùng trong game

Video đầu vào do chủ dự án cung cấp: `.blender/co-video/raw/gemini_generated_video_5cb775de.mp4` (10 giây, 1280 × 720, 24 fps).
`prepare_background.py` bỏ âm thanh, giảm còn 15 fps và trộn 0,8 giây cuối với đầu clip để vòng lặp liền hơn.
Đầu ra `assets/night-waterfront.ogv` được chép sang `godot/art/`, phát lặp bằng `background.gd`; ảnh tĩnh ở phía dưới làm nền dự phòng.

Tạo lại từ gốc repo:

```bash
python games/co-ty-phu-classic/sources/prepare_background.py .blender/co-video/raw/gemini_generated_video_5cb775de.mp4
```
Khi xuất video, giữ nguyên 16:9 và camera; các gợn nước phải nhỏ hơn độ nổi của bàn cờ.
Xem vòng lặp ít nhất ba lần để phát hiện điểm nối, đổi sáng hoặc trôi camera trước khi tích hợp.

# Cờ Tướng

Cờ Tướng cho hai người, chơi với bạn hoặc máy.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Nước đi, chiếu và nước hợp lệ | `src/game/rules.ts` |
| Lặp thế cờ, chiếu dai và đuổi dai | `src/game/referee.ts` |
| Lượt, xin hoà, đầu hàng và kết thúc | `src/game/XiangqiGame.ts` |
| Máy và tuỳ chọn | `src/game/bot.ts`, `model.ts` |
| Bàn chơi: cảnh đình, bàn, đường kẻ, quân, vỡ quân, cuộn chiếu tướng, `room_setup()` và `result_detail()` | `godot/main.gd`, `godot/main.tscn` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
http://localhost:5033/?play=xiangqi (chơi với máy trên server thật). Kiểm tra bằng
`npm run check`, `npm run godot:check` và `npm run shots -- --path '/?play=xiangqi'`.
Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

Bàn có nền hồ sen tối dần ra mép, bàn và bóng của bàn, đường kẻ, chữ 楚河 漢界, quân và bóng,
vòng chiếu tướng nhấp nháy, tấm biển lượt, khay quân đã ăn và các nút. Quân bị ăn bị đánh văng, xoay rồi tan; thông báo chiếu là một cuộn giấy mở ra
rồi cuộn lại. Quân là từng ảnh cắt từ atlas `assets/pieces.webp`, chưa có đèn normal map. Nước đi
hợp lệ lấy từ `moves` trong view của server (chỉ có khi tới lượt mình), nên luật chỉ nằm ở
TypeScript.

## Tài nguyên

Hình bàn gỗ óc chó viền nổi mỏng sinh bằng Image Gen; nền hồ sen thủy mặc nhìn thẳng từ trên
xuống, giữa là mặt nước trống để đặt bàn, sinh bằng Antigravity (`agy`). Cả hai dùng prompt trong
`sources/prompts.json`; prompt tạo video loop nền
10 giây nằm ở
[`sources/pavilion-video-prompt.md`](sources/pavilion-video-prompt.md). Đường bàn vẽ bằng code trong
`godot/main.gd`.
Quân cờ là model đĩa đá trắng ngà dựng bằng Blender, thân dày và mép thẳng không bo tròn.
Bán kính giảm nhẹ để các quân đứng cạnh nhau thoáng hơn. Chữ Hán và vòng viền được khoét
lõm vào mặt quân; màu Đỏ/Đen nằm ở đáy rãnh, còn thành rãnh giữ màu ngà.
Màu trắng ngà nằm ngay trong vật liệu, giữ nguyên khi di chuyển, vỡ quân, chiếu tướng và trên
bảng kết quả. Cặp atlas `pieces.webp`/`pieces.normal.webp` cùng `pieces.json` chứa 14 quân
Đỏ/Đen; normal map raw, lossless và đục được giữ cùng atlas. Chữ trên sông kết xuất bằng
Blender. `assets/` còn có hai nút kết xuất sẵn (xin hoà mặt giấy ngà, đầu hàng sơn đỏ sẫm, khung
gỗ óc chó); bàn Godot dùng nút chung của bộ giao diện.

Tái tạo quân, bóng và nút bằng `npm run blender -- xiangqi`; chỉ bake atlas bằng
`npm run blender -- xiangqi pieces`, hoặc hai nút bằng
`npm run blender -- xiangqi button-draw button-resign`.
Cần phông Noto Sans CJK Bold (SIL Open Font License),
mặc định ở `/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc`; có thể chọn phông CJK khác
bằng `XOMDAO_XIANGQI_FONT`. Script nằm ở `sources/render_pieces.py` và `sources/render_buttons.py`, PNG trung gian ở
`.blender/xiangqi/`; xem [hướng dẫn Blender](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map).
Tiếng di chuyển, vỡ quân và nhạc thắng tổng hợp bằng code.
Thông báo chiếu tướng/chiếu bí: một cuộn giấy có quân đang chiếu mở ra trên bàn rồi cuộn lại,
vẽ bằng code (`_cut_in` trong `godot/main.gd`).
Âm thanh chép từ `assets/` vào `godot/sounds/`.

## Bố cục bàn chơi

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn gỗ óc chó ở giữa, cao gần trọn
khung, trên nền hồ sen.

- **Cột trái:** hai người chơi, mình ở dưới, đối thủ dưới nút ☰ của hub. Ô người chơi có ảnh đại
  diện, huy hiệu tướng của bên mình ở góc trên phải và số ván thắng. Người chưa tới lượt mờ đi.
  Cạnh mỗi ô là khay các quân người đó đã ăn; quân vào khay khi quân ăn nó vừa đặt xuống.
- **Cột phải:** tấm biển lượt ở trên (lượt ai, nước thứ mấy, "Chiếu tướng!" hoặc cách ván kết
  thúc), dưới nó là nút ✦ bật tắt hiệu ứng. Dưới cùng là Xin hoà, còn Đầu hàng đứng tách lên trên.

Bên Đen thấy bàn xoay ngược.

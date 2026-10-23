# Cờ Đam

Cờ Đam cho hai người, chơi với bạn bè hoặc máy ở ba mức, dùng bàn **8 × 8 với luật đơn giản hóa**:
không bắt buộc ăn quân, Vua đi nhiều ô trên cùng một đường chéo cả tiến lẫn lùi.
Game ở trạng thái `ready`. Xem [luật chơi](RULES.md).

## Chơi

Bảng Tạo phòng có **Đối thủ**, **Máy chơi** và **Lượt đi**. Đen đi trước, mỗi bên 12 quân;
người đi sau thấy bàn xoay ngược.

Bàn đặt trên mặt nước một bến cá làng chài lúc chạng vạng (cầu gỗ, đèn lồng, thuyền thúng, bãi
cát), mép tối dần và bàn có bóng đổ. Quân có bóng mềm dưới chân.

Quân đi được có vòng vàng nhấp nháy. Chọn quân (quân nhấc lên) rồi chọn ô có chấm xanh; với nước ăn
nhiều quân, chọn lần lượt từng ô đáp, quân sắp bị ăn có vòng đỏ. Chạm quân không đi được hoặc ô
không tới được thì quân rung và có tiếng báo. Nước vừa đi tô vàng kèm đường nối các ô.

Quân nhảy từng bước (nhảy cao hơn khi ăn), quân bị ăn bật ra và bay vào khay của người ăn cạnh ô
người chơi. Ăn từ hai quân trong một nước hiện mảnh giấy "Ăn N quân!". Phong Vua: quân lật mặt có
vương miện, vòng sáng, tia lấp lánh và cuộn giấy **PHONG VUA!** mở ra trên bàn. Hết ván (thắng, thua, hoà, đầu hàng hay đối thủ rời bàn), sau khi nước cuối hạ xuống, mặt nước tối
lại và một tấm sơn mài có đèn lồng đung đưa rơi xuống giữa bàn: **Thắng rồi!** (đèn lồng bay lên,
tia lửa quanh tấm), **Thua rồi**, **Hoà**, hoặc tên người thắng với người xem, kèm lý do kết thúc và
âm thanh thắng/thua/hoà. Quân bên thắng nhảy lượn sóng, quân bên thua xám đi. Khoảng 2,5 giây,
chạm để bỏ qua; hub chờ xong (`wait_for_result_panel()`) mới hiện bảng kết quả. Vào phòng khi ván
đã xong thì không có màn này. Bảng kết quả mang màu bến cá, tiêu đề "Thu lưới" và hình đèn lồng
(`result_theme()`).

Cột trái: ảnh đại diện, chủ phòng, chip số ván thắng, đĩa quân của bên đó trên góc ảnh và khay quân
đã ăn (đĩa xếp chồng kèm số). Người đang chờ mờ đi, người đang đi có vòng vàng. Cột phải: bảng lượt
(lượt ai, đĩa quân bên đi, số nước, lời xin hoà hoặc lý do kết thúc) và nút **Hiệu ứng** hình lấp
lánh (mờ khi tắt); dưới cùng **Xin hoà**, **Từ chối** và **Đầu hàng** đứng tách riêng (xác nhận
lần hai trong ba giây). Tắt hiệu ứng giữ âm thanh. Kết thúc ván, bảng kết quả của hub thêm số
lượt, số quân Đen ăn và Trắng ăn (`result_detail()`); **Xem bàn** đóng bảng, **Kết quả** mở lại.

## Thành phần

| Thành phần | File |
| --- | --- |
| Đăng ký game, tuỳ chọn phòng | `src/index.ts`, `src/game/model.ts` |
| Luật đi quân, ăn tùy chọn, Vua đi xa và phong Vua | `src/game/rules.ts` |
| Máy chơi alpha-beta | `src/game/bot.ts` |
| Lượt đi, xin hoà, đầu hàng | `src/game/CheckersGame.ts` |
| Bàn chơi: bàn, quân, ô người chơi, âm thanh, `room_setup()` và `result_detail()` | `godot/main.gd`, `godot/main.tscn` (test: `godot/test/`) |
| Nền bến cá, bảng lượt, khay quân đã ăn | `godot/backdrop.gd`, `godot/turn_plaque.gd`, `godot/taken_tray.gd` |
| Hiệu ứng: nhảy, ăn quân, "Ăn N quân!", phong Vua, sóng thắng, rung | `godot/flourish.gd` |
| Màn kết thúc ván (tấm sơn mài, đèn lồng), màu bảng kết quả | `godot/end_beat.gd` |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

## Hình và âm thanh

- Bốn quân đam trắng ngà/đen gỗ có rãnh, Vua có dấu vương miện và vòng vàng, cùng canvas 384 px.
  Đảo riêng có bàn 8 × 8 và bốn quân. Kết xuất bằng Blender:
  `npm run blender -- checkers`. Thêm `island` hoặc `piece-black-king` sau id để chỉ kết xuất
  một hình. Helper vật liệu, hình học và đèn dùng chung ở `tools/blender/xomdao_bake/`; có thể
  chạy Python với bpy như [hướng dẫn](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map).
  PNG trung gian ở `.blender/checkers/`; WebP ở `assets/`, bản bàn dùng chép vào `godot/art/`.
- Bàn walnut/maple là bản sao tài nguyên Blender của Cờ Vua (`games/chess/assets/board.webp`).
  Mặt chơi chiếm 94% ảnh bàn.
- Nền bến cá chạng vạng (`harbor`) và hình đèn lồng bên chồng quân (`emblem`, dùng ở màn kết thúc
  và bảng kết quả) được tạo bằng công cụ tạo ảnh của Antigravity (`agy`), vì tài khoản Codex không có
  công cụ tạo ảnh. Prompt nằm ở `sources/prompts.json`, ảnh gốc PNG ở `sources/`; `emblem` được tạo
  trên nền xanh lá phẳng rồi tách nền bằng `python3 games/checkers/sources/key_green.py <ảnh.jpg>
  games/checkers/sources/emblem.png`. `npm run assets -- checkers` làm WebP trong `assets/`, bàn
  chép bản dùng vào `godot/art/`. Bàn làm tối nền một chút cho không khí chạng vạng. Nền vải
  `assets/cloth.webp` cũ không còn dùng trên bàn.
- Quân và đảo giữ thông số kết xuất cũ (96 mẫu, `LEGACY_RIG`) để kết xuất lại khớp hình đã có.
- Âm thanh lấy từ dự án hoặc tổng hợp bằng code, không dùng nguồn ngoài. Tái tạo bằng
  `python3 games/checkers/sources/prepare_audio.py`. Hiệu ứng mono PCM 16-bit WAV 48 kHz,
  nhạc MP3 128 kbps.

| Asset | Nguồn |
| --- | --- |
| `checkers-start`, `checkers-select` | Cờ Tướng: `xiangqi-start`, `xiangqi-piece-select` |
| `checkers-move`, `checkers-capture` | Cờ Vây: `go-place-1`, `go-capture` |
| `checkers-promote`, `checkers-draw`, `checkers-win` | Cờ Tướng: `xiangqi-decisive-move`, `xiangqi-draw`, `xiangqi-game-win` |
| `checkers-illegal`, `checkers-turn` | Cờ Tướng: `xiangqi-illegal`, `xiangqi-turn` |
| `checkers-victory`, `checkers-lose` | Ứng dụng: `assets/app/audio/game-win.wav`, `game-lose.wav` |
| `checkers-combo` | Tổng hợp bằng numpy trong `prepare_audio.py` (ba tiếng mõ gỗ đi lên và tiếng ngân) |
| `music-checkers` | Cờ Vây: `music-go` (gốc `music-xiangqi-a`) |

Tài nguyên theo [giấy phép của dự án](../../LICENSE-ASSETS.md).

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev`, rồi chơi thử
http://localhost:5033/?play=checkers. Kiểm tra bằng `npm run check`, `npm run godot:check` và
`npm run shots -- --path '/?play=checkers'`.
Test gồm nước khai cuộc, ăn tùy chọn, ăn liên tiếp, phong Vua, Vua đi và ăn xa, hoà và máy chơi;
test GUT ở `godot/test/`.

Nước đi hợp lệ lấy từ `moves` trong view của server (chỉ có khi tới lượt mình), nên luật chỉ nằm
ở TypeScript.

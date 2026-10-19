# Cờ Vua

Cờ Vua cho hai người theo [luật hiện tại](RULES.md), chơi với bạn bè hoặc máy ở ba mức.
Bàn và quân Staunton được kết xuất từ cùng góc nhìn 3/4 bằng Blender. Trong ván chơi, ảnh bàn cờ
được dùng trực tiếp trên nền tối trơn để khung hình tập trung vào bàn và quân. Cảnh tĩnh đầy đủ với
bàn và quân cờ được dựng riêng trong Blender để xem phối cảnh. Tranh đảo cũng được tạo bằng imagegen.

## Chơi

Bảng Tạo phòng có **Đối thủ** (bạn bè hoặc máy), **Máy chơi** (Dễ, Vừa, Khó) và **Bạn cầm quân**
(Trắng đi trước, hoặc Đen). Người cầm Đen thấy bàn xoay ngược, quân mình ở dưới.

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn gỗ được phóng gần hơn nhưng vẫn thấy
đủ mép. Cột bên trái có hai thẻ người chơi bằng sơn mài và đồng; mỗi thẻ dùng ảnh đại diện, khung
đang đeo và dấu chủ phòng từ SDK. Thẻ tới lượt được phóng nhẹ, thẻ đang chờ giảm độ mờ; số trận
thắng và các quân đã ăn nằm ngay dưới tên. Bảng số nước là chữ thuần giữa hai thẻ. Góc phải trên có
nút icon **Hiệu ứng** và **Đầu hàng**; trạng thái chỉ hiện khi có chiếu, lời mời hoà hoặc kết quả.
Các nút xin/từ chối hoà dùng artwork hoàng gia và thao tác, âm thanh của `XomDaoButton`.

Chạm quân của mình để chọn, rồi chạm ô có chấm để đi; vòng tròn đánh dấu quân ăn được. Ô nước
vừa đi tô vàng, Vua bị chiếu tô đỏ. Bóng tiếp xúc mềm dưới mỗi quân làm rõ chân quân trên mặt bàn;
bóng đi theo quân khi di chuyển và mờ đi khi quân bị bắt. Quân trượt tới ô mới (Xe cũng trượt khi
nhập thành); quân bị bắt ngã tại chỗ, phát tia đồng rồi bay về ghế bên ăn. Khi chiếu tướng hoặc
chiếu hết, huy hiệu vương miện và khiên đỏ thẫm hiện cùng quân đang chiếu. Khi Tốt tới hàng cuối,
quân lóe sáng, có hạt vàng khi đổi thành Hậu, Xe, Tượng hoặc Mã. **Hiệu ứng: Tắt** bỏ chuyển động
và hạt nhưng giữ âm thanh.

Kết thúc ván, bảng kết quả của hub nằm bên phải để vẫn thấy bàn cờ; bảng nêu lý do kết thúc, số
nước và số quân mỗi bên ăn (`result_detail()`). **Xem bàn** đóng bảng, **Kết quả** mở lại.

## Thành phần

| Thành phần | File |
| --- | --- |
| Đăng ký game và tuỳ chọn phòng | `src/index.ts`, `src/game/model.ts` |
| Luật, nhập thành, bắt tốt qua đường, phong cấp | `src/game/rules.ts` |
| Máy chơi alpha-beta | `src/game/bot.ts` |
| Lượt, xin hoà, đầu hàng | `src/game/ChessGame.ts` |
| Bàn chơi: bàn, quân, phối cảnh, âm thanh, phong cấp, HUD, cut-in, hiệu ứng, `room_setup()` và `result_detail()` | `godot/main.gd`, `godot/projection.gd`, `godot/chess_piece_atlas.gd`, `godot/chess_effects.gd`, `godot/royal_cutin.gd`, `godot/royal_crest.gd`, `godot/main.tscn` (test: `godot/test/`) |
| Cảnh tĩnh phòng và bàn cờ | `sources/render_scene.py`, `godot/preview.tscn` |
| Mô hình Staunton dùng chung, atlas 64 góc mỗi quân | `sources/chess_models.py`, `sources/render_position_atlas.py` |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

`assets/` là tài nguyên cỡ đầy đủ (bàn chép bản cần dùng vào `godot/`); `sources/` giữ prompt gốc
và script tái tạo.

## Hình và âm thanh

- Bàn cờ 8 × 8 được đặt trên chính mô hình bàn gỗ óc chó của scene Blender, có viền khảm đồng và
  ánh sáng hổ phách/xanh lạnh. `chess_camera.py` là cấu hình camera chung; Blender xuất
  `board-table.webp`, `board-camera.json` và `godot/projection_profile.gd` từ cùng profile. Vì vậy
  lưới, quân, dấu nước đi và phép đổi tọa độ chạm trong Godot dùng đúng phối cảnh Blender. Bàn
  chiếm phần lớn khung; góc máy sát hơn nhưng vẫn thấy trọn mép bàn gỗ, nền tối của ảnh khớp màu
  nền Godot.
- Mỗi quân Trắng/Đen có 8 khung 256 px, một khung cho từng hàng phối cảnh, trong
  `assets/pieces-white-view.webp` và `pieces-black-view.webp`. Mọi khung giữ nguyên hướng camera;
  các cột cùng hàng dùng chung khung vì camera Blender nhìn dọc trục giữa bàn. Godot chọn khung theo
  hàng hiển thị, kể cả khi bàn xoay cho bên Đen. Chạy `npm run blender -- chess position-atlas` để dựng toàn bộ;
  `npm run blender -- chess position-white-king` dựng riêng atlas Vua Trắng. PNG trung gian nằm
  trong `.blender/chess/position-atlas/`.
- Vùng chạm quân được chiếu từ khối bao 3D của từng mô hình, nên phần thân và đỉnh quân nhô khỏi ô
  vẫn chọn đúng quân; khoảng trống còn lại trên bàn tiếp tục được đổi ngược về ô cờ qua camera.
- Atlas tĩnh 12 mẫu tại `assets/pieces.webp`/`pieces.normal.webp` dùng cho công cụ và bản xem nhanh.
  `npm run blender -- chess pieces` dựng lại atlas này bằng cùng mô hình mới.
- Nước đi phát tiếng quân trượt/chạm bàn; nước ăn phát thêm tiếng va chạm đúng lúc quân chạm nhau.
  Nhập thành, phong cấp, chiếu tướng và chiếu hết có tiếng hiệu riêng; chọn quân, bắt đầu ván,
  hoà và thắng cũng có tiếng phản hồi. Quân bị bắt nghiêng đổ quanh chân rồi bay về ghế. Va chạm
  và phong cấp phát hạt sáng đồng/vàng bằng `CPUParticles2D`; phong cấp phóng nhẹ quân trước khi
  đổi hình. **Hiệu ứng: Tắt** bỏ chuyển động và hạt nhưng vẫn giữ âm thanh. Cut-in chiếu tướng là
  giao diện vẽ trong Godot, có khiên, vương miện và hoa Tudor; lớp tối và banner đều không chặn
  chạm bàn cờ. Có thể dùng Python 3.13 với `bpy==5.1.2` qua `XOMDAO_BLENDER_PYTHON`; xem
  [hướng dẫn Blender](../../docs/making-a-game.md#kết-xuất-blender-và-normal-map).
- Mặt bàn gỗ và bàn cờ trong trận là một ảnh Blender `board-table.webp`, không có phòng phía sau;
  nó dùng cùng camera với atlas quân. Chạy `npm run blender -- chess board-table` để dựng ảnh,
  profile camera và scene chỉnh sửa được. Cảnh phòng đầy đủ trong `chess-scene.webp` vẫn chỉ phục vụ
  scene preview. Ảnh gốc và prompt phòng nằm trong `sources/` và `sources/prompts.json`;
  `npm run assets -- chess` tạo WebP từ ảnh nguồn.
  Hai ảnh gốc phòng và `island.png` được lưu bằng Git thường theo ngoại lệ trong `.gitattributes`,
  vì kết nối hiện tại không xác thực được dịch vụ upload Git LFS. Đảo dùng bàn 8 × 8 và sáu quân để
  lưới đọc rõ. Tọa độ, chấm nước đi và màu đánh dấu được vẽ bằng code.
- Cảnh tĩnh 16:9 gồm phòng, bàn lớn, bàn cờ 8 × 8 và 32 quân ở thế khai cuộc được dựng bằng
  `sources/render_scene.py`. Chạy `npm run blender -- chess scene`; file Blender và ảnh PNG nằm trong
  `.blender/chess/`, còn WebP dùng trong game nằm ở `assets/chess-scene.webp` và `godot/art/`.
  Mở ảnh trong scene preview bằng `npm run godot:preview -- open 0 res://content/chess/preview.tscn`.
- Đảo Cờ Vua: imagegen, prompt trong `sources/prompts.json`. Sinh lại bằng
  `npm run gen:asset -- chess/island`.
- `royal-panel.svg` và các trạng thái `royal-button*.svg` là viền 9-slice riêng cho thẻ người chơi,
  trạng thái và nút hành động. Bàn vẫn dùng font và tương tác nút của SDK; các SVG có bản gốc trong
  `assets/` và bản dùng trong game trong `godot/art/`.
- Âm thanh dùng lại của dự án theo bảng dưới; không dùng nguồn
  ngoài. Tái tạo bằng `python3 games/chess/sources/prepare_audio.py` (cần ffmpeg).
  Hiệu ứng mono PCM 16-bit WAV 48 kHz; nhạc MP3 128 kbps.

| Asset Cờ Vua | Nguồn trong game khác |
| --- | --- |
| `chess-start`, `chess-select` | Cờ Tướng: `xiangqi-start`, `xiangqi-piece-select` |
| `chess-move`, `chess-capture`, `chess-castle` | Cờ Vây: `go-place-1`, `go-capture`, `go-place-3` |
| `chess-promote`, `chess-check`, `chess-mate` | Cờ Tướng: `xiangqi-decisive-move`, `xiangqi-check`, `xiangqi-checkmate` |
| `chess-draw`, `chess-win` | Cờ Tướng: `xiangqi-draw`, `xiangqi-game-win` |
| `music-chess` | Cờ Vây: `music-go` (gốc `music-xiangqi-a`) |

Tài nguyên theo [giấy phép của dự án](../../LICENSE-ASSETS.md).

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` từ gốc repo, chơi thử
http://localhost:5033/?play=chess. Kiểm tra bằng `npm run check`, `npm run godot:check` và
`npm run shots -- --path '/?play=chess'`.
Test logic có perft khai cuộc, Kiwipete, tàn cuộc và phong cấp; chiếu hết, hết nước, lặp thế,
50 nước, xin hoà và máy chơi; test GUT ở `godot/test/`.

Quân được bake cùng góc nhìn với bàn. Nước đi hợp lệ lấy từ `moves` trong view của server (chỉ có
khi tới lượt mình), nên luật chỉ nằm ở TypeScript.

# Cờ tỷ phú Classic

Hai đến bốn người mua đất, thu tiền thuê và quản lý tài sản trên bàn 40 ô có địa danh Việt Nam.

[Luật chơi, giá đất, xây dựng, tiền thuê và thẻ](RULES.md)

[Hướng làm lại hình ảnh và các checkpoint trong Godot](VISUAL-PLAN.md)

## Tìm thành phần để sửa

```text
src/
  index.ts                     Đăng ký luật phía server
  game/                        Luật thuần, dữ liệu bàn, thẻ, máy và đồng hồ
godot/
  main.tscn, main.gd           Bàn chơi: bố cục, hoạt ảnh, nút và gửi thao tác
  marks.gd, trade.gd, texts.gd Dấu, tên và giá trên bàn, bảng trao đổi, chữ trên thẻ
  mortgage.gd, actions.gd      Bảng thế chấp nhiều ô; nút của lượt và của từng ô đất
  dice.gd, gate.gd, victory.gd Gieo xúc xắc, cửa tù, màn chiến thắng
  rules.gd                     Dữ liệu ô, giá và quy tắc hiển thị
  board_geometry.gd            Toạ độ sinh từ cùng lần Blender kết xuất bàn
  visual_review.tscn, .gd       Bàn mẫu offline để xem hình bằng F6
  art/, sounds/, music/        Hình, âm thanh và nhạc bàn dùng
assets/                        Ảnh và âm thanh cỡ đầy đủ
sources/                       Script kết xuất và nguồn ảnh
```

| Muốn sửa | File |
| --- | --- |
| Tiền khởi điểm, địa danh, giá mua/xây/thuê, nhóm màu | `src/game/model.ts` |
| Mua/xây/thế chấp/trao đổi | `src/game/CoTyPhuClassicGame.ts` |
| Thuế, di chuyển, tiền thuê và hiệu lực thẻ | `src/game/rules.ts` |
| Nội dung thẻ | `src/game/cards.ts` |
| Bố cục, hoạt ảnh, nút và gửi thao tác | `godot/main.gd` |
| Nút nào hiện trong lượt và trên thẻ ô đất | `godot/actions.gd` |
| Dải màu chủ đất, nhà/khách sạn, đất thế chấp, góp bến xe, ô đang chọn, tên và giá in trên ô | `godot/marks.gd` |
| Bảng đề nghị trao đổi | `godot/trade.gd` |
| Bảng thế chấp nhiều ô | `godot/mortgage.gd` |
| Đường bay của xúc xắc, cửa tù, màn chiến thắng | `godot/dice.gd`, `godot/gate.gd`, `godot/victory.gd` |
| Chữ trên thẻ ô, đề nghị trao đổi và dòng trạng thái | `godot/texts.gd` |
| Dữ liệu 40 ô, toạ độ ô trên ảnh bàn, tiền thuê và thế chấp | `godot/rules.gd` (luật) và `godot/board_geometry.gd` (toạ độ sinh từ Blender) |

Test đặt cạnh file được kiểm tra với đuôi `.test.ts`; test GUT ở `godot/test/`. Tọa độ bàn
được tạo bởi Blender; chỉnh script kết xuất rồi tạo lại ảnh và tọa độ cùng nhau.

## Bàn chơi

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn 2.5D lớn ở giữa, ô người chơi xếp
cột bên phải (bạn ở dưới cùng, chip là tiền mặt), bảng men sáng gọn ở đầu vùng giữa bàn hiện người đang quyết định với
quân, tên và tiền. Ô xanh giữa bàn chứa thông báo, xúc xắc và các nút của lượt: Gieo, Nộp 50 /
Dùng thẻ khi ở tù, Mua / Bỏ qua, Góp / Từ bỏ ở bến xe, Trả / Bỏ khi đấu giá, Xây / Hết lượt, Trả
nợ / Phá sản. Thẻ nổi trên ô giữa hiện lá Cơ hội, Khí vận, thuế (Xác nhận), đề nghị trao đổi
(Đồng ý / Từ chối) hoặc ô vừa chạm: giá, tiền thuê, chủ, và với đất của bạn Thế chấp, Chuộc, Bán
nhà, Đấu giá. Nút Trao đổi ở góc trên phải mở bảng đề nghị: chọn người, mỗi bên một ô đất (hoặc
vé ra tù, bán riêng giá 200) và tiền. Nút Tài sản cạnh đó (trong lượt của bạn hoặc khi bạn đang
nợ) mở bảng Thế chấp tài sản: các ô đất chưa thế chấp, mỗi trang năm ô với số tiền nhận được;
chọn nhiều ô rồi Xác nhận để thế chấp cùng lúc. Thế chấp trên thẻ ô cũng mở bảng này với ô đó đã
chọn. Chuộc vẫn làm từng ô.

Mỗi ô in tên (đất đã bán in tên bằng màu chủ) và, với ô đất, giá. Xúc xắc bay theo một trong bốn
đường, xoay và đổi mặt rồi dừng ở mặt server gieo, ô xanh hiện tổng (3 + 4 = 7). Quân đi từng ô,
bay khi ra sân bay hay vào tù, tiền nổi lên trên ô người chơi. Khi bạn vào tù, hai cánh cửa thép
đóng sập trên bàn; khi bạn ra tù, cửa mở. Khi có người thắng, bàn tối lại, quân người thắng lớn
lên và nhảy, pháo hoa nổ và tổng tài sản đếm lên, rồi mờ đi để xem bàn; bảng kết quả ghi Số vòng
và Tổng tài sản của người thắng.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo, chơi thử ở
`http://localhost:5033/?play=co-ty-phu-classic` (ba máy, trên server thật). Kiểm tra bằng
`npm run check` và `npm run godot:check`.

Hướng dẫn SDK và Dev Console: [tạo game](../../docs/making-a-game.md).

Lệnh riêng của game trong `src/game/dev.ts`: `dice`, `tp`, `cash`, `card`; danh mục `square` và
`card` dùng trong tham số `@square:…`, `@card:…`.

## Tài nguyên

`assets/` chứa ảnh và âm thanh cỡ đầy đủ; `sources/` chứa prompt và script nguồn.
`sources/render_board_25d.py` dựng khay sơn mài xanh đậm, các ô men riêng, dải màu bộ đất ở
mép ngoài và bảng lượt men sáng. Bản kết xuất `assets/board-25d.webp` dùng cùng camera với
các dấu sở hữu và công trình. Tọa độ được xuất thẳng thành `godot/board_geometry.gd` cùng
`assets/board-geometry.json`; `rules.gd` dùng các hằng sinh này, không chép tọa độ bằng tay.

`sources/render_deed_layers.py` tạo atlas `deed-layers.webp`/`.json` gồm 630 frame:
dải men sở hữu, 1–4 nhà và khách sạn kết xuất đủ bốn màu chủ, cùng mask biểu tượng từng ô.
Dải sở hữu được tách theo mặt men chiếu qua camera trước khi thêm bóng, tránh lấy dính
badge ô bên cạnh trong vùng cắt dành cho mái nhà.
Cả thân và mái công trình mang màu chủ. Biểu tượng tài sản tách khỏi ảnh bàn và đổi màu cùng
badge khi mua/đổi chủ. `tile_ink.gd` in tên, biểu tượng lớn và giá thành ba hàng theo
trục phối cảnh của mặt ô, luôn giữ hướng đọc hiện tại; ô xa có chữ nhỏ hơn. Lớp chữ/biểu tượng
được render riêng ở 2× rồi lọc xuống kích thước bàn. Font có cache mipmap riêng, SVG bật mipmap
để giữ cạnh mượt khi thu nhỏ; thiết lập font dùng chung và độ phân giải HUD không đổi. Biểu tượng dùng
SVG trong `godot/art/tile-*.svg` thay cho mask nhỏ trong atlas; đất chưa có chủ dùng xanh lá,
bến dùng xanh ngọc, điện dùng vàng và nước dùng xanh biển. `tile_symbol.gdshader` tạo dòng
sáng chuyển động trong giọt nước và hai nhịp chớp nhẹ cho tia điện, rồi nghỉ giữa các chu kỳ.
JSON chứa cả vùng atlas và vị trí trên ảnh bàn. Godot chọn frame theo trạng thái; thế chấp
làm tối mặt ô và thêm dấu khóa, vẫn giữ màu chủ và công trình. Thu hồi đất xóa badge/công trình
và trả biểu tượng về màu trung tính. Màu bộ monopoly ở mép ngoài luôn giữ nguyên, độc lập với
badge sở hữu ở mép trong. `deed_sets.gd` vẽ viền nhẹ khi một người giữ hai ô và viền rõ hơn khi
đủ bộ; chỉ gộp các ô liền nhau, không nối qua ô khác bộ.
Các bộ giữ màu than chì, cyan, tím lan, tím violet, magenta, bạc, tím mận và xanh dầu.

Khi thay camera, kích thước ô hoặc ánh sáng, kết xuất lại cả bàn và atlas, chép file cần dùng:

```sh
blender -b -t 4 --python games/co-ty-phu-classic/sources/render_board_25d.py
blender -b -t 4 --python games/co-ty-phu-classic/sources/render_deed_layers.py
cp games/co-ty-phu-classic/assets/board-25d.webp games/co-ty-phu-classic/godot/art/board.webp
cp games/co-ty-phu-classic/assets/deed-layers.* games/co-ty-phu-classic/godot/art/
.tools/gdtoolkit/bin/gdformat games/co-ty-phu-classic/godot/board_geometry.gd
npx biome format --write games/co-ty-phu-classic/assets/board-geometry.json games/co-ty-phu-classic/assets/deed-layers.json games/co-ty-phu-classic/godot/art/deed-layers.json
```

Xem checkpoint không cần server: mở `godot/visual_review.tscn` trong Godot và bấm F6,
hoặc chạy từ gốc repo:

```sh
npm run godot -- res://content/co-ty-phu-classic/visual_review.tscn
```

Nút ở trên phải đổi giữa bàn trống, màu chủ sở hữu, đổi chủ, thế chấp, hai ô/đủ bộ và thu hồi.
Cảnh Đổi chủ chuyển bộ Phú Quốc–Lào Cai–Việt Trì từ đỏ sang xanh dương, Bến Bắc sang xanh lá
và Điện lực sang đỏ; badge, biểu tượng và công trình đổi màu, còn dải bộ giữ nguyên.
Có thể chạm ô để xem thẻ.
Đây là bàn xem với tư cách khán giả; chơi thật qua sandbox như phần Phát triển.
Bản này tập trung bàn tĩnh và công trình; idle image-to-video và VFX mới ở checkpoint sau.

`sources/render_pawns.py`, `render_plane.py` và `render_hud_icons.py` kết xuất các đối tượng.
Thêm `-- --front` khi chạy `render_pawns.py` bằng Blender để kết xuất bốn pawn chính diện,
nền trong suốt, dùng riêng cho màn nhảy chiến thắng (`pawn-front-*.webp`).
Xúc xắc dùng sáu mặt trong `godot/art/dice-*.webp` và tiếng lăn `tycoon-dice.wav`.
`sources/make_audio.py` tạo bộ âm thanh; `sources/make_audio_preview.py` tạo
[trang nghe thử](sources/audio-preview/index.html).
Tiếng rút/lật thẻ dùng lại từ Tiến Lên; nhạc thắng dùng lại `mau-binh-standings.mp3` của Mậu Binh.
Tiếng nhận tiền, mua và vào tù dùng các nguồn Pixabay trong `sources/audio-preview/`;
tiếng máy bay cắt từ `assets/audio/sfx/pixabay-plane.mp3` ở gốc repo.
`sources/make_release_audio.py` tự tổng hợp hai tiếng chốt khóa và tiếng bánh lăn cửa thép
cho `tycoon-release.wav`.
Hai tiếng thông báo trao đổi/nhận thẻ dùng các file Freesound trong `assets/audio/sfx/`.
Nguồn bên thứ ba và giấy phép: [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).

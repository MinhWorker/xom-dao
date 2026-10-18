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
  player_card.gd, card_cash.gd  Trạng thái avatar, tiền và đồng hồ ghế cho tờ tiền trên bàn
  tile_hud.gd                  Thông tin ô dưới quân người xem, in nghiêng theo mặt bàn
  background.gd                Video nền phố ven đảo phát lặp, giữ tỷ lệ nguồn
  board_surface.gd             Hai chồng bài, rút/lật thẻ, cặp nút gắn trên mặt bàn
  turn_exchange.gd             Bảng tờ tiền theo POV và đường giao dịch phát sáng
  banknote_model.gd            Ô cố định, số liệu, trạng thái và số dư đồng bộ
  surface_draw.gd, field_ink.gd Chữ in và phép chiếu theo mặt bàn
  main.tscn, main.gd           Bàn chơi: bố cục, hoạt ảnh, nút và gửi thao tác
  marks.gd, ledger.gd, texts.gd Dấu, tên và giá trên bàn, sổ tài sản, chữ trên thẻ
  estate_page.gd, actions.gd   Thẻ tài sản và hành động của lượt/ô đất
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
| Bố cục, hoạt ảnh, mốc trình bày và gửi thao tác | `godot/main.gd` |
| Nút nào hiện trong lượt và trên thẻ ô đất | `godot/actions.gd` |
| Dải màu chủ đất, nhà/khách sạn, đất thế chấp, góp bến xe, ô đang chọn, tên và giá in trên ô | `godot/marks.gd` |
| Bảng đề nghị trao đổi | `godot/exchange_page.gd` |
| Bảng thế chấp nhiều ô | `godot/estate_page.gd` |
| Đường bay của xúc xắc, cửa tù, màn chiến thắng | `godot/dice.gd`, `godot/gate.gd`, `godot/victory.gd` |
| Chữ trên thẻ ô, số tiền nổi và hiệu ứng thưởng cạnh quân cờ | `godot/texts.gd` |
| Dữ liệu 40 ô, toạ độ ô trên ảnh bàn, tiền thuê và thế chấp | `godot/rules.gd` (luật) và `godot/board_geometry.gd` (toạ độ sinh từ Blender) |

Test đặt cạnh file được kiểm tra với đuôi `.test.ts`; test GUT ở `godot/test/`. Tọa độ bàn
được tạo bởi Blender; chỉnh script kết xuất rồi tạo lại ảnh và tọa độ cùng nhau.

Kịch bản trình duyệt duy nhất cho một game là Monopoly này:
`npm run e2e -- --only godot-co-ty-phu-classic` (cần bản debug và `npm run dev`).

## Bàn chơi

Bố cục **Bàn** ([experience.md](../../docs/experience.md)): bàn 2.5D lớn ở giữa; dải bên phải là
HUD thông tin nối tiếp mặt bàn theo cùng phép chiếu phối cảnh, hiện ô người xem vừa dừng, tên màu
theo chủ, giá mua và tiền thuê theo hàng nhãn trái / số phải; các dòng chữ thuần được căn giữa.
Khi quân người xem đang đi, HUD giữ nguyên khung và hiện hoạt ảnh một nhân vật 2D màu mực đang chạy;
nội dung ô chỉ đổi sau khi quân dừng. HUD bến xe liệt kê người góp, số lượt và tổng tiền đã góp.
Trên máy tính, nhấn Space để gieo xúc xắc khi đến lượt. Phần trên trong
bàn là bố cục tờ tiền: thẻ POV cố định
bên trái, ngân hàng ở giữa và các thẻ đối thủ xếp bên phải, nối bằng đường khắc giao dịch. Ô xanh giữa bàn chứa thông báo, xúc xắc và các nút của lượt: Nộp 50 /
Dùng thẻ khi ở tù, Mua / Bỏ qua, Góp / Từ bỏ ở bến xe, Xây / Hết lượt, Trả
nợ / Phá sản. Cơ hội và Khí vận có hai chồng bài ở hai mép trong bàn: lá trên cùng bay ra, lật hiện tên sự kiện rồi biến mất. Bước xác nhận ẩn xúc xắc và in tiêu đề/mô tả trực tiếp lên mặt bàn, không có panel nền. Thao tác thế chấp, chuộc và bán nhà được quản lý tập trung trong Sổ cái. Nút tròn hình sổ ở góc trên phải mở overlay Tài sản/Trao đổi. Chọn avatar để xem từng người,
chọn thẻ đất để quản lý, hoặc chuyển sang hai khay trao đổi để đặt thẻ và tiền. Không có đấu giá
tài sản cá nhân; mức góp bến xe bắt đầu từ 50 và tăng gấp đôi theo luật trong `RULES.md`. Ô chưa có chủ
hiện giá mua; bến xe hiện mức góp đầu. Ô đã mua hiện tiền thuê. Đất phố chỉ nhân ×3 khi đủ bộ màu;
điện và nước hiện biểu tượng xúc xắc cùng hệ số thuê. Tab người chơi trong Sổ cái có viền trang trí theo màu quân của từng
người. Khi dừng trên ô đất phố mình sở hữu, nút **Bảng giá xây** ở cuối HUD mở ngăn kéo trượt
theo cùng mặt nghiêng, cho biết chi phí xây và tiền thuê từ đất trống tới khách sạn; bậc hiện tại
được làm sáng. Ô đang thế chấp hoặc chủ đang ở tù vẫn hiện bậc giá, kèm trạng thái tạm ngừng thu.

Máy chủ vẫn gửi trạng thái luật hoàn chỉnh ngay khi xử lý xong thao tác. Bàn giữ riêng trạng thái
luật mới nhất để kiểm tra thao tác và trạng thái đang trình bày để vẽ; mỗi snapshot chỉ được trình
bày sau khi hàng đợi xúc xắc, di chuyển, sự kiện và giao dịch của nó chạy xong. Vì vậy màu chủ đất,
ô đích, đấu giá, trạng thái tù và tiền thuê đổi cùng nhịp với quân cờ.

Vị trí nghỉ của xúc xắc cố định trên mặt bàn, không phụ thuộc nút hiện bên dưới. Vùng chạm mở rộng bao gồm các mặt bên và khoảng sát quanh xúc xắc. Chữ thông báo lớn hơn, bỏ dấu chấm kết câu khi in; thông báo thường vẫn nằm dưới xúc xắc về chiều sâu. Riêng xác nhận sự kiện ẩn xúc xắc để mô tả dễ đọc. Cặp nút trên bàn có vị trí cố định, mặt mỏng và góc bo nhẹ, đổi chữ/màu theo trạng thái; không đẩy các thành phần khác khi số nút thay đổi.

Mỗi ô in tên (đất đã bán in tên bằng màu chủ) và, với ô đất, giá. Xúc xắc bay theo một trong bốn
đường, xoay và đổi mặt rồi dừng ở mặt server gieo, ô xanh hiện tổng (3 + 4 = 7). Quân đi từng ô,
bay khi ra sân bay hay vào tù; khi giao dịch bắt đầu, số tiền ròng mỗi người nhận hoặc trả nổi
cạnh quân cờ. Thưởng ở Xuất phát bắn xu và sao vàng lên quanh quân cờ. Khi vào tù, hai cánh
cửa thép đóng sập trên bàn; nếu người chơi dừng ở ô Vào tù, ánh đèn sân khấu rọi xuống quân cờ
trước khi quân bay vào tù; khi ra tù, cửa mở. Màu ô đất đổi sau khi quân vừa mua đã đến nơi. Khi có
người thắng, thao tác trên bàn bị khóa; camera tiến
vào quân thắng, quân nhảy và pháo hoa nổ. HUD của bàn ẩn đi, bảng tổng kết trượt vào bên phải trong
khung hình, ghi Số vòng và Tổng tài sản. Chọn Xem bàn để thu bảng và nhìn toàn bàn; Kết quả đưa camera
trở lại quân thắng.

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
mép ngoài. Hai bảng lượt/giao dịch được vẽ riêng bằng asset runtime, không còn gắn cứng vào ảnh bàn. Bản kết xuất `assets/board-25d.webp` dùng cùng camera với
các dấu sở hữu và công trình. Tọa độ được xuất thẳng thành `godot/board_geometry.gd` cùng
`assets/board-geometry.json`; `rules.gd` dùng các hằng sinh này, không chép tọa độ bằng tay.

`sources/render_deed_layers.py` tạo atlas `deed-layers.webp`/`.json` gồm 630 frame:
dải men sở hữu, 1–4 nhà và khách sạn kết xuất đủ bốn màu chủ, cùng mask biểu tượng từng ô.
Dải sở hữu được tách theo mặt men chiếu qua camera trước khi thêm bóng, tránh lấy dính
badge ô bên cạnh trong vùng cắt dành cho mái nhà.
Cả thân và mái công trình mang màu chủ. Biểu tượng tài sản tách khỏi ảnh bàn và đổi màu cùng
badge khi mua/đổi chủ. `tile_ink.gd` in tên, biểu tượng lớn và giá thành ba hàng theo
trục phối cảnh của mặt ô, luôn giữ hướng đọc hiện tại; ô xa có chữ nhỏ hơn. Riêng hai cạnh
trái/phải, tên nằm trên có khoảng đệm với mép ô, biểu tượng và giá cùng hàng dưới ở hai vị trí cố định, không xê dịch
theo số chữ số. Giá từ 1.000 được rút gọn bằng `k` (ví dụ `1k`, `1,25k`, `1,5k`). Lớp chữ/biểu tượng
được render riêng ở 2× rồi lọc xuống kích thước bàn. Font có cache mipmap riêng, SVG bật mipmap
để giữ cạnh mượt khi thu nhỏ; thiết lập font dùng chung và độ phân giải HUD không đổi. Biểu tượng dùng
SVG trong `godot/art/tile-*.svg` thay cho mask nhỏ trong atlas; tài sản chưa có chủ dùng cùng màu mực với chữ trên ô. Khí vận, Cơ hội và Thuế cũng dùng
biểu tượng SVG lớn; Khí vận ở hai cạnh có tên và biểu tượng cùng một hàng, mỗi phần ở vị trí cố định. `special_ink.gdshader` tạo dòng
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

Nút ở trên phải đổi giữa bàn trống, màu chủ sở hữu, đổi chủ, thế chấp, hai ô/đủ bộ, thu hồi và
góp vốn bến xe. Nút Tung thử chạy hoạt cảnh xúc xắc rồi cho quân đỏ đi theo tổng số gieo.
Cảnh Đổi chủ chuyển bộ Phú Quốc–Lào Cai–Việt Trì từ đỏ sang xanh dương, Bến Bắc sang xanh lá
và Điện lực sang đỏ; badge, biểu tượng và công trình đổi màu, còn dải bộ giữ nguyên.
Đây là bàn xem với tư cách khán giả; chơi thật qua sandbox như phần Phát triển.
Các hiệu ứng đặc biệt được mô tả ở phần bên dưới.

`sources/render_plane.py` và `render_hud_icons.py` giữ bộ kết xuất máy bay và icon cũ.
`render_pawns.py` chỉ còn chạy với `-- --front` để kết xuất bốn pawn chính diện cũ,
nền trong suốt (`pawn-front-*.webp`), lưu để tham khảo. Màn chiến thắng hiện dùng ảnh quân mới.
Xúc xắc và quân cờ dùng mô hình Blender `assets/board-pieces.glb`, chép vào `godot/art/`.
`board_stage.gd` render chúng bằng một camera 3D trùng camera kết xuất bàn, lớp nền trong suốt
và MSAA 4×. `die_mesh.gd` và `pawn_piece.gd` giữ điểm chạm/chân quân, `piece_projection.gd`
đổi tọa độ và đặt mặt xúc xắc theo kết quả máy chủ. Ảnh mặt xúc xắc cũ vẫn lưu trong `art/`.
`sources/make_audio.py` tạo bộ âm thanh; `sources/make_audio_preview.py` tạo
[trang nghe thử](sources/audio-preview/index.html).
Tiếng rút/lật thẻ dùng lại từ Tiến Lên; nhạc thắng dùng lại `mau-binh-standings.mp3` của Mậu Binh.
Tiếng nhận tiền, mua và vào tù dùng các nguồn Pixabay trong `sources/audio-preview/`;
tiếng máy bay cắt từ `assets/audio/sfx/pixabay-plane.mp3` ở gốc repo.
`sources/make_release_audio.py` tự tổng hợp hai tiếng chốt khóa và tiếng bánh lăn cửa thép
cho `tycoon-release.wav`.
Hai tiếng thông báo trao đổi/nhận thẻ dùng các file Freesound trong `assets/audio/sfx/`.
Nguồn bên thứ ba và giấy phép: [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).

### Xúc xắc và hiệu ứng trên mặt bàn

Chạm một trong hai viên xúc xắc để gieo khi đến lượt; dòng nhắc nhấp nháy nhẹ thay cho nút
Gieo. Trong lúc gửi nước đi, chạy hoạt cảnh hoặc mở bảng quản lý, xúc xắc không nhận lượt gieo mới.
Hai viên ngà dùng khối bo cạnh và các chấm lõm được dựng bằng Blender; mặt trên chứa kết quả.
Camera 3D chung với quân cờ khớp cả góc nhìn, tiêu cự và vùng cắt của ảnh bàn. Bốn đường tung được chọn ngẫu nhiên,
không lặp liên tiếp, có xoay ba chiều, bóng mềm theo độ cao và nảy khi chạm mặt bàn. Kết quả luôn
là số máy chủ trả về.

Thông báo sự kiện giữa bàn đi theo phép chiếu của mặt bàn. Các góc và ô đặc biệt dùng SVG:
sân bay có huy hiệu trời đêm và vệt bay; xuất phát có vệt mũi tên; nhà tù có ánh đèn quét, ô vào
tù có đèn đỏ/xanh; Cơ hội có sao lấp lánh, Khí vận hé nắp, Thuế có nhịp đồng xu và bến xe có
vệt chuyển động. Các nhịp được lệch nhau để chữ và màu chủ sở hữu vẫn rõ.

Góp vốn bến xe hiển thị tối đa bốn chồng xu màu người chơi trong bốn vị trí cố định ở chân ô,
chiếu đúng mặt tile. Mỗi xu biểu thị một lần góp thành công, không phải một mức tiền cố định;
người rút vốn mất chồng của mình, chốt bến thì các chồng biến mất. Trạng thái cũ chưa lưu số lần
chỉ hiển thị một xu cho khoản vốn đang có; các lượt góp mới được đếm từ đó.

Mở `godot/visual_review.tscn`, chuyển tới **Góp vốn bến xe** để xem cả bốn hướng và bấm **Tung thử**
để xem các kiểu tung mà không cần máy chủ.

### Quân cờ và xúc xắc Blender

`sources/render_board_pieces.py` dựng quân cờ nhựa lì bốn màu đỏ, xanh dương, xanh lá và vàng,
không viền kim loại; xúc xắc ngà có cạnh bo và chấm lõm thật. File GLB sẵn dùng nằm trong
`assets/` và `godot/art/`; ảnh quân cờ nhỏ trong HUD được kết xuất từ cùng mô hình. Bản Blender
chỉnh sửa và ảnh PNG xem thử nằm trong `.blender/board-pieces/`.

```sh
blender -b -t 6 --python games/co-ty-phu-classic/sources/render_board_pieces.py
```

Quân trên bàn có kích thước cố định trong không gian 3D nên nhỏ dần theo khoảng cách. Chân đặt
đúng cao độ mặt ô; bốn quân chung ô đứng thành cụm 2×2. Bóng tiếp xúc nằm trên mặt bàn, giãn và
nhạt đi khi quân nhảy hoặc xúc xắc bay. `pawn_motion.gd` tách chuyển động trên mặt bàn khỏi độ
cao, tránh kéo chân quân trượt lên phía xa để giả bước nhảy. Các mặt xúc xắc giữ nguyên hình
học trong suốt lượt tung, chỉ đổi hướng để số máy chủ nằm phía trên khi dừng.

Nền phố ven đảo về đêm dùng ảnh AI 16:9 `assets/night-waterfront.webp`.
[Ảnh đầu vào và prompt image → video idle](sources/night-waterfront-video.md): camera cố định, chỉ gợn nước, phản chiếu đèn và lá cây chuyển động nhẹ. Clip do chủ dự án cung cấp đã được chuyển thành video Theora 720p, 15 fps, không âm thanh; điểm nối vòng lặp được trộn mềm. `background.gd` phát lặp phía sau bàn và giữ tỷ lệ hình ở màn rộng.

Ảnh tĩnh nằm dưới video làm lớp dự phòng; nếu trình duyệt chặn phát tự động, video bắt đầu ở lần chạm hoặc nhấp đầu tiên.

Thẻ người chơi dùng avatar/khung và vương miện nhỏ của SDK cho chủ phòng. Viền sáng quét theo người đang tới lượt.
Khi tiền thay đổi, số có dấu `+`/`-` hiện lệch phía trên, bay nhập vào số dư; sau đó số dư đếm nhanh trong 0,48 giây.
Số dư luôn màu mực; số thay đổi và ánh nháy nhẹ dùng xanh khi nhận, đỏ khi mất. Bản xem offline có nút **Thử tiền** để xem cả hai chiều.

Bảng thông tin trong lòng bàn có bố cục như tờ tiền, chiếu theo mặt bàn. Ở giữa là dấu ngân hàng; thẻ lớn bên trái luôn là người đang xem, ba thẻ nhỏ bên phải giữ thứ tự ghế của những người còn lại. Người tới lượt có viền vàng sáng; thẻ không đổi chỗ theo lượt. Người xem ván chưa có ghế dùng ghế đầu tiên làm điểm nhìn cố định.

Thẻ lớn không ghi tên hay “Bạn”: phần đầu là chân dung có khung màu ghế và ô tiền nền tối, có biểu tượng tiền đứng trước số dư. Các thẻ đối thủ giữ tên và dùng cùng ngôn ngữ khung khắc, tiền nền tối; mọi số dư đều có biểu tượng tiền đứng trước. Chân dung có khung màu ghế, viền thẻ cắt góc, các số liệu nằm trong ô riêng và trạng thái có huy hiệu riêng. Bên dưới thẻ lớn là bốn ô số liệu bằng biểu tượng: đất, nhà, khách sạn, bến xe sở hữu, kể cả khi bằng 0. Hàng trạng thái chỉ hiện các biểu tượng đang có hiệu lực: góp vốn bến xe, ở tù kèm số lượt còn lại, sở hữu điện/nước, vé ra tù kèm số vé. Khi hết hiệu lực, biểu tượng và số đi kèm cùng ẩn; các biểu tượng khác giữ nguyên vị trí. Một khách sạn được đếm riêng, không tính thành năm nhà.

`banknote_model.gd` tổng hợp số liệu/trạng thái và giữ thứ tự POV. `turn_exchange.gd` vẽ các đường khắc nối mỗi thẻ với ngân hàng; giao dịch chỉ làm sáng đường của bên gửi và bên nhận, kể cả giữa hai thẻ bên phải. Số dư hai bên đếm cùng nhịp; ngân hàng không có số dư. Các giao dịch được phát lần lượt theo dữ liệu máy chủ, sau đó các thẻ HUD bên ngoài chạy hiệu ứng số dư tương ứng.

Bản xem offline bổ sung **Rút Khí vận**, **Rút Cơ hội**, **Thuế**, **Mua đất**, **Xây nhà**; nút **Thử tiền** luân phiên giao dịch hai chiều giữa người chơi và với ngân hàng.

Hiệu ứng rút thẻ là nét mực chiếu trên mặt bàn: viền lá bài mang biểu tượng bộ trượt từ chồng bài vào giữa, rồi lật để hiện tên thẻ. Xúc xắc hiện hết lượt tung trước khi ẩn cho phần rút thẻ; dòng trạng thái nằm phía trên vùng nút hành động.

Viền và biểu tượng lá bài trong hiệu ứng rút được chiếu từng góc theo tọa độ mặt bàn: cạnh dưới gần camera dài hơn cạnh trên, kể cả trong lúc trượt và lật.


### Di chuyển và thời gian trên thẻ

Nút Xây và Hết lượt dùng cùng khung đồng thau, đúng hướng phối cảnh của từng bên;
Hết lượt có nền xanh xám để phân biệt với hành động xây màu xanh lá.
Khi có đồng hồ chạy, đường đếm ngược đi dọc viền ngoài thẻ của người đang quyết định,
thu ngắn theo thời gian còn lại và chuyển đỏ trong một phần tư cuối. Không đặt vòng đếm quanh avatar.
Đồng hồ giữ đúng thời gian máy chủ khi các hoạt cảnh đang chạy.

Thẻ đến ô cụ thể hoặc ô gần nhất luôn cho quân đi theo chiều kim đồng hồ qua từng ô,
kể cả chặng dài hơn 12 ô. Khi chạm Xuất phát, hiệu ứng nhận 200 chạy ngay tại ô này,
rồi quân tiếp tục phần đường còn lại; khoản thưởng không chạy lần thứ hai ở ô đích.
Chuyến bay từ Sân bay dùng mô hình 3D `aircraft.glb`, dựng bằng `sources/render_aircraft.py`:
máy bay bay vào, nhấc quân dưới thân, chở đến đích, thả quân và bay ra khỏi bàn.
Camera của máy bay trùng với camera quân cờ. Chuyển vào tù vẫn dùng hoạt cảnh riêng.


### Sổ tài sản và trao đổi

`godot/ledger.gd` thay hai nút Tài sản/Trao đổi bằng một nút tròn hình sổ, mở overlay toàn cảnh.
Tab chính xếp dọc bên trái; avatar người chơi xếp ngang phía trên. `estate_page.gd` gom thẻ
đất theo bộ, hiển thị công trình, thế chấp và phần góp bến xe; chọn thẻ để quản lý hoặc chọn
nhiều thẻ thế chấp. `estate_card.gd` vẽ các vật thể từ màu bộ, icon và tiền của bộ UI chung.
`exchange_page.gd` có hai khay nhận thẻ bằng chạm hoặc kéo thả; `money_pad.gd` nhập tiền bằng
bàn phím số. `trade_draft.gd` giữ đúng một đề nghị, khóa khi đang chờ và làm trống khi kết thúc.
Chữ trên giao diện chỉ gồm tên, số và nhãn thao tác ngắn.

Máy chủ không còn event `auction` hoặc phiên bán tài sản cá nhân; các sự kiện `bid`/`pass`
và phase `auction` chỉ phục vụ luật bến xe. Không thay đổi cách góp, hoàn tiền hoặc chốt bến.

Giá đề nghị tự điền theo giá niêm yết: mua/bán một thẻ điền toàn bộ giá, đổi hai thẻ điền
phần chênh lệch vào bên cần bù tiền. Người chơi vẫn sửa được số tiền; thay lựa chọn thẻ sẽ tính
lại giá gợi ý. Vé ra tù giữ giá cố định 200. Thẻ dùng giấy chứng nhận, tab dùng dấu trang,
khay dùng mặt lót và tiền dùng chồng tiền SVG riêng; chỉ thao tác chốt dùng nút nổi bật.

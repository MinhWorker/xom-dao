# Cờ Cá Ngựa

Cờ cá ngựa một xúc xắc cho 2–4 người, có thể chơi với 1–3 máy. Xem [luật chơi](RULES.md). Plugin có trạng thái `ready`.

## Giao diện

Điện thoại nằm ngang:

![Bàn chơi trên điện thoại](../../docs/images/co-ca-ngua-phone.webp)

Máy tính, bốn người:

![Bàn chơi trên máy tính](../../docs/images/co-ca-ngua-desktop.webp)

## Mã nguồn

- `src/game/model.ts`: dữ liệu ngựa, nước đi, chặn đường, đá ngựa và chuồng 6–5–4–3.
- `src/game/CoCaNguaGame.ts`: server kiểm tra lượt, tung xúc xắc bằng `ctx.rng`, timer, người máy và thứ hạng.
- `godot/main.gd`: bàn chơi trong client Godot (bố cục **Bàn**): bàn vuông ở giữa trên sàn hiên nhà
  sàn làng chài, ô người chơi (ảnh đại diện, người chưa tới lượt mờ đi) ở góc cạnh chuồng màu của
  họ, kèm hàng bốn ngựa nhỏ sáng lên theo số ngựa đã về đích; mẹt tre đựng xúc xắc và bảng lượt nằm
  cạnh ô của người đang tới lượt; hiệu ứng và âm thanh. Bảng kết quả chờ ngựa cuối về chuồng và màn
  vinh danh chạy xong mới hiện.
- `godot/backdrop.gd`: sàn gỗ phía sau bàn, tối dần ra mép, bóng bàn đổ xuống dưới phải.
- `godot/horse.gd`: một con ngựa: bóng dưới chân, nhảy (bóng nhỏ lại khi ngựa bay lên), xoay, nhún
  khi đáp; vòng vàng nhấp nháy dưới chân khi đi được.
- `godot/dice_tray.gd`: xúc xắc trong mẹt tre: nảy nhẹ và viền mẹt sáng khi tới lượt bạn tung; khi
  tung, xúc xắc lăn quanh mẹt rồi dừng ở mặt ra. Trên máy tính, Space hoặc Enter tung xúc xắc (và
  đi luôn khi chỉ một ngựa đi được), phím 1–4 chọn ngựa.
- `godot/turn_plaque.gd`: bảng lượt ("Lượt bạn", "Máy 1 thắng!") theo màu người chơi, dòng ghi chú
  bên dưới ("Chọn ngựa", "Đá ngựa!"…), mỗi ý một dòng.
- `godot/home_tally.gd`: bốn ngựa nhỏ cạnh ô người chơi, ngựa về đích sáng lên và nảy.
- `godot/burst.gd`: hiệu ứng vẽ bằng vector: bụi khi ngựa ra chuồng hay bị đá về, vòng va chạm khi
  đá ngựa, lấp lánh vàng khi ngựa về đích hay tung ra 6.
- `godot/rules.gd`: đặt ngựa trên lưới 15 × 15 và tìm nước đi (chép từ `model.ts`).
- `godot/rules_panel.gd`: bảng `Luật` trên bàn (nút ở góc trên phải): mười trang luật chữ lớn, có
  hình mặt xúc xắc và ô chuồng 1–6; hai nút ‹ › chuyển trang.
- `godot/celebration.gd`: khi một đội về đủ bốn ngựa: pháo hoa trên bàn và bảng vinh danh vẽ bằng
  vector, ghi "CHIẾN THẮNG!" (hạng nhất) hoặc "VỀ ĐÍCH!", tên người chơi theo màu và "HẠNG n".
- `godot/art/`, `godot/sounds/`, `godot/music/`: hình, âm thanh và nhạc bàn dùng; test ở
  `godot/test/`.
- `sources/render_assets.py`: dựng bàn gỗ, atlas ngựa và normals, sáu mặt xúc xắc, nút và nền nỉ bằng [Blender helper chung](../../tools/blender/xomdao_bake/__init__.py).
- `sources/render_table.py`: dựng sàn hiên `veranda` (ván gỗ, đinh, bóng lá dừa) và mẹt tre `dice-tray` bằng cùng helper.

## Chạy và kiểm tra

```sh
npm run godot:export -- --debug
npm run dev
npm run blender -- co-ca-ngua [veranda dice-tray]
npm run check
npm run godot:check
npm run shots -- --path '/?play=co-ca-ngua'
```

Chơi thử tại `http://localhost:5033/?play=co-ca-ngua` (ba máy, trên server thật). Chạm mẹt xúc xắc
để tung; ngựa đi được có vòng vàng nhấp nháy, chạm ngựa để đi. Ngựa nhảy từng ô, nhảy cao ra khỏi
chuồng, ngựa bị đá bay xoay vòng về chuồng, đội về đủ bốn ngựa nhảy múa trong pháo hoa dưới bảng
"CHIẾN THẮNG!"/"VỀ ĐÍCH!" kèm "HẠNG n". Nút hình quyển sách ở góc trên phải mở luật có hình minh
họa. Bảng Tạo phòng chọn bạn bè hoặc số người máy, chế độ Thường hoặc Phân hạng; chế độ Phân hạng
tiếp tục sau khi có người hoàn thành.

Dev Console trong phòng server hỗ trợ `set-horse <seat> <horse> <position>` và `roll-dice <value>` để thử nước đi. Ghế và ngựa đánh số từ 0; vị trí `-1` là chuồng, `0–51` là đường đua theo màu mình, `52–57` là ô chuồng 1–6. `roll-dice` chỉ hoạt động khi đang chờ tung. Đây là lệnh phát triển qua SDK, không phải sự kiện người chơi gửi được trên production.

## Hình và âm thanh

Hình bàn, ngựa, xúc xắc, nút, nỉ, sàn hiên và mẹt tre được tạo trong Blender bằng mã nguồn của dự án; không dùng tài nguyên bên ngoài. Ngựa dùng atlas diffuse/normals cùng kích thước, normals RGB opaque và lossless, ánh sáng chung phía trên trái; bàn Godot dùng bản sao trong `godot/art/`. Bàn 1664 px đủ nét trên máy tính bảng.

Ảnh đảo giữ bộ hình hiện có trong `sources/prompts.json`. Nhạc và hiệu ứng Cờ Cá Ngựa giữ bộ âm thanh hiện có của dự án; các hiệu ứng ngắn được chỉnh tốc độ, âm lượng và fade để theo nhịp hoạt ảnh. Bàn phát `turn` khi tới lượt bạn và `token-return` khi ngựa bị đá rơi về chuồng. Nguồn lưu trữ nằm trong `assets/games/co-ca-ngua/audio/`; xem [ghi công tài nguyên](../../LICENSE-ASSETS.md).

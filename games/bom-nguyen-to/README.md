# Bom Nguyên Tố

Minigame đặt bom trên một hòn đảo nhỏ, 1–4 bạn nhỏ nguyên tố, sinh tồn hoặc đấu đội 2v2.
[Luật chơi hiện tại](RULES.md).

## Thành phần

- `src/game/model.ts`: trạng thái, nguyên tố, tuỳ chọn phòng và hằng số.
- `src/game/arena.ts`: va chạm liên tục, bom, vùng nổ, kỹ năng, vật phẩm và thu hẹp.
- `src/game/bot.ts`: BFS theo không gian/thời gian và dự đoán phản ứng dây chuyền.
- `src/game/BomNguyenToGame.ts`: mô phỏng server với timer 100 ms, chọn nhân vật, đếm ngược,
  sự kiện điều khiển, loại người chơi và kết quả đội.

Phòng chỉ chọn chế độ, số nhân vật, máy, độ khó và sát thương đồng đội; bạn nhỏ được chọn ở
đầu mỗi trận. Nhân vật, bom và vật phẩm là hình 2D vẽ tay; bản đồ và hiệu ứng nổ dựng bằng
Blender. Luật chơi và máy chạy trên server. Máy bổ sung vào đấu trường khi thiếu ghế không chiếm
ghế phòng dành cho người thật.

## Nhịp trận

1. **Chọn bạn nhỏ** (20 giây, `godot/select.gd`): ảnh lớn của bạn đang chọn trong quầng màu
   nguyên tố, tờ giấy mô tả nguyên tố, vai trò, kỹ năng (thời gian hồi, thời gian hiệu lực, tác
   dụng) và hai sân nhỏ so sánh vùng nổ của bom thường với bom khi dùng kỹ năng. Hàng trên cùng
   cho thấy lựa chọn và dấu sẵn sàng của mọi người. Bạn chọn lần trước được chọn lại sẵn.
2. **Đếm ngược** 3, 2, 1, "Bắt đầu!" với tiếng gõ; các bạn nhỏ xuất hiện trong bụi.
3. **Mở sân**: phá thùng, nhặt vật phẩm. Mỗi lần hạ gục có một dòng thông báo ở dưới sân.
4. **Còn 1 phút**, rồi **"Đá lở sắp rơi!"**: đất rung, sỏi lăn xuống, đá ong rơi lấp vòng ngoài.
   Ánh nắng ngả dần sang chiều, đèn lồng ở bốn góc sáng lên.
5. **"Hai bạn cuối!"** khi chỉ còn hai bên; 10 giây cuối đồng hồ đỏ và kêu tích tắc.
6. **Kết trận** (`wait_for_result_panel`): người thắng ăn mừng, tờ giấy báo kết quả và âm thanh
   thắng/thua, rồi bảng kết quả của hub (kèm số lần hạ gục và số thùng đã phá).

## Bàn chơi

`godot/main.gd` dựng màn chơi theo bố cục **Hành động**: đảo ở giữa trên mặt biển; thẻ bạn nhỏ
của mình (HP, bom còn đặt được, tầm nổ) ở trên trái dưới nút ☰; đồng hồ ở trên phải, thẻ những
người khác bên dưới; D-pad ở dưới trái; **Bom**, **Kỹ năng**, **Lướt** ở dưới phải (vòng tối quay
lại khi đang hồi, số giây thay cho tên; viền Kỹ năng theo màu nguyên tố). Mọi thẻ và nút dùng
nền HUD nâu trong mờ. Bàn phím: WASD hoặc phím mũi tên, Space, E, Shift. Mỗi ngón tay xử lý
riêng, nên vừa giữ hướng vừa bấm Bom được.

- `godot/arena.gd`: biển (`sea.gdshader`), ảnh nền đảo, nhân vật, bom và vật phẩm xếp lớp theo
  hàng, rung màn hình và ánh chiều. Nhân vật của mình đi trước snapshot (server đi theo vị trí
  màn hình gửi kèm `input`), nhân vật khác trượt dần tới vị trí server. Ô sắp nổ sáng theo màu
  nguyên tố rồi đỏ nhấp nháy; vòng sắp bị lấp đỏ lên và bóng đá lớn dần.
- `godot/lens.gd`: camera phối cảnh của ảnh nền: đưa một ô (kèm độ cao) lên màn hình và cho
  biết vật ở đó to cỡ nào, để nhân vật, khối, bom và hiệu ứng nằm đúng ô.
- `godot/blocks.gd`: cột đá, thùng gỗ, thúng tre và đá ong (kèm bóng trên sân), đá rơi.
- `godot/bursts.gd`: vụ nổ lan dần từ quả bom ra từng ô, tô màu theo nguyên tố
  (`tint.gdshader`), kèm tia lửa, nước bắn, tia sét, băng hoặc gió, và vết trên sân.
- `godot/effects.gd`: mảnh vỡ, tia sáng, vòng sóng, chớp sáng, tia sét, số nổi lên.
- `godot/rules.gd`: đi theo lối, vùng nổ, phản ứng dây chuyền và vòng thu hẹp (chép từ
  `model.ts`, `arena.ts`, `bot.ts`), cùng mô tả kỹ năng cho bảng chọn.
- `godot/atlas.gd`: đọc atlas `art/*.json` thành các chuỗi khung hình.
- `godot/card.gd`, `godot/pad.gd`, `godot/action.gd`: thẻ người chơi, D-pad, nút hành động.
- Hình ở `godot/art/`, âm thanh ở `godot/sounds/`; test: `godot/test/`.

## Phát triển và kiểm tra

Từ thư mục gốc repo:

```sh
npm run godot:export -- --debug
npm run dev
npm run check
npm run godot:check
```

Sandbox: `http://localhost:5033/?play=bom-nguyen-to` (một máy dễ, trên server thật). Chụp các cỡ
màn hình bằng `npm run shots -- --path '/?play=bom-nguyen-to'`.

## Hình và âm thanh

**Bản đồ** dựng bằng Blender trong `sources/render_arena.py`. Nền đảo dùng camera phối cảnh nhẹ
nhìn chéo từ phía nam (`GROUND_DISTANCE`), nên hàng gần rộng hơn hàng xa như mắt quen thấy; camera
trực giao làm sân trông như rộng ra ở phía xa. Các khối và hiệu ứng được render phẳng, bàn chơi
phóng to dần chúng theo độ gần (`godot/lens.gd` dùng đúng phép chiếu của camera đó):

- `arena-ground`: hòn đảo với sân gạch 11 × 9 ô, tường gạch mái ngói, đèn lồng ở bốn góc, hàng
  rào cây, bụi hoa, vách đất, bãi cát, bọt sóng và thuyền thúng; nền trong suốt để bàn chơi vẽ
  biển. `arena-ground.json` ghi thông số camera cho `godot/lens.gd`.
- `arena-blocks`: cột đá rêu, thùng gỗ, thúng tre và đá ong, mỗi loại hai kiểu, kèm bóng riêng.

**Hiệu ứng** dựng bằng Blender trong `sources/render_fx.py` (atlas `arena-fx3d`): mây nổ hoạt hình,
nước bắn, xoáy gió và hào quang kỹ năng là ảnh xám, bàn chơi tô màu theo nguyên tố; cụm băng,
khối băng và mảnh vỡ (ván gỗ, nan tre, đá, đá ong, lá) có màu sẵn.

```sh
npm run blender -- bom-nguyen-to                    # tất cả (vài chục phút)
npm run blender -- bom-nguyen-to ground preview     # chỉ nền, kèm ảnh ghép xem thử
npm run blender -- bom-nguyen-to blocks             # chỉ các khối
npm run blender -- bom-nguyen-to puff aura pack     # vài hiệu ứng rồi gộp lại atlas
npm run blender -- bom-nguyen-to ground quick       # thêm quick: ít mẫu, để xem nhanh
```

Ảnh trung gian nằm ở `.blender/bom-nguyen-to/` (`arena/preview.png` ghép nền với khối).

Chân dung, biểu tượng, bom, vật phẩm và khung hình nhân vật do Codex vẽ riêng cho game theo
`sources/prompts.json` (`npm run gen:asset -- bom-nguyen-to/<tên>`). Không dùng tài sản trích
xuất từ game khác.

Khung hình nhân vật được vẽ lại từ chân dung (tư thế đứng), rồi từng tư thế được sửa từ tư thế
đứng để giữ đúng thiết kế. Codex vẽ mỗi khung một cỡ, nên `sources/pack-sprites.py` cắt nền,
đưa nhân vật về cùng chiều cao (theo tỉ lệ từng tư thế trong `POSE_HEIGHT`), đặt chân trên một
đường và lật hình nghiêng phải thành nghiêng trái, rồi gộp thành atlas:

```sh
python games/bom-nguyen-to/sources/pack-sprites.py           # cả nhân vật và arena-fx
python games/bom-nguyen-to/sources/pack-sprites.py fire ice  # chỉ vài nhân vật
python games/bom-nguyen-to/sources/pack-sprites.py arena     # bom, vật phẩm
```

Hiệu ứng phụ nhỏ (sao choáng, pháo giấy chiến thắng) là hình vector trong
`sources/bake-effects.mjs`, xuất thành atlas `cartoon-fx`:

```sh
node games/bom-nguyen-to/sources/bake-effects.mjs
```

Âm thanh tổng hợp riêng bằng `python games/bom-nguyen-to/sources/synthesize.py` (đặt bom, nổ,
đếm ngược, bắt đầu, đất rung, đá rơi, gỗ vỡ, hạ gục, tích tắc, kỹ năng, lướt, nhặt đồ, trúng
đòn, thắng, thua).

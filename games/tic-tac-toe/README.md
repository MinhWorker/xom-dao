# Caro

Hai người chơi Caro trên bàn mở rộng, với bạn hoặc máy.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Luật và lượt | `src/game/CaroGame.ts` |
| Hàng thắng, hoà và bàn mở rộng | `src/game/board.ts` |
| Dữ liệu và tuỳ chọn | `src/game/model.ts` |
| Máy | `src/game/bot.ts` |
| Bàn giấy: nét mực, bàn mở rộng, hàng thắng, Đổi quân, `room_setup()` và `result_detail()` | `godot/main.tscn`, `godot/main.gd` (test: `godot/test/`) |
| Hình, âm thanh và nhạc của bàn | `godot/art/`, `godot/sounds/`, `godot/music/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
`http://localhost:5033/?play=tic-tac-toe` (chơi với máy trên server thật).
Kiểm tra bằng `npm run check` và `npm run godot:check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Bàn dùng nền giấy ngà có vân nhẹ tạo bằng Image Gen (`assets/paper.webp`, bản dùng trong
`godot/art/paper.webp`; prompt trong `sources/prompts.json`). Lưới ô liền mạch và nét mực được
vẽ bằng GDScript: `paper_cell.gd` vẽ ô giấy; `ink_mark.gd` vẽ X đỏ thành hai nét và O xanh thành
một vòng liên tục, không có bút hay bàn tay. Khi đi sát mép, bàn vẫn mở rộng, ô mới hiện dần và
cả bàn trượt cho vừa. Hàng thắng được khoanh vàng. Khi hết ván, cả bàn trượt sang trái và HUD
kết quả hiện bên phải; **Xem bàn** đưa bàn về giữa, **Kết quả** mở lại HUD. Chủ phòng dùng
**Đổi quân** để chọn quân cho ván sau. Hình ô gỗ và quân sơn mài cũ vẫn giữ trong tài nguyên
nguồn Blender (`sources/render_assets.py`).

Hình đảo tạo bằng Codex,
prompt trong `sources/prompts.json`. Âm thanh chép từ `assets/` vào `godot/sounds/`;
bản gốc ở `assets/games/tic-tac-toe/` tại gốc repo.

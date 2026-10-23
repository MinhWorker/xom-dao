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
| Bàn giấy: mark X/O men sơn, bàn mở rộng, hàng thắng, avatar và khung theo hồ sơ, picker emote trên avatar với bong bóng thoại, chọn quân ngay trên panel người chơi, `room_setup()` và `result_detail()` | `godot/main.tscn`, `godot/main.gd` (test: `godot/test/`) |
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
`godot/art/paper.webp`; prompt trong `sources/prompts.json`). Lưới ô liền mạch được vẽ bằng
GDScript; X đỏ và O xanh là mark men sơn cân đối, tạo bằng Image Gen (`assets/mark-x.webp`,
`assets/mark-o.webp`). Bong bóng emote là sprite vuông có đuôi hướng về avatar, cũng được tạo bằng
Image Gen (`assets/emote-bubble.webp`). Nước mới bật nhẹ vào vị trí. Trên điện thoại, khi ô nhỏ hơn đầu ngón tay
(bàn đã nở rộng), chạm lần đầu chỉ tô sáng ô, chạm lại đúng ô đó mới đánh. Khi đi sát mép, bàn vẫn mở rộng, ô mới hiện dần
và cả bàn trượt cho vừa. Hàng thắng được khoanh vàng. Khi hết ván, bàn và panel người chơi nằm bên
trái, HUD kết quả hiện bên phải; **Xem bàn** đưa bàn về giữa, **Kết quả** mở lại bố cục đó. Chủ phòng
chạm mark trên panel của mình để đổi quân cho ván sau.
Panel dùng avatar và khung theo hồ sơ; chạm avatar của mình để mở picker emote, sticker được chọn
nổi trong bong bóng thoại cạnh avatar người gửi.

Hình đảo tạo bằng Codex,
prompt trong `sources/prompts.json`. Âm thanh chép từ `assets/` vào `godot/sounds/`;
bản gốc ở `assets/games/tic-tac-toe/` tại gốc repo.

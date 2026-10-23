# Tiến Lên

Tiến Lên miền Nam cho 2–4 người, chơi nhiều vòng và tính điểm theo hạng.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Lá bài, bộ và chặn | `src/game/cards.ts` |
| Lượt, chia bài, đồng hồ | `src/game/TienLenGame.ts` |
| Điểm và xếp hạng | `src/game/match.ts` |
| Dữ liệu và tuỳ chọn | `src/game/model.ts` |
| Máy | `src/game/bot.ts` |
| Bàn chơi | `godot/main.gd` (bàn, ghế, hiệu ứng), `decor.gd` (chiếu Tết và bộ áo HUD), `finale.gd` (màn kết thúc), `hand.gd` (bài trên tay), `card.gd` (lá bài, dựa trên `XomDaoCard` của SDK), `rules.gd` (bộ và chặn, chép từ `cards.ts`); test: `godot/test/` |

## Bàn chơi

Một buổi chiều Tết trên chiếu cói: cành đào nghiêng vào từ góc trên phải, khẽ đung đưa; mép chiếu
tối dần để bài nổi lên. Ô người chơi là tấm gỗ sơn mài viền đồng, số lá trên chip giấy đỏ, vòng
giờ màu đồng; người đang tới lượt sáng rõ, những người khác lùi lại. **Đánh** sơn đỏ, **Bỏ lượt**
gỗ trầm. Dòng lượt nằm trên một tấm gỗ nhỏ phía trên bài của bạn. Trên máy tính: ← / → di con
trỏ vàng trên bài, Space (hoặc ↑) chọn hay bỏ lá dưới con trỏ, Enter đánh, B bỏ lượt.

Hết trận, một phong bao lì xì bật lên giữa chiếu: bạn nhất thì nắp mở và đồng vàng bung ra; không
thì phong bao bay về chỗ người nhất và cánh đào rơi nhẹ. Dải giấy viền đỏ ghi "Thắng rồi!" hoặc
"Thua rồi" cùng điểm của người nhất. Bảng kết quả "Chung cuộc" xếp đủ hạng theo điểm (bằng điểm
thì ai về nhất nhiều vòng hơn đứng trên) và ghi điểm từng người.

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
`http://localhost:5033/?play=tien-len` (ba máy, ba vòng, trên server thật).
Kiểm tra bằng `npm run check` và `npm run godot:check`. Hướng dẫn SDK và Dev Console:
[tạo game](../../docs/making-a-game.md).

## Tài nguyên

Hình tạo bằng Codex (`sources/prompts.json`); vân chiếu tạo bằng `scripts/mat-texture.mjs`.
Cành đào (`blossom`) và hình nhỏ trên bảng kết quả (`emblem`) tạo bằng Antigravity trên nền xanh
#00FF00 rồi tách nền bằng `games/checkers/sources/key_green.py`; prompt cũng ở `prompts.json`.
Tiếng thua lúc hết trận là tiếng thua chung của ứng dụng (`assets/app/audio/game-lose.wav`).
Âm thanh ở `assets/`, bản gốc ở `assets/games/tien-len/audio/`. Bàn giữ bản sao của hình và âm
thanh nó dùng trong `godot/art/` và `godot/sounds/`, vì gói của trò chỉ được đọc thư mục của nó.
Nguồn Pixabay và giấy phép ghi ở
[LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).

# Mậu Binh

Mậu Binh cho 2–4 người: xếp 13 lá thành ba chi, so bài và cộng điểm qua nhiều vòng.

[Luật chơi](RULES.md)

## Thành phần

| Thành phần | File |
| --- | --- |
| Bộ bài, so sức mạnh và binh lủng | `src/game/cards.ts` |
| Điểm và tới trắng | `src/game/scoring.ts` |
| Xếp bài tự động | `src/game/arrange.ts` |
| Chia, nộp, lật bài và đồng hồ | `src/game/MauBinhGame.ts` |
| Xếp hạng và tuỳ chọn | `src/game/match.ts`, `model.ts` |
| Bàn chơi | `godot/main.gd` (bàn, ghế, xếp bài, lật chi), `drag.gd` (kéo lá đổi chỗ), `boards.gd` (bảng Luật tính điểm, Kết quả vòng, Kết quả các vòng), `rules.gd` (bộ, binh lủng, điểm và Tự xếp, chép từ `cards.ts`, `scoring.ts`, `arrange.ts`); test: `godot/test/` |

`src/index.ts` đăng ký game phía server. `assets/` chứa hình và âm thanh cỡ đầy đủ (bàn chép bản
cần dùng vào `godot/`), `sources/` chứa nguồn và prompt.
Test nằm cạnh phần logic với đuôi `.test.ts`.

## Phát triển

Chạy `npm run godot:export -- --debug` và `npm run dev` ở gốc repo rồi mở
`http://localhost:5033/?play=mau-binh` (ba máy, ba vòng, trên server thật). Chạm hai lá, hoặc kéo
một lá thả lên lá khác, để đổi chỗ. Nút **Luật** (hình sách) ở góc trên phải mở bảng điểm của phòng, nút
**Kết quả** (bục xếp hạng) mở bài và điểm từng người qua các vòng đã xong; giữa hai vòng, bảng Kết quả vòng xếp
hạng điểm của vòng vừa xong. Lá bài và các bảng dùng `XomDaoCard`, `XomDaoBoard` của SDK.

Bàn trải khăn chàm (vải nhuộm chàm, viền hoa văn sáp ong nhạt) trên mặt gỗ, nhịp chậm cho việc
suy tính. Bàn đổi theo pha (`godot/table_layout.gd`):

- **Xếp bài**: mọi người thu gọn thành dải thẻ trên cùng (`XomDaoSeatPill`: tên, "Đang xếp" /
  "Xong", điểm; vòng ảnh chạy theo thời gian còn lại). Dưới dải là tấm ghi vòng, thanh thời gian
  bằng đồng (đỏ điều ở 10 giây cuối), số người đã xong và số giây (`godot/clock_bar.gd`). 13 lá
  của bạn chiếm gần hết bàn, tên từng chi bên trái; **Xong** đỏ điều, **Tự xếp**, **Hoàn tác**
  ở cột phải. Luật và Kết quả là hai nút tròn ở góc trên phải.
- **So bài**: bàn thu lại thành các cột, mỗi người một cột (bạn đứng đầu, viền sáng hơn); thẻ bay
  lên đầu cột, bài trượt vào cột và lật ngửa. Chi đang so nằm trong dải sáng ngang mọi cột, các chi
  khác mờ đi; dưới mỗi chi ghi tên bộ và điểm ăn/thua, cuối cột là tổng điểm của vòng.

Trên máy tính: Enter để Xong, A để Tự xếp, Z để Hoàn tác, L mở Luật, K mở Kết quả.

Hết trận, vòng đồng toả quanh người nhiều điểm nhất và một cuộn vải chàm trục đồng thả xuống giữa
bàn, mở ra "Thắng rồi!" hoặc "Thua rồi" (khi thua cuộn vải treo hơi lệch). Bảng kết quả "Mãn cuộc"
xếp đủ hạng theo điểm và ghi điểm từng người.

## Tài nguyên

Hình tạo bằng Codex, prompt trong `sources/prompts.json`. Hình chất bài và nút dùng lại từ Tiến Lên.
Khăn chàm (`indigo`) và hình nhỏ trên bảng kết quả (`emblem`) tạo bằng Antigravity, prompt cũng ở
`sources/prompts.json`. Tiếng thua lúc hết trận là tiếng thua chung của ứng dụng.
Âm thanh trong `assets/mau-binh-*` là các bản sao đổi tên từ Tiến Lên, theo cùng nguồn và
[giấy phép](../../LICENSE-ASSETS.md). Bàn giữ bản sao âm thanh trong `godot/sounds/`.

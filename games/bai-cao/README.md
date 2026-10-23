# Bài Cào

Bài Cào (ba cây) cho 2–6 người, chơi với bạn bè hoặc thêm tối đa 5 người chơi máy.
Game ở trạng thái `ready`.

Luật hiện tại: [Luật Bài Cào](RULES.md).

## Tạo phòng

Bảng Tạo phòng có **Chơi với máy** (không, hoặc 1–5 máy) và **Số ván** (5, 10, 20). Máy cược
ngẫu nhiên (thường là 10) và lật bài ngay.

## Các thứ nằm ở đâu

```
src/
  index.ts                  đầu vào phía server: meta, phần logic và tuỳ chọn phòng
  game/cards.ts             lá bài, tính nút, Ba Tây, so bài
  game/model.ts             dữ liệu: State, View (giấu bài chưa lật), tuỳ chọn phòng, thời gian
  game/BaiCaoGame.ts        các sự kiện: bet, reveal; hẹn giờ: bet-over, reveal-over, next-round
godot/
  main.tscn, main.gd        bàn: ghế, chia/nặn/lật bài, phỉnh cược, tính điểm và âm thanh
  rules.gd                  tính nút và Ba Tây (chép từ cards.ts)
  art/, sounds/, music/     hình, âm thanh và nhạc bàn dùng
  test/                     test GUT
assets/                     hình (.webp) và âm thanh (.wav/.mp3) cỡ đầy đủ
```

Mặt chiếu, lá bài, chất và nút lấy từ Tiến Lên (`mat`, `face-classic`, `back-lattice`,
`back-lotus`, `suit-*`, `button`). Đảo `island.webp` là hình riêng của Bài Cào, tạo bằng công cụ
tạo ảnh của Codex; mô tả lưu trong `sources/prompts.json`. Phỉnh `chip-5`, `chip-10`, `chip-20`
và dấu `dealer` là hình vector gốc của dự án, xuất bằng
`node games/bai-cao/sources/render_tokens.mjs`. Lá bài là `XomDaoCard` của SDK. Nền bàn gỗ đêm
(`lamplight`) và hình nhỏ trên bảng kết quả (`emblem`) tạo bằng Antigravity, prompt ở
`sources/prompts.json`; emblem vẽ trên nền xanh #00FF00 rồi tách nền bằng
`games/checkers/sources/key_green.py`.

Chạy: `npm run godot:export -- --debug` và `npm run dev`, rồi mở
`http://localhost:5033/?play=bai-cao` (ba máy, năm ván, trên server thật). Kiểm tra bằng
`npm run check` và `npm run godot:check`.

## Bàn chơi

Một chiếc bàn gỗ óc chó ban đêm, ngọn đèn dầu ở góc trên phải thở nhẹ, mép bàn chìm vào bóng tối.
Bàn đổi theo nhịp ván (`godot/table_layout.gd`):

- **Cược**: mọi người thu gọn thành dải thẻ trên cùng (`XomDaoSeatPill`; nhà cái có dấu CÁI, phỉnh
  cược của từng người nằm cạnh thẻ). Dưới dải là tấm bảng gỗ ghi ván, nhà cái, nhịp **Cược → Nặn
  bài → So bài**, cùng thanh thời gian. Giữa bàn là ba phỉnh lớn 5 / 10 / 20 (`godot/bet_tray.gd`);
  chọn một phỉnh thì nó trượt vào ô cược trước mặt bạn.
- **Nặn bài**: ba lá của bạn to giữa bàn (`godot/hand.gd`). Bài được chia úp; chạm một lá để mở,
  hoặc kéo lên (hay sang phải) để nặn: mặt lưng trượt đi và mặt bài hiện dần, thả sớm thì úp lại.
  Thao tác này không gửi sự kiện công khai. **Lật bài** (đỏ đất nung) công khai cả ba lá.
- **So bài**: nhà cái ở trên đối diện cả hàng người chơi (bạn đứng đầu hàng). Bài nhà cái lật
  trước, rồi lần lượt từng người: tên bộ, điểm được/mất và phỉnh bay giữa người đó với nhà cái.

Trên máy tính: phím 1 / 2 / 3 cược 5 / 10 / 20 (lúc nặn thì mở lá 1 / 2 / 3), Enter hoặc Space
lật bài. Điểm cược là điểm trong trò chơi; dấu cái chuyển theo vòng bàn ở ván sau.

Hết trận, ánh đèn toả quanh người nhiều điểm nhất, phỉnh của các ghế khác trượt về chồng của họ,
rồi dải giấy viền đồng ghi "Thắng rồi!" hoặc "Thua rồi" cùng số điểm. Bảng kết quả "Tàn canh" xếp
đủ hạng theo điểm (bằng điểm thì cùng hạng) và ghi điểm từng người.

## Hình và âm thanh

Có âm thanh đặt cược, chia, nặn, lật bài, thắng/thua, Ba Tây và kết thúc trận. Ba giây
cuối có tiếng nhắc nếu mình còn phải cược hoặc lật.

Âm thanh chia/nặn/kết thúc và nhạc nền sao chép từ Tiến Lên; lật/thắng/Ba Tây/nhắc giờ sao chép
từ Mậu Binh, giữ nguyên nguồn và giấy phép trong [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md).
Tiếng phỉnh và thua được tổng hợp riêng trong `sources/prepare_audio.py`. Tạo lại toàn bộ audio:
`python3 games/bai-cao/sources/prepare_audio.py`. Hiệu ứng là WAV mono PCM 16-bit 48 kHz; nhạc là
MP3 128 kbps. File nằm trong `assets/`; bàn dùng bản sao trong `godot/sounds/` và `godot/music/`.

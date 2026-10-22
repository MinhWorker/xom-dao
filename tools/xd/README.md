# xd: điều khiển client Godot bằng dòng lệnh

`xd` giống Playwright, nhưng dành cho client Godot. Nó mở một hoặc nhiều client desktop bản debug
("phiên"), mỗi phiên đăng nhập một tài khoản riêng, rồi cho bạn (hoặc agent):

- chụp màn hình;
- đọc cây node;
- chạm, vuốt, gõ chữ;
- chuyển màn;
- tạo phòng và chơi PvP;
- sửa trạng thái ván qua dev console của server.

Mỗi lệnh chỉ mất khoảng nửa giây, không cần export web hay trình duyệt.

```sh
npm run -s xd -- help
```

## Bắt đầu nhanh

```sh
npm run -s xd -- server start          # server dev riêng: bật lệnh dev, tài khoản trong bộ nhớ
npm run -s xd -- start                 # phiên "main", tài khoản xdmain, ~2,5 giây
npm run -s xd -- shot                  # .shots/xd-main.png
npm run -s xd -- tree --rects          # cây node đang hiện, kèm khung (pixel cửa sổ)
npm run -s xd -- go play tic-tac-toe   # vào sandbox của một trò
npm run -s xd -- tap Cell_4_4          # chạm chuột thật vào giữa node
npm run -s xd -- stop --all && npm run -s xd -- server stop
```

`-s` (silent) bỏ dòng `> xom-dao@…` của npm. Nếu không có `server start`, `xd` dùng server
đang chạy ở `localhost:8033` (`npm run dev`). Chọn server khác bằng `--server <url>` hoặc
`XD_SERVER`.

## Phiên và tài khoản

- `start [phiên] [--as <tài-khoản>]`: mở một client. Tài khoản mặc định trùng tên phiên.
  - `xd` tự đăng ký tài khoản `xd<tên>` nếu chưa có, và nhớ mật khẩu trong
    `.xd/accounts.json` theo từng server.
  - Thêm `--play <trò>` để vào thẳng sandbox, `--room <mã>` để vào một phòng.
  - `--size 1600x720` hoặc `--size 20:9` đặt kích thước cửa sổ.
- Chọn phiên cho mọi lệnh khác bằng `-s <phiên>`, hoặc biến `XD_SESSION`. Mặc định là `main`.
- `restart [phiên]`: mở lại sau khi sửa GDScript. Phiên đăng nhập lại và quay về ghế cũ trong
  ván đang chơi. Thêm `--import` khi có ảnh hay âm thanh mới.
- `login <tài-khoản>`: đổi phiên sang tài khoản khác.
- `ls`: các phiên và màn đang hiện. `logs [phiên] [--errors]`: log Godot của phiên.
- Có `xvfb-run` thì client chạy ẩn. Không có thì nó hiện một cửa sổ nhỏ; thêm `--visible` để
  luôn hiện cửa sổ.

## Nhìn và thao tác

| Lệnh | Việc |
| --- | --- |
| `shot [node] [--rect x,y,w,h] [--out f.png] [--pad N] [--scale K]` | PNG của cửa sổ, một node hoặc một vùng |
| `compare <phiên> <phiên>… [node] [--rect …] [--scale K]` | Cùng một ảnh từ nhiều phiên, ghép cạnh nhau có nhãn (`.shots/xd-compare.png`) |
| `tree [node] [--depth N] [--rects] [--json]` | Cây node đang hiện: tên, loại, chữ, khung |
| `find <node>` / `text <node>` | Mô tả một node / chữ của nó |
| `state [đường.dẫn]` | Màn, người chơi, snapshot của phòng, số dư |
| `tap <node>` / `tap <x> <y>` | Chạm chuột thật (di chuột, nhấn, nhả) |
| `click <node>` | Phát `pressed` của nút, không qua chuột |
| `swipe <từ> <đến> [--ms 300]` | Kéo, giữa hai node hoặc hai điểm `x,y` |
| `type <node> <chữ> [--submit]` | Điền chữ vào LineEdit hoặc TextEdit |
| `key <phím>` | Nhấn phím: `Escape`, `Enter`, `Left`… |
| `go <nơi> [tham số]` | `lobby`, `select`, `ben`, `nha`, `cho`, `dinh`, `play <trò>`, `rules` |
| `size <WxH\|16:9\|18:9\|19.5:9\|20:9>` | Đổi kích thước cửa sổ để thử các khung màn hình |
| `wait --scene/--node/--gone/--text NODE=CHỮ/--expr …` | Chờ đến khi điều kiện đúng |
| `eval <biểu thức GDScript>` | Đọc hoặc gọi bất cứ gì: `hub`, `client`, `root`, `bridge`, `find("Tên")` |

Chọn node bằng bộ chọn. Mỗi bước tìm node đầu tiên đang hiện khớp với nó:

- `Play`: theo tên. Node chưa đặt tên thì dùng tên tự sinh mà `tree` in ra, ví dụ `@Label@108`.
- `type:Label`: theo loại node hoặc `class_name` của script.
- `text:Đầu hàng`: theo chữ mà node đang hiện.
- `[n]`: lấy kết quả thứ n, đếm từ 0.
- `/`: tìm tiếp bên dưới bước trước.

Ví dụ: `Board/Cell_1_2`, `Seat_0/type:Label[1]`. Toạ độ là pixel cửa sổ, cùng hệ với ảnh `shot`.

## Chuyển động và âm thanh

```sh
npm run -s xd -- tap Square_64
npm run -s xd -- clip --ms 1500 --fps 10 tap Square_1   # quay lại nước ăn quân
npm run -s xd -- sounds                                 # âm thanh đã phát từ lần hỏi trước
npm run -s xd -- timescale 0.25                         # chạy chậm 4 lần để soi hiệu ứng
```

- `clip [--ms 1500] [--fps 10] [--scale 0.5] [--node N | --rect x,y,w,h] <lệnh>`: quay các
  khung hình từ lúc lệnh bắt đầu, ghép thành một bảng khung (`.shots/xd-<phiên>-clip.png`).
  Mỗi khung ghi thời điểm và tên âm thanh vừa phát (♪), nên đối chiếu được hình với tiếng.
  Khung được giữ trong bộ nhớ lúc quay và chỉ ghi ra đĩa khi dừng, để việc ghi file không làm
  chậm hiệu ứng.
- `record start | stop`: như `clip` nhưng tự bấm bắt đầu và dừng, để quay quanh bất cứ việc
  gì, kể cả lệnh của phiên khác hay lệnh `dev`.
- `sounds [--all] [--clear]`: mỗi lần `play()` của một AudioStreamPlayer, gồm thời điểm, tên,
  độ dài, bus và node. Ghi được cả khi phiên đang tắt tiếng hay chạy dưới xvfb không có loa.
- `timescale [K]`: đổi `Engine.time_scale`. Âm thanh vẫn giữ tốc độ thường.

## PvP và sửa trạng thái ván

```sh
X="npm run -s xd --"
$X start a && $X start b
CODE=$($X -s a room create tic-tac-toe --json | jq -r .code)
$X -s b room join $CODE && $X -s b room ready && $X -s a room start
$X -s a tap Cell_4_4
$X -s b wait --text "Status=Lượt bạn" && $X -s b tap Cell_4_5
$X -s a dev 'state get board'            # dev console của phòng
$X -s a dev 'snapshot save gan-thang'    # lưu ván; snapshot load để quay lại
$X -s a dev finish 0                     # kết thúc ván, ghế 0 thắng
$X -s b shot
```

- `room create <trò> [--options JSON]`, `quick`, `join <mã> [--watch]`, `ready [--off]`,
  `start`, `leave`, `sit`, `options <JSON>`.
- `send <sự-kiện> [JSON]`: một nước đi, theo luật thật.
- `request <sự-kiện> [JSON]`: bất kỳ request socket nào.
- `dev <dòng lệnh>`: dev console của phòng (`help` liệt kê lệnh). Gồm `state get|set`,
  `snapshot`, `undo`, `seed`, `rng push`, `timer`, `bot`, `finish`, `restart`, `as <ghế> …`.
  Cần server bật dev mode: `xd server start` và `npm run dev` đều bật sẵn.
- `coins <số>`: thêm xu (`dev:coins`).

## Cách hoạt động

- Bản debug desktop chạy với `-- --xd-port=<cổng> --xd-key=<khoá>` sẽ mở một kênh TCP trên
  `127.0.0.1` (`apps/client/core/xd_server.gd`). Mỗi dòng gửi đi là một request JSON, mỗi dòng
  trả về là một câu trả lời. Bản release và bản web không có kênh này.
- `--xd-profile=<phiên>` giữ token đăng nhập của mỗi phiên trong một file riêng
  (`core/session.gd`), nên nhiều phiên chạy song song là nhiều người chơi khác nhau. Âm thanh
  tắt, trừ khi thêm `--xd-sound`.
- `.xd/` (bị git bỏ qua) chứa file phiên, log, tài khoản và log của server dev.

Cần thử trên trình duyệt và kích thước điện thoại thật (mật độ điểm ảnh, tai thỏ, cảm ứng) thì
dùng `npm run shots` và `npm run e2e`.

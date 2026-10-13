# Client Godot

Client của Xóm Đảo: một dự án Godot 4 duy nhất, viết bằng GDScript có kiểu, xuất bản web
([ADR 0001](../../docs/adr/0001-godot-client.md)). Bản web này chính là trang chơi, ở `/`. Luật
chơi vẫn chạy trên server; client chỉ hiển thị và gửi nước đi.

## Cài đặt

```sh
npm install
npm run setup:godot    # Godot, template web, gdtoolkit và GUT vào .tools/ (Linux, macOS)
npm run godot:check    # kiểm tra: định dạng, lint, ranh giới, script, test
npm run godot -- --editor   # mở dự án trong editor
```

Phiên bản Godot được ghim trong `tools/godot/version.json`. Chỉ mở dự án bằng `npm run godot`:
Godot bản khác sẽ ghi lại `project.godot` và các scene.

## Thư mục

| Đường dẫn | Có gì |
| --- | --- |
| `project.godot` | Khung gốc 1280 × 720; bốn khung cố định 16:9, 18:9, 19.5:9, 20:9, `canvas_items` + `keep`, màn hình ngang ([ui-guide.md](../../docs/ui-guide.md)) |
| `core/` | Autoload `FramePresets` (chọn khung phù hợp khi mở và đổi kích thước), `Net` (kết nối), `Session` (token đăng nhập; đăng ký, đăng nhập, đăng xuất qua `/api/auth`), `Wallet`, `ContentLoader` (tải gói trò), `TestBridge` (cầu nối test, chỉ bản debug) |
| `hub/` | Sảnh và màn của từng khối nền tảng; `hub/main.tscn` là màn đầu tiên |
| `hub/select/` | Dãy thẻ trò (splash, logo, tên) và hàng thể loại; `art/` (splash) và `logo/` (logo trò, vật thể loại) là ảnh nhẹ của hub, xem được trước khi tải gói trò |
| `addons/xomdao_sdk/` | API duy nhất phần Godot của trò được dùng: `XomDaoFrame`, `XomDaoClient` (kết nối server) |
| `addons/xomdao_sdk/ui/` | Bộ thành phần giao diện chung: theme, nút, bảng, hàng tiền, ô người chơi, thẻ trò, ô lựa chọn, thông báo nhanh, menu ☰, lá bài và chiếu cho trò bài, font, icon, âm thanh |
| `hub/gallery/` | Màn gallery liệt kê mọi thành phần: mở bằng `?gallery=<trang>` (trang 1 tới 4) |
| `addons/xomdao_sdk/generated/` | Class protocol sinh từ schema zod bằng `npm run gen:protocol`; không sửa tay |
| `content/<id>` | Symlink tới `games/<id>/godot` (`npm run godot:link` tạo, git bỏ qua) |
| `test/` | Test GUT của lõi |

Phần Godot của một trò nằm ở `games/<id>/godot/` và chỉ được dùng file trong thư mục đó cùng
`addons/xomdao_sdk`. Script phải khai kiểu đầy đủ; thiếu kiểu là lỗi.

## Giao diện chung

Mọi màn và mọi trò dựng giao diện từ bộ thành phần trong `addons/xomdao_sdk/ui/`, làm theo
[hướng nghệ thuật](../../docs/art-direction.md): nút có màu theo loại hành động, bảng gỗ ruột giấy,
hàng tiền, ô người chơi (ảnh tròn trong vòng tre, cấp, vòng thời gian, 👑), thẻ trò, ô lựa chọn,
thông báo nhanh, chấm đỏ và nút menu ☰ với bảng menu chung (cài đặt chia hai tab Giao diện và Âm
thanh, rời phòng, luật, biểu cảm), thanh trượt âm lượng. Font Baloo 2 và Be Vietnam Pro, icon Phosphor (Fill), âm thanh
chạm, mở bảng và xu đều nằm trong đó. Chất lượng hình mới được lưu lại, chưa đổi cách vẽ.

Xem mọi thành phần ở màn gallery: `?gallery=1` tới `?gallery=4` trên bản web, hoặc
`npm run godot -- -- --gallery=2`.

## Kết nối server

`XomDaoClient` nói chuyện với server qua WebSocket thuần + JSON ở `/ws` (cùng cổng với API
HTTP): đăng nhập bằng tài khoản (hub không cho chơi như khách), tạo phòng, vào phòng bằng mã, gửi nước đi, nhận
`state_changed`. Mất kết nối thì tự nối lại và quay về phòng. Đầu file `client.gd` ghi cách dùng.

Protocol chỉ viết một lần, bằng schema zod trong `packages/shared/src/protocol.ts`. Sửa schema
xong thì chạy `npm run gen:protocol` để sinh lại GDScript; `npm run check` báo lỗi nếu quên.
`npm run godot:net` chạy server thật (không DB) rồi chạy test GUT kết nối với nó.

## Sảnh và các màn

Màn đầu tiên là sảnh: vòng đảo thể loại trên biển (Cờ, Bài, rồi thể loại phụ; đảo Sắp có khi chưa
có thể loại phụ). Vuốt ngang hoặc chạm một đảo để xoay; chạm lại đảo đang chọn hoặc thẻ trò ở dưới
phải để mở màn chọn trò. HUD: hồ sơ trên trái, số xu và ⚙ trên phải, banner (sự kiện đang mở, hoặc Chợ), hàng Nhà, Chợ,
Đình, Bến dưới trái, thẻ trò đang chọn với **CHƠI** (kèm số người của trò); Cạnh tên có chip cấp.

- **CHƠI** mở ngay một phòng của bạn cho trò đó. Phòng (`hub/room/waiting_room.gd`) có tấm giấy
  bên trái (tranh và tên trò, nút cuộn giấy mở Luật, mã phòng, "Mời bạn", tuỳ chọn của trò mà chủ
  phòng đổi được) và lưới thẻ người chơi bên phải (`seat_card.gd`). Góc dưới phải là "Bắt đầu" cho
  chủ phòng, "Sẵn sàng" cho người khác; chủ phòng bắt đầu được khi mọi người đã sẵn sàng.
- **Chọn trò**: dãy thẻ trò kéo ngang ở giữa (tranh splash phủ kín, logo và tên trò), hàng thể
  loại ở góc dưới trái. Chạm một thẻ là vào thẳng phòng của trò đó; thẻ sự kiện mở bảng sự kiện.
- Tuỳ chọn của trò (`room_setup()`) hiện trên tấm giấy của phòng (`hub/room/room_option.gd`):
  công tắc, − giá trị +, các ô, hoặc ‹ giá trị › tuỳ loại tuỳ chọn.
  Focus lưu trò và tải ngầm `.pck`. Luật là bảng phân trang có vùng hình minh họa tùy chọn,
  chặn và làm mờ/tối nền. Trò chưa có bản Godot hiện khóa. Touch có ngưỡng phân biệt vuốt với
  chạm; `hub/touch_cancel.gd` xử lý DOM touchcancel của bản web.
  Khung web đọc `env(safe-area-inset-*)` và đổi từ CSS pixel sang đơn vị khung để tránh tai thỏ,
  thanh home ở mọi mật độ màn hình.
- **Nhà**: thẻ hồ sơ (ảnh đại diện với khung đang dùng, cấp và thanh kinh nghiệm, số ván và số ván
  thắng, lưng bài) và kệ có tab Túi đồ, Thành tích, Xếp hạng. Túi đồ có món đã mua trước, rồi món
  ai cũng có; "Dùng" để đeo. Thành tích đã đạt đứng trước; Xếp hạng có một ô "Hạng N" cho mỗi
  bảng. Chạm một người trong phòng chờ là xem Nhà của họ, chỉ đọc. Nút **Tài khoản** ở Nhà của
  mình để đăng nhập, tạo tài khoản hoặc đăng xuất ([experience.md](../../docs/experience.md)).
- **Đình**: bảng xếp hạng với tab Cả xóm (theo kinh nghiệm) và từng trò (theo số ván thắng); hàng
  của bạn tô màu, nằm dưới danh sách nếu bạn ngoài top. Hết ván, thành tích vừa đạt hiện thành
  thông báo "Thành tích: …".
- **Sự kiện**: khi có sự kiện đang mở, đảo Sự kiện sáng lên và cắm cờ "Còn N ngày", banner cột
  phải đổi sang sự kiện (màu của nó, chấm đỏ). Bảng chi tiết của sự kiện mang màu sự kiện, có số
  điểm của bạn, dải mốc thưởng với **Nhận**, và **Tham gia** thay cho Chọn. Hết ván, kết quả ghi
  số điểm sự kiện vừa được và "Về sảnh" quay lại bảng sự kiện. Không có sự kiện thì đảo chìm
  trong sương và banner là Chợ.
- **Chợ**: bố cục mở rộng được hai chiều. Hàng tab loại hàng ở trên (Khung, Lưng bài; thêm loại thì
  thêm tab sang ngang), cột lọc bên trái (Tất cả, Chưa có, Đã có; thêm nhóm thì thêm ô xuống dưới),
  còn lại là lưới thẻ món hàng cuộn dọc, số cột theo bề rộng. Mỗi thẻ có tên, hình, giá và "Mua";
  món đã mua hiện "Đã có".
  Thiếu xu thì báo "Không đủ xu"; bấm hai lần chỉ trả tiền một lần.
- **Bến**: gõ mã phòng rồi "Vào", hoặc chọn một phòng đang mở của trò đang chọn.
- **Trong ván** chỉ có nút ☰ (rời phòng có hỏi lại khi đang giữa ván, luật, cài đặt, biểu cảm).
- **Kết quả**: thứ hạng, phần thưởng từng người (tăng xanh, giảm đỏ), xu bay vào số dư; "Chơi
  tiếp" và "Về sảnh".

Trò đang chọn được nhớ theo tài khoản trên máy này. Lần đầu vào trò, client tải gói `.pck` của
trò đó (`ContentLoader`) và giữ nó trong `user://` cho lần sau.

Link:

- `?room=<mã>` vào thẳng phòng đó.
- `?play=<id>` (chỉ bản debug) là sandbox: tạo phòng thật trên server với máy ở ghế trống rồi bắt
  đầu luôn. Trò chọn tuỳ chọn phòng cho sandbox bằng hàm `sandbox_options()` trong scene chính.

## Chạy trên trình duyệt

`npm run dev` phục vụ bản xuất ở `http://localhost:5033/` (`scripts/web.mjs`) và chuyển `/api`
và `/ws` tới server, nên sau `npm run godot:export -- --debug` chỉ cần mở trang đó. Xuất lại là
thấy bản mới.

Bản debug có cầu nối test `window.xomdao` cho e2e và `npm run shots`: `scene()`, `tree()`,
`text(tên)`, `rect(tên)`, `click(tên)`, `state()` (xem đầu `core/test_bridge.gd`). Node nào test
cần bấm hay đọc đều có tên, ví dụ ô Caro là `Cell_<x>_<y>`.

- `npm run e2e -- --only godot-lobby`: từ sảnh bấm CHƠI, thắng máy, số dư tăng; bạn vào bằng link.
- `npm run e2e -- --only godot-caro`: hai người chơi Caro qua mã phòng ở Bến, thêm một ván sandbox.
- `npm run e2e -- --only godot-tien-len`: ba vòng Tiến Lên với ba máy trong sandbox, chọn bài bằng
  chuột thật, tới bảng kết quả.
- `npm run shots -- --path '/?play=tic-tac-toe'`: ảnh chụp trên các cỡ điện thoại.
- `npm run shots -- --screen select` (hoặc `rules`): màn chọn trò và bảng luật trên các cỡ máy.
- `npm run e2e -- --only godot-select`: vuốt chạm native trên dãy thẻ, đổi thể loại, chạm thẻ vào phòng, luật phân trang.

Tranh splash của màn chọn được ghi prompt trong `assets/prompts.json`; `node scripts/select-art.mjs`
cắt các sheet vào `hub/select/art/`. Logo trò và vật thể loại là SVG vẽ tay trong `hub/select/logo/`.

## Xuất bản

`npm run godot:export` tạo bản web đơn luồng có PWA trong `apps/client/dist/`, và mỗi trò một gói
`dist/content/<id>.<mã băm>.pck` kèm `manifest.json`. `npm run godot:smoke` mở bản đó trong
Chromium không giao diện và chụp `.shots/godot-800x360.png`. `XOMDAO_SERVER_URL` (tên cũ
`VITE_SERVER_URL` vẫn được đọc) lúc xuất ghi địa chỉ server vào trang; không có thì client dùng chính địa chỉ
của trang.

`npm run godot:measure` đo dung lượng tải và thời gian tới lúc chơi được trên một cấu hình điện
thoại giả lập (mạng 4G, CPU chậm 4 lần), lần đầu và lần sau. Kết quả ghi trong
[ADR 0001](../../docs/adr/0001-godot-client.md).

Vercel dựng client (`tools/godot/vercel.mjs`) và phục vụ nó ở `/`: bản thật dùng bản release,
bản xem trước của PR dùng bản debug (có cầu nối test và sandbox). Link cũ `/godot/…` chuyển về
`/…`.

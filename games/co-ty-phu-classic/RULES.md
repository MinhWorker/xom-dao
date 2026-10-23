# Luật Cờ tỷ phú Classic

Có 2–4 người, gồm người thật và tối đa 3 máy. Mỗi người bắt đầu ở Xuất phát với 1.000 tiền mặt,
chưa có tài sản hoặc thẻ. Ghế đầu tiên đi trước; lượt theo thứ tự ghế và bỏ qua người phá sản.
Người cuối cùng chưa phá sản thắng. Ván không giới hạn số lượt.
Số tiền dưới đây là đơn vị quy ước trong game.

## Bàn cờ

Bàn có 40 ô, gồm 24 đất phố, 4 bến xe, 2 Cơ hội, 2 Khí vận, 2 ô thuế,
Điện lực, Cấp nước và 4 ô góc. Thứ tự theo chiều kim đồng hồ, từ ô 0:

| Đoạn | Thứ tự ô |
| --- | --- |
| 0–9 | Xuất phát → Phú Quốc → Lào Cai → Việt Trì → Thuế thu nhập → Bến Bắc → Hạ Long → Cơ hội → Hải Phòng → Hà Nội |
| 10–19 | Nhà tù → Hải Dương → Điện lực → Thái Bình → Nam Định → Bến Tây → Thanh Hóa → Khí vận → Vinh → Hà Tĩnh |
| 20–29 | Sân bay → Huế → Cơ hội → Đà Nẵng → Hội An → Bến Nam → Kon Tum → Pleiku → Cấp nước → Đà Lạt |
| 30–39 | Vào tù → Nha Trang → Vũng Tàu → Khí vận → Biên Hòa → Bến Đông → Tp. HCM → Cần Thơ → Thuế xa xỉ → Cà Mau |

## Lượt chơi và di chuyển

Gieo hai xúc xắc, đi theo chiều kim đồng hồ số bước bằng tổng hai viên, rồi xử lý ô đến.
Đi qua hoặc dừng ở Xuất phát nhận 200. Ra đôi được gieo tiếp sau khi xử lý ô;
ra đôi ba lần liên tiếp trong một lượt thì vào tù ngay, không đi theo lần gieo thứ ba.
Vào tù làm mất lần gieo thêm. Khi không còn lần gieo thêm, bấm **Hết lượt** để chuyển ghế.
Khi vừa ra đôi và đến đất phố của mình, có thể **Bỏ qua** việc xây để gieo tiếp; thao tác này
không kết thúc lượt.

Đến đất phố, Điện lực hoặc Cấp nước chưa có chủ, có thể **Mua** nếu đủ tiền hoặc bấm **Bỏ qua** ở tâm bàn.
Bỏ qua giữ đất chưa có chủ; nếu vừa ra đôi thì được gieo tiếp, ngược lại lượt sẽ kết thúc.
Có thể quản lý tài sản để lấy tiền trước khi mua; không đủ tiền vẫn được bỏ qua. Nếu hết giờ
trong lúc chọn mua, hệ thống tự bỏ qua (nếu vừa ra đôi thì được gieo tiếp).

Đến tài sản người khác chưa thế chấp thì trả tiền thuê. Chủ đang ở tù không thu tiền thuê.
Đến đất mình đã sở hữu có thể xây theo quy tắc công trình bên dưới.

## Các ô đặc biệt

| Ô | Hiệu lực |
| --- | --- |
| Xuất phát | Nhận 200 khi đi qua hoặc dừng lại |
| Cơ hội / Khí vận | Rút thẻ từ bộ tương ứng |
| Thuế thu nhập | Nộp `max(100, floor(10% × tiền mặt))` |
| Thuế xa xỉ | Nộp `max(200, floor(10% × tiền mặt))` |
| Điện lực / Cấp nước | Mua 150; khách trả cho chủ tổng xúc xắc ×4 nếu chủ có một đơn vị, ×10 nếu chủ có cả hai |
| Nhà tù | Đi tới bình thường chỉ là ghé thăm |
| Sân bay | Bay tới một trong 39 ô khác ngẫu nhiên, rồi xử lý ô đến |
| Vào tù | Chuyển thẳng tới Nhà tù, không nhận thưởng Xuất phát cho chặng chuyển này |

Thẻ thiếu điện/nước nhân đôi phí thuê ô tương ứng trong vòng bàn kế tiếp.
Điện/nước thế chấp hoặc chủ ở tù không thu phí. Đơn vị thế chấp vẫn tính khi xét sở hữu cả hai.
Thẻ tới bến xe hoặc ô điện/nước gần nhất nhân đôi tiền thuê; điện/nước dùng tổng xúc xắc đã gieo để tính phí.
Một vòng bàn bắt đầu khi lượt quay về ghế đầu tiên còn chơi; hiệu lực hết khi vòng sau bắt đầu.
Các thẻ thiếu hụt cùng loại không cộng dồn mức phí. Ô chưa có chủ hiện giá mua; bến xe có giá niêm yết 200.
Ô đã mua hiện mức tiền thuê tính được. Đất phố chỉ được nhân `×3` khi chủ sở hữu đủ
cả ba ô trong bộ; hai ô phố cùng bộ không có hệ số cộng thêm. Điện lực/Cấp nước hiển thị biểu tượng
xúc xắc cùng hệ số `×4` hoặc `×10`, nhân đôi nếu đang thiếu điện/nước. Khi thu tiền thật, dùng tổng
đã gieo và áp dụng hiệu ứng nhân đôi của thẻ tới ô điện/nước gần nhất.

Sân bay không thưởng khi bay qua Xuất phát; đáp đúng Xuất phát nhận 200.
Chuyến bay giữ quyền gieo thêm từ xúc xắc đôi, trừ khi ô đến đưa người chơi vào tù.
Thẻ chuyển tới ô cụ thể hoặc ô gần nhất đi theo chiều kim đồng hồ qua từng ô trên đường.
Thưởng Xuất phát hiện ngay khi quân chạm ô này, trước khi tiếp tục tới đích.
Ô đến từ thẻ hoặc chuyến bay vẫn xử lý mua đất, xây, thuê hoặc sự kiện như một lần đến thường.

Cơ hội, Khí vận, thuế, Sân bay và việc bị đưa vào tù có bước **Xác nhận** trước khi áp dụng.
Chỉ người đang có lượt được xác nhận. Nếu ô đến tiếp tục có sự kiện thì xác nhận sự kiện mới riêng.
Tiền thuê và thưởng Xuất phát không cần xác nhận.

## Mua bán tài sản

Đất phố, Điện lực, Cấp nước và bến xe mua trực tiếp theo giá niêm yết khi đến ô chưa có chủ.
Mỗi bến xe có giá mua 200. Chọn **Bỏ qua** thì tài sản tiếp tục chưa có chủ.
Điện/nước không xây công trình. Muốn chuyển tài sản cho người khác, hai bên dùng trao đổi;
muốn lấy tiền từ ngân hàng thì bán công trình hoặc thế chấp.

Bến xe đang sở hữu thu `50 × số bến cùng chủ`: 50, 100, 150 hoặc 200.
Bến thế chấp vẫn được tính trong số bến cùng chủ, nhưng bản thân nó không thu thuê.
Thẻ tới bến gần nhất dùng cùng mức thuê.

## Công trình và tiền thuê đất phố

Khi quay lại đất phố đã sở hữu trong lượt mình, được xây một cấp trong lần đến đó.
Không xây ngay lần mua đất và không xây từ xa. Không cần đủ bộ màu hoặc xây đều.
Đất thế chấp không được xây. Có thể xây tối đa 4 nhà, rồi nâng thành khách sạn ở cấp 5.

Trong bảng thông tin ô, **Mua**, **Xây nhà** và **Xây khách sạn** là thao tác chính,
đặt phía trên các thao tác quản lý tài sản. Nút xây luôn hiện kèm giá trên đất của bạn;
khi chưa đủ điều kiện, nút màu xám và không bấm được.

Giá mỗi cấp bằng 50% giá đất. Số nhà và khách sạn không bị giới hạn bởi lượng công trình trong ngân hàng.
Nâng lên khách sạn thay bốn nhà bằng một khách sạn. Bán từng cấp nhận 50% giá xây cấp đó,
làm tròn đến đồng gần nhất để mọi khoản tiền đều là số nguyên.

Tám bộ màu, mỗi bộ gồm ba đất phố kế tiếp trên đường đi, bỏ qua các ô khác:
(1, 2, 3), (6, 8, 9), (11, 13, 14), (16, 18, 19), (21, 23, 24), (26, 27, 29),
(31, 32, 34) và (36, 37, 39). Các ô cùng bộ không cần nằm liền nhau và có cùng màu viền.
Sở hữu đủ ba ô tạo thành bộ monopoly sẽ nhân tiền thuê **gấp 3 cho cả ba ô**,
kể cả nhà và khách sạn. Sở hữu một hoặc hai ô không làm tăng tiền thuê. Ô đang thế chấp không thu thuê; quyền sở hữu của nó
vẫn tính vào bộ.

Các ô liền nhau trong cùng bộ và cùng chủ gộp viền thành một khung chữ nhật theo mặt bàn.
Sở hữu hai ô trong bộ thì các khung có viền nhẹ; đủ ba ô thì mọi khung của bộ có viền rõ hơn,
kể cả khi các ô nằm cách nhau. Viền dùng màu bộ, không thay màu chủ sở hữu. Khung không nối qua ô khác bộ. Viền và quầng sáng nằm trong bề mặt ô, không tràn ra ngoài.
Ô pawn đang đứng không tô màu.
Mỗi tài sản đã mua có badge màu chủ sở hữu dạng dải mảnh, phủ hết chiều ngang phần mặt ô và sát mép đầu, không chừa khoảng trống hay bo góc;
badge nằm phẳng trong mép mặt ô, không che phần gờ hoặc làm tăng diện tích ô;
1–4 nhà là công trình đặt phía trong ô, khách sạn là một công trình lớn hơn.
Biểu tượng tài sản, badge sở hữu và cả thân/mái công trình mang màu chủ; đổi chủ đổi cả ba.
Ô chưa có chủ dùng biểu tượng trung tính. Dải màu bộ đất nằm ở mép ngoài và luôn giữ nguyên,
tách khỏi badge sở hữu ở mép trong.
Các ô đặc biệt có mặt men màu riêng, Khí vận màu vàng. Đất thế chấp có dấu khóa trên mặt ô.

| Ô | Địa danh | Màu | Giá đất | Xây mỗi cấp | Trống | 1 nhà | 2 nhà | 3 nhà | 4 nhà | Khách sạn |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Phú Quốc | Than chì | 200 | 100 | 20 | 80 | 220 | 600 | 800 | 1000 |
| 2 | Lào Cai | Than chì | 150 | 75 | 15 | 60 | 165 | 450 | 600 | 750 |
| 3 | Việt Trì | Than chì | 180 | 90 | 18 | 72 | 198 | 540 | 720 | 900 |
| 6 | Hạ Long | Cyan | 280 | 140 | 28 | 112 | 308 | 840 | 1120 | 1400 |
| 8 | Hải Phòng | Cyan | 320 | 160 | 32 | 128 | 352 | 960 | 1280 | 1600 |
| 9 | Hà Nội | Cyan | 350 | 175 | 35 | 140 | 385 | 1050 | 1400 | 1750 |
| 11 | Hải Dương | Tím lan | 220 | 110 | 22 | 88 | 242 | 660 | 880 | 1100 |
| 13 | Thái Bình | Tím lan | 260 | 130 | 26 | 104 | 286 | 780 | 1040 | 1300 |
| 14 | Nam Định | Tím lan | 240 | 120 | 24 | 96 | 264 | 720 | 960 | 1200 |
| 16 | Thanh Hóa | Tím violet | 270 | 135 | 27 | 108 | 297 | 810 | 1080 | 1350 |
| 18 | Vinh | Tím violet | 260 | 130 | 26 | 104 | 286 | 780 | 1040 | 1300 |
| 19 | Hà Tĩnh | Tím violet | 170 | 85 | 17 | 68 | 187 | 510 | 680 | 850 |
| 21 | Huế | Magenta | 270 | 135 | 27 | 108 | 297 | 810 | 1080 | 1350 |
| 23 | Đà Nẵng | Magenta | 300 | 150 | 30 | 120 | 330 | 900 | 1200 | 1500 |
| 24 | Hội An | Magenta | 250 | 125 | 25 | 100 | 275 | 750 | 1000 | 1250 |
| 26 | Kon Tum | Xám bạc | 140 | 70 | 14 | 56 | 154 | 420 | 560 | 700 |
| 27 | Pleiku | Xám bạc | 160 | 80 | 16 | 64 | 176 | 480 | 640 | 800 |
| 29 | Đà Lạt | Xám bạc | 270 | 135 | 27 | 108 | 297 | 810 | 1080 | 1350 |
| 31 | Nha Trang | Tím mận | 280 | 140 | 28 | 112 | 308 | 840 | 1120 | 1400 |
| 32 | Vũng Tàu | Tím mận | 260 | 130 | 26 | 104 | 286 | 780 | 1040 | 1300 |
| 34 | Biên Hòa | Tím mận | 220 | 110 | 22 | 88 | 242 | 660 | 880 | 1100 |
| 36 | Tp. HCM | Xanh dầu | 350 | 175 | 35 | 140 | 385 | 1050 | 1400 | 1750 |
| 37 | Cần Thơ | Xanh dầu | 300 | 150 | 30 | 120 | 330 | 900 | 1200 | 1500 |
| 39 | Cà Mau | Xanh dầu | 180 | 90 | 18 | 72 | 198 | 540 | 720 | 900 |

## Thế chấp và chuộc

Có thể thế chấp hoặc chuộc tài sản ở bất kỳ vị trí nào trong lượt mình, hoặc khi đang phải
trả nợ mua bến ngoài lượt. Chọn một hoặc nhiều tài sản trong bảng **Thế chấp tài sản**;
bảng mở từ nút ngân hàng, hiện khoản nhận của từng ô, tổng tiền và hạn chuộc.
Chỉ thực hiện thế chấp khi chọn **Xác nhận**; chọn **Hủy** thì giữ nguyên tài sản và tiền mặt.

Phải bán hết nhà/khách sạn trên ô đất trước khi thế chấp ô đó. Mỗi cấp công trình bán lại
cho ngân hàng với nửa giá xây, làm tròn đến đồng gần nhất; khách sạn gồm năm cấp.
Khoản vay bằng `50% × giá đất`.
Ví dụ đất giá 200 nhận khoản vay 100; chuộc trả 110. Chuộc khôi phục đất.

Hạn chuộc là cuối lượt thứ ba tiếp theo của người vay. Lượt đang thế chấp không tính vào ba lượt;
gieo thêm do ra đôi không tính thành lượt mới. Hết hạn, ngân hàng thu hồi tài sản,
tháo toàn bộ công trình, trả chúng về ngân hàng và để đất trống chưa có chủ.
Đổi chủ giữ người vay và hạn gốc; người vay phá sản hoặc rời ván thì các khoản thế chấp của họ bị thu hồi.

Không thế chấp hoặc chuộc trong lúc chờ xác nhận sự kiện hoặc trao đổi.

## Trao đổi

Người đang có lượt có thể đề nghị với một người còn chơi khác: đưa hoặc nhận tối đa một tài sản
mỗi bên và một khoản tiền mỗi bên. Tài sản phải đúng chủ và không có công trình; tiền đưa ra
phải đủ trong tiền mặt. Có thể trao đổi đất đang thế chấp, giữ khoản vay và hạn chuộc.

Người nhận đồng ý thì chuyển tài sản và tiền; từ chối hoặc bên đề nghị huỷ thì giữ nguyên.
Không trao đổi khi đang xác nhận sự kiện, trả nợ hoặc chờ một trao đổi khác.
Hết trao đổi tiếp tục quyết định trước đó.

Trong mục **Trao đổi**, chọn **Vé ra tù · 200 ₫** thay cho đất để bán một vé cho người nhận,
hoặc mua một vé của họ. Giá cố định 200, vé được giao dịch riêng, không kèm đất hoặc tiền thêm.
Người nhận phải đồng ý và bên mua đủ tiền; từ chối hoặc hết giờ không chuyển tiền/vé.
Vé giữ nguồn Cơ hội/Khí vận và trở về đúng bộ khi người mua sử dụng.

## Nhà tù

Vào tù do ô Vào tù, thẻ hoặc ba lần đôi; quân tới ô 10 và không được gieo thêm trong lượt ấy.
Đến Nhà tù bằng di chuyển thông thường không bị giam.

Trong hai lượt thử đầu, có thể trả 50 hoặc dùng thẻ ra tù trước khi gieo. Nếu không, gieo để thử ra
đôi. Ra đôi thì ra tù và đi theo tổng xúc xắc, nhưng không được gieo thêm vì lần đôi này. Nếu không
ra đôi, người chơi vẫn ở tù và kết thúc lượt.

Sau hai lần thử không ra đôi, lượt thứ ba vẫn phải gieo lần cuối nhưng không còn lựa chọn trả 50 hay
dùng thẻ. Ra đôi thì ra tù và đi theo tổng xúc xắc; nếu không ra đôi, người chơi cũng được thả và đi
theo tổng xúc xắc. Lượt đôi này không cho gieo thêm.

Người ở tù vẫn được quản lý tài sản nhưng không thu tiền thuê cho tới khi ra tù.
Khi ra tù, người chơi thấy hai cửa song sắt mở ra cùng âm thanh mở khóa.

## Nợ, phá sản và rời ván

Khoản phải trả lớn hơn tiền mặt đưa người trả vào bước **Nợ**. Bán công trình,
hoặc thế chấp tài sản để lấy tiền, rồi **Trả** đủ khoản nợ một lần.
Nếu tiền mặt chưa đủ, người trả có thể **Phá sản**. Người chơi cũng có thể chủ động phá sản
bất cứ lúc nào bằng biểu tượng ngân hàng ở góc dưới trái sổ tài sản, không cần chờ có khoản nợ
hay thiếu tiền; giao diện hỏi xác nhận trước khi thanh lý. Khi chọn rời phòng giữa ván, người chơi
còn hoạt động cũng xác nhận phá sản trước khi rời.

Khi phá sản, thu hồi các khoản thế chấp có người vay là người phá sản trước.
Công trình còn lại của họ được thanh lý theo giá bán từng cấp đã làm tròn đến đồng gần nhất;
tiền thu từ thanh lý về ngân hàng.
Nếu đang có khoản nợ với người chơi còn hoạt động, người đó nhận số tiền mặt người phá sản đang có
ngay khi chọn phá sản, tối đa bằng khoản nợ đang thu; phần tiền dư sau thanh lý về ngân hàng.
Nếu không có chủ nợ còn hoạt động, toàn bộ tiền mặt về ngân hàng.
Đất trả về ngân hàng và được xoá thế chấp cùng công trình. Vé ra tù của người phá sản bị huỷ,
không quay lại bộ bài. Số dư người phá sản bằng 0.
Người phá sản không tham gia lượt sau.

## Thẻ Cơ hội và Khí vận

Hai bộ được xáo riêng đầu ván, thứ tự bí mật. Rút từ đầu bộ;
thẻ thường trở về cuối bộ sau khi dùng. Mỗi bộ có một vé ra tù, tổng cộng tối đa hai vé trong ván.
Vé được giữ ngoài bộ tới khi sử dụng; khi dùng, nó trở về cuối bộ tương ứng.
Thẻ sửa chữa tính cả công trình đang thế chấp; khách sạn chỉ chịu mức khách sạn,
không cộng thêm phí bốn nhà.

### Cơ hội

- Tiến về Xuất phát. Nhận 200.
- Tới Bến xe gần nhất.
- Tới Điện lực hoặc Cấp nước gần nhất.
- Tới Cà Mau.
- Tới Vinh.
- Ngân hàng trả lãi 50.
- Nhận cổ tức 100.
- Nộp phạt chạy quá tốc độ 15.
- Sửa chữa: 25 mỗi nhà, 100 mỗi khách sạn.
- Vào tù ngay.
- Giữ thẻ ra tù miễn phí.
- Được thưởng 150.
- Thiếu điện: thuế Điện lực gấp đôi trong vòng bàn kế tiếp.
- Thiếu nước: thuế Cấp nước gấp đôi trong vòng bàn kế tiếp.

### Khí vận

- Tiến về Xuất phát. Nhận 200.
- Ngân hàng chia lợi nhuận 200.
- Hoàn thuế 20.
- Nhận quà 100.
- Phí khám bệnh 50.
- Phí học tập 50.
- Bán cổ phiếu, nhận 50.
- Được thừa kế 100.
- Sửa chữa: 40 mỗi nhà, 115 mỗi khách sạn.
- Vào tù ngay.
- Giữ thẻ ra tù miễn phí.
- Trúng giải thưởng 10.

## Đồng hồ quyết định

Thời gian PvP chọn 15, 30, 60 hoặc 90 giây, mặc định 30. Khi còn ít nhất hai người thật,
đồng hồ áp dụng cho quyết định của người thật; một người thật với máy không dùng đồng hồ này.
Mỗi quyết định mới có thời hạn riêng. Xây, bán nhà, thế chấp, chuộc hoặc mở bảng quản lý
không kéo dài thời hạn đang chờ. Đồng hồ vẫn chạy khi mất kết nối.

| Quyết định hết hạn | Hành động tự động |
| --- | --- |
| Gieo | Gieo, kể cả khi đang ở tù |
| Mua đất | Mua nếu đủ tiền; không đủ thì kết thúc lượt |
| Kết thúc lượt | Chuyển sang người tiếp theo |
| Trao đổi | Từ chối |
| Trả nợ | Thanh lý công trình, thế chấp để trả; không đủ thì phá sản |

Sự kiện đặc biệt của người thật tự xác nhận sau 8 giây khi thông báo đã sẵn sàng,
nếu còn ít nhất hai người chưa phá sản. Nếu giao diện chưa sẵn sàng trong 30 giây,
thời hạn 8 giây bắt đầu dự phòng. Máy tự xác nhận.
Tốc độ hiệu ứng 1×/2× không đổi các thời hạn hoặc luật.

## Chiến thắng

Người cuối cùng chưa phá sản thắng; pawn của người đó phóng lớn ở giữa bàn, nhảy ăn mừng
cùng pháo hoa, thông điệp chiến thắng và nhạc kết quả Mậu Binh. Dãy số đếm lên tổng tài sản:
tiền mặt + giá mua niêm yết của tài sản + tổng chi phí xây
+ 200 mỗi vé ra tù − tiền chuộc các tài sản thế chấp.


## Sổ tài sản

Nút tròn hình sổ mở giao diện phủ toàn cảnh. Hai tab bên trái là **Tài sản** và **Trao đổi**;
hàng avatar phía trên chọn người đang xem hoặc đối tác. Có thể xem tài sản ngoài lượt,
nhưng thao tác quản lý vẫn tuân theo luật của lượt chơi.
Biểu tượng ngân hàng ở góc dưới trái mở xác nhận phá sản.

Tài sản xếp thành các cụm thẻ theo bộ màu. Chọn thẻ để xem tiền thuê, công trình và các
hành động đang hợp lệ. Thế chấp có thể chọn nhiều thẻ rồi chốt một lần.

Trao đổi chỉ giữ một đề nghị. Mỗi bên chọn một tài sản chưa có công trình cùng tiền mặt;
vé ra tù vẫn bán riêng giá 200 theo luật bên trên. Có thể chạm hoặc kéo thẻ vào khay của bên đó;
chạm chồng tiền để nhập số. **Làm trống** xóa bản đang soạn. Khi đề nghị kết thúc do đồng ý,
từ chối, hủy, hết giờ hoặc người tham gia rời ván, cả hai khay và tiền tự trở về trống.

Giá đề nghị tự điền theo giá niêm yết của tài sản; mỗi bến xe có giá 200.
Mua/bán một thẻ điền toàn bộ giá, đổi hai thẻ điền phần chênh lệch vào bên cần bù tiền.
Người chơi vẫn sửa được số tiền; thay lựa chọn thẻ sẽ tính lại giá gợi ý. Vé ra tù giữ giá cố định 200.

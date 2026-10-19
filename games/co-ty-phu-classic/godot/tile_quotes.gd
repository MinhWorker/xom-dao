extends RefCounted
## Existing quotes and jokes shown in the Tile HUD; unknown squares stay blank.

const LINES: Array[String] = [
	"",
	"",
	"Mời đoàn mình di chuyển lên núi giúp em",
	"",
	"Nothing is certain except death and taxes",
	"",
	"",
	"May the odds be ever in your favor",
	"Hải Phòng là không lòng vòng",
	"Hà Nội không vội được đâu",
	"Đưa hộ lọ muối",
	"",
	"With great power comes great electricity bill",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"May the odds be ever in your favor",
	"",
	"",
	"",
	"",
	"",
	"",
	"Tại sao đi Đà Lạt lại vui? Tại vì ở đó có nhiều ‘dốc’",
	"Do not pass Go. Do not collect $200",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	""
]


static func for_square(square: int) -> String:
	return LINES[square] if square >= 0 and square < LINES.size() else ""

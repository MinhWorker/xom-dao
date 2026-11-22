# Splash art prompts

Splash art is the 20:9 background of the Sea chart: one per Island (`co`, `bai`, `xuc-xac`,
`nao-nhiet`) and one per ready Game. It is the Game's `hub/key-art.png`; `tools/hub-assets` crops
it around the manifest's `focus` and checks it.

Every image uses the frame below unchanged; only `{subject}`, `{x}` and `{y}` change. `{x}` and
`{y}` are the manifest's `focus` (an Island's art uses `x: 70, y: 50`). The owner pastes the
filled frame into an AI image platform of their choice. Whatever it returns, crop it to 20:9 keeping
the subject, and save it as a 2560×1152 PNG; `tools/hub-assets` checks the ratio and size.
`splash-caro-sample.png` is a reference sample made with `agy` (Antigravity CLI) from this frame;
the owner may replace it.

## Frame

```text
Wide cinematic 20:9 landscape splash illustration, 2560x1152, the background of a game-select screen.

Style: polished painterly digital illustration in the manner of Arknights event key art. Confident brushwork, crisp clean edges on the subject, soft simplified forms behind it, rich material detail on wood, paper, cloth and stone. Restrained palette: deep teal-navy shadows, warm amber and gold highlights, one saturated accent colour from the subject. Grounded, quiet Vietnamese everyday setting.

Lighting: warm low golden-hour key light from the upper right, a warm rim light on the subject, cool blue ambient fill in the shadows, gentle volumetric haze with a few drifting dust motes.

Composition: the subject's centre sits at {x}% of the width and {y}% of the height, and the subject stays inside the right 60% of the frame. The left 40% falls off smoothly into a dark, calm, low-detail area of near-black navy (about #0b1018 to #18202b) with no objects or bright spots, so a list of names can sit over it. Slightly high three-quarter camera, shallow depth of field, the background softly out of focus.

Never: text, letters, numbers, logos, interface, frames, borders, watermark, signatures, human.

Subject: {subject}
```

## Subjects

- **Caro** (`caro`, focus 70, 50): A game of Caro (Vietnamese gomoku) on a large sheet of squared
  school notebook paper lying on an old dark wooden table, seen at the winning moment: exactly five red
  cross-shaped marks drawn in ink form one unbroken diagonal line that glows faintly, and no other
  red marks on the paper; blue ring-shaped marks are scattered around them. A worn pencil and a cup of iced tea in a glass rest at
  the edge of the paper; behind, the out-of-focus tiled courtyard of a Vietnamese house at dusk.
- **Tiến Lên** (`tien-len`, focus 68, 50): A Vietnamese card game of Tiến Lên mid-round on a round
  lacquered dark wooden tray: a hand of exactly thirteen playing cards fanned out face down, their
  backs a deep crimson with a fine gold lattice pattern, and in front of the fan a short overlapping
  row of exactly four face-up cards showing only large simple heart and spade symbols, with no digits
  or letters. A small porcelain teacup with a lid and a folded bamboo hand fan rest at the edge of the
  tray; behind, a softly lit out-of-focus Vietnamese tea-house interior with carved wooden screens.
- **Đặt Bom** (`dat-bom`, focus 64, 50): A square arena of old terracotta floor tiles in a Vietnamese
  courtyard, seen at the moment before a blast: one large round iron bomb with a short rope fuse and a
  bright orange ember at its tip sits at the centre of a cross-shaped scorched mark on the tiles;
  around it stand a few weathered wooden crates and two cracked stone pillars at the edge of the
  arena, and no flames, smoke or explosion. Behind, the out-of-focus tiled courtyard wall of a
  Vietnamese house at dusk.
- **Cờ island** (`co`, focus 70, 50): A carved wooden game board with a fine engraved grid on an old
  dark wooden table, holding a few oversized pieces from different board games: three round red
  lacquered xiangqi discs with plain faces, four polished stones (two ivory-white, two black) of Go,
  and one carved wooden chess knight; a small bowl of extra stones rests beside the board; behind, a
  softly lit out-of-focus Vietnamese tea-house interior.
- **Bài island** (`bai`, focus 70, 50): A fan of exactly five ivory playing cards, standing upright and
  slightly open on a dark lacquered table, showing only large simple red heart and black spade
  symbols, with no digits or letters; a few loose cards lie face down around it with deep crimson
  backs, and a small brass incense burner stands at the edge of the table; behind, the out-of-focus
  carved wooden screens of a Vietnamese tea house.
- **Xúc Xắc island** (`xuc-xac`, focus 70, 50): Three large ivory dice with simple black pips (one with
  red pips on its showing face) resting mid-roll on an old dark wooden table, beside the corner of a
  racing board painted with four coloured home squares (red, blue, green, yellow), with a few small
  wooden horse-shaped pawns standing on it; a small ceramic bowl rests at the edge; behind, the
  out-of-focus tiled courtyard of a Vietnamese house at dusk.
- **Náo Nhiệt island** (`nao-nhiet`, focus 70, 50): A lively group of party-game props on an old dark
  wooden table: a round iron bomb with a short rope fuse and a small orange ember at its tip, next to a
  glowing five-point star lantern made of bamboo and red-and-amber paper, with a couple of small wooden
  crates behind them, and no flames, smoke or explosion; behind, the out-of-focus tiled courtyard of
  a Vietnamese house at dusk with a few warm paper lanterns.

## Where the images go

Save each result as a 2560×1152 PNG at these paths, replacing what is there:

| Splash art       | Path                                    |
| ---------------- | --------------------------------------- |
| Caro             | `games/caro/hub/key-art.png`            |
| Tiến Lên         | `games/tien-len/hub/key-art.png`        |
| Đặt Bom          | `games/dat-bom/hub/key-art.png`         |
| Island Cờ        | `apps/hub/src/island-art/co.png`        |
| Island Bài       | `apps/hub/src/island-art/bai.png`       |
| Island Xúc Xắc   | `apps/hub/src/island-art/xuc-xac.png`   |
| Island Náo Nhiệt | `apps/hub/src/island-art/nao-nhiet.png` |

A `soon` Game shows its Island's art, darkened.

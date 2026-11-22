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

Never: text, letters, numbers, logos, interface, frames, borders, watermark, signatures, close-up human faces.

Subject: {subject}
```

## Subjects

- **Caro** (`caro`, focus 70, 50): A game of Caro (Vietnamese gomoku) on a large sheet of squared
  school notebook paper lying on an old dark wooden table, seen at the winning moment: exactly five red
  cross-shaped marks drawn in ink form one unbroken diagonal line that glows faintly, and no other
  red marks on the paper; blue ring-shaped marks are scattered around them. A worn pencil and a cup of iced tea in a glass rest at
  the edge of the paper; behind, the out-of-focus tiled courtyard of a Vietnamese house at dusk.

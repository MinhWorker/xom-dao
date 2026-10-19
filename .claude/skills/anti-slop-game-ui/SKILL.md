---
name: anti-slop-game-ui
description: Use when designing, implementing, or reviewing a game's board, HUD, menu, or overlay; keep information grounded in the game world, materials coherent, and play-state hierarchy clear.
---

# Anti-Slop Game UI Protocol

For game UI work, make decisions as a senior game UI/UX designer. Shape the interface around the game's world and play, rather than importing a generic web or dashboard layout.

For a Godot game in this repository, read `apps/client/AGENTS.md` and `docs/experience.md`. Use the shared UI kit and preserve the game's required controls and interaction states.

## Explore before designing

Before proposing or coding UI components, record a short design note that answers these three questions:

1. **Diegesis:** Which information can sit on, or be read from, an object in the game world? Prefer spatial or diegetic placement when it stays clear and usable. Keep screen HUD for information that needs it.
2. **Materiality:** What materials define this world? Choose a small palette and express those materials through fills, edges, texture, lighting, and depth.
3. **Focal hierarchy:** Give gameplay at least 70% of the first-glance attention. Let HUD frame the play area and keep secondary information quiet.

## Compose for the game world

- **Keep measures distinct.** Give separate metrics separate UI elements. Do not concatenate unrelated values with `•`, `|`, or `/`. For repeated stats, prefer an icon and value; otherwise separate label and value with clear contrast and spacing. Use tabular numerals when the font supports them.
- **Group by meaning.** A shared frame is useful when it groups one semantic unit, such as one player's identity and record. Avoid generic cards that wrap unrelated controls, excessive borders, or more than two nested container levels. Use material-appropriate edges, corners, and ornaments when they clarify the object's form.
- **Anchor the scene.** Establish depth from background to play surface to secondary HUD to active HUD. Use contact shadows under prominent play surfaces and props. Add a subtle vignette to bring attention toward the play area and let edge HUD sit against the scene naturally.
- **Match the palette and light.** Derive interface colors from the game's environment. Prefer muted, desaturated accents over default neon colors. Give controls a coherent material response and one light direction; a thin brighter upper edge and darker lower edge can suggest physical depth. Avoid glossy half-button highlights unless the game's art direction calls for them.
- **Focus the active side.** Make the acting player immediately apparent. Keep inactive player cards around 50–65% opacity or reduce their saturation; give the active side a restrained brightness or edge emphasis.
- **Order actions by risk.** Make the primary action easiest to recognize, keep secondary actions visually quieter, and place destructive actions where they are less likely to be tapped by mistake. Use a subdued warning color for destructive actions.
- **Choose game-fit type.** Avoid bubbly display fonts unless the game is intentionally playful or aimed at young children. Use a distinctive display face for turn or title text when it fits; favor a sharp, readable sans serif for controls and statistics.

## Review before finishing

Check the rendered screen, preferably with a headless screenshot at supported sizes. For phone coverage in this repository, follow `.claude/skills/phone-check/SKILL.md`.

- Can a player tell within one second whose turn it is and what the most important number means?
- Are any unrelated metrics joined into one string?
- Does every container group related information and help scanning?
- Does the dangerous action sit safely apart from the primary action?
- Do the palette, edges, texture, light, and shadows belong to this game's materials?
- Does gameplay remain the clear visual focus at the smallest supported size?

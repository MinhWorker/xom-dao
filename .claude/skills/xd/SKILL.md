---
name: xd
description: Drive the running Godot client from the command line (xd CLI): screenshots, node tree, taps, navigation, accounts, PvP rooms and dev-console state overrides. Use whenever you need to see or play a hub screen or game table while working on the client or a game.
---

# Drive the Godot client with xd

`npm run -s xd -- <command>` talks to desktop debug clients ("sessions") over a local channel.
Each command takes about 0.5 s, and there is no web export or browser. The full command list is in
`npm run -s xd -- help`; `tools/xd/README.md` has examples.

## Loop

1. `npm run -s xd -- server start` (a dev server of its own: dev commands on, memory accounts).
   It reuses `npm run dev` on :8033 when xd's own server is not up.
2. `npm run -s xd -- start` opens session `main` as account `xdmain` (about 2.5 s). Add
   `--play <game>` to land on that game's sandbox table.
3. Look with `shot` (then Read `.shots/xd-main.png`) and `tree --rects`. A crop is cheaper to
   look at than the whole window: `shot <node> --pad 16`, or `--scale 0.5` for a full view.
4. Act: `tap <node>`, `swipe`, `type`, `key`, `go <place>`, `room …`, `send`.
5. After editing GDScript or a scene: `npm run -s xd -- restart`. It logs in again and resumes the
   seat. Add `--import` for new images or sounds.
6. When done: `npm run -s xd -- stop --all` and `npm run -s xd -- server stop`.
   Stop them before `npm run e2e` too: running sessions slow the browser enough to time out.

## Tips

- Address nodes with selectors: a name, `type:Class`, `text:Part`, `[n]` for the n-th match, and
  `/` between steps (`Seat_0/type:Label[1]`, `text:Đầu hàng`). Name nodes that tests or tools
  need to reach (as in `apps/client/AGENTS.md`). `@Type@N` names work, but only for that run.
- Compare screens: `compare <session> <session> [node] [--scale 0.5]` makes one labelled image.
  Use `shot --rect x,y,w,h` (boxes from `tree --rects`) to look closely at an area.
- `wait` instead of sleeping: `--text "Status=Lượt bạn"`, `--node ResultBoard`,
  `--expr 'client.snapshot.status == "finished"'`.
- PvP: `start a`, `start b`, `-s a room create <game> --json` for the code, `-s b room join`,
  `-s b room ready`, `-s a room start`. Then act from each side with `-s`.
- Set up a scenario through the server's real rules with `dev '<line>'` (the room's dev console:
  `state get|set`, `snapshot save|load`, `seed`, `rng push`, `as <seat> <event>`, `finish`).
  Read the state first (`dev 'state get'`) and change it in small steps.
- `eval` reads or calls anything in the client (`hub`, `client`, `root`, `bridge`,
  `find("Name")`).
- `logs --errors` after anything odd; a command that hit a script error says so.
- For real phone sizes, pixel density and notches, finish with `phone-check` (`npm run shots`).

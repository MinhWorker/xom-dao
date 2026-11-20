# AGENTS.md

Games to play with friends in the browser; a solo project. npm-workspaces monorepo: a NestJS server
(WebSocket + JSON), a Godot 4 client exported to the web, one folder per game.

**Direction:** the project is moving to a web Hub that embeds each Game, built in any engine, in
an iframe. The current Godot hub and its games are legacy (tag `legacy-godot`) and may be deleted
when they block the new platform. Vocabulary: `GLOSSARY.md`. Before planning platform work, read
the wayfinder map, issue #200, and the decisions linked from it.

## Read first when working on

| Working on | Read |
| --- | --- |
| A game or the SDK (`games/`, `packages/sdk/`) | `games/AGENTS.md` |
| The Godot client or toolchain (`apps/client/`, `games/<id>/godot/`, `tools/godot/`) | `apps/client/AGENTS.md` |
| The server, rooms, accounts, DB, protocol, deploy (`apps/server/`, `packages/shared/`, `apps/console/`) | `apps/server/AGENTS.md` |
| Images or sounds | `assets/AGENTS.md` |

## Commands (repo root)

- `npm install` (npm only). Rerun it and restart dev after adding a game folder.
- `npm run dev`: server on :8033, web on :5033 (needs `npm run godot:export -- --debug`).
  The owner often runs it; start your own on other ports (`PORT=8133 WEB_PORT=5133`) and stop it
  when done.
- `npm run check`: lint, typecheck, `gen:protocol --check`, unit tests, `godot:check` when Godot is
  installed. `npm run format` fixes formatting.
- `npm run e2e -- --changed origin/main`, `npm run shots`: headless browser checks.
- `npm run -s xd -- <command>`: drive desktop debug clients (the `xd` skill).

## Conventions

- TypeScript strict. Relative imports in `packages/*`, `games/*` and `apps/server` end in `.js`.
- GDScript is statically typed (`apps/client/AGENTS.md`).
- Players see Vietnamese: UI copy and server/game error messages, with no instructional subtext.
  Code, identifiers, commits, PR titles and agent files are English.
- Comments: a short doc comment on a function or class whose purpose its name doesn't carry.
  Delete other comments in the code you touch.
- Docs: only what an agent needs. `games/<id>/RULES.md` holds a game's current rules (the client
  shows it); agent files hold the rest. Keep them accurate when layout, commands or conventions
  change.

## Issue tracker

GitHub Issues on `MinhWorker/xom-dao`, through `gh`. Labels: `needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`; wayfinder maps and tickets use `wayfinder:*` labels only,
with GitHub sub-issues for parent/child and native "blocked by" dependencies
(`gh api repos/MinhWorker/xom-dao/issues/<n>/dependencies/blocked_by`).

## Git and PRs

- Branch, open a PR, squash-merge; never push to `main`. Merging deploys (Vercel + Render).
- PR title is a Conventional Commit (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, optional
  scope). release-please owns versions and `CHANGELOG.md`.

## Before finishing

- Assets only: look at the file where it's used.
- Code: `npm run check` passes. Godot changes: `npm run godot:check`.
- Gameplay, room flow, protocol or socket changes: also `npm run e2e -- --changed origin/main`
  once at the end, against your own dev server, and look at the screenshots.

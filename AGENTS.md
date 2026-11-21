# AGENTS.md

Games to play with friends in the browser; a solo project. npm-workspaces monorepo: a NestJS server
(WebSocket + JSON), a React Hub (`apps/hub`), one folder per game, dev tools in `tools/`. The
Godot client, web shell and console are removed.

**Direction:** the project is moving to a web Hub that embeds each Game, built in any engine, in
an iframe. The old Godot hub and its games are legacy (tag `legacy-godot`); only the rules and tests of
`tien-len` and `tic-tac-toe` are kept, as the source for rewriting them. Vocabulary: `GLOSSARY.md`. Before planning platform work, read
the wayfinder map, issue #200, and the decisions linked from it.

## Read first when working on

| Working on | Read |
| --- | --- |
| A game, the SDK or the Bridge (`games/`, `packages/sdk/`, `packages/bridge/`) | `games/AGENTS.md` |
| The Hub web app (`apps/hub/`) | `apps/hub/AGENTS.md` |
| The server, rooms, accounts, DB, protocol, deploy (`apps/server/`, `packages/shared/`) | `apps/server/AGENTS.md` |
| Running a Game without the Hub (`tools/harness/`) | "The Harness" in `games/AGENTS.md` |
| Images or sounds | `assets/AGENTS.md` |

## Commands (repo root)

- `npm install` (npm only). After adding a game folder, follow `games/AGENTS.md` (build contract), rerun it and restart dev.
- `npm run dev`: the server on :8033 and the Hub on :8030. The owner often runs it; start your
  own on other ports (`apps/hub/AGENTS.md`) and stop them when done.
- `npm run build`, `npm run typecheck`, `npm run test`: Turborepo (`turbo.json`) runs the task in
  every workspace that has it, in dependency order, and caches the result. CI adds `--affected`
  on PRs and uses the remote cache (`TURBO_TOKEN` secret, `TURBO_TEAM` variable).
- `npm run check`: lint, typecheck and unit tests. `npm run format` fixes formatting.
- `npm run harness -- <command>`: the Harness, which runs one Game against a server without the Hub
  (`games/AGENTS.md`).
- `npm run smoke`: bots log in, make a Room and start a Match against a running server.
- `npm run smoke:web`: a headless browser plays Đặt Bom's client through the Harness
  (`games/AGENTS.md`). CI runs it.
- `npm run smoke:hub`: two headless browsers become friends, invite each other into a Room and open
  a profile on the Hub (`apps/hub/AGENTS.md`). CI runs it.
- `npm run e2e`: two headless browsers sign in, make a Caro Room and play a Match to its result
  through the Hub; screenshots go to `e2e/`. Needs the server and Caro built. CI runs it.

## Conventions

- TypeScript strict. Relative imports in `packages/*`, `games/*` and `apps/server` end in `.js`.
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

- Branch, open a PR, squash-merge; never push to `main`. Merging deploys the server (Render).
- PR title is a Conventional Commit (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, optional
  scope). release-please owns versions and `CHANGELOG.md`.

## Before finishing

- Assets only: look at the file where it's used.
- Code: `npm run check` passes. Protocol or socket changes: also run `npm run smoke` against
  your own dev server.

# Xóm Đảo

A web hub where friends play games built in any engine, each embedded as an independent sub-project.

## Platform

**Hub**:
The web app players open: sign-in, lobby, game list, rooms. It hosts games but holds no game rules.
_Avoid_: Client, shell, launcher

**Game**:
An independently developed sub-project, built to a web bundle in any engine, embedded in the Hub in an iframe and talking to it only through the Bridge.
_Avoid_: Island, plugin, module, mini-game

**Game manifest**:
What a Game declares, as static data, so the Hub can present it and open Rooms for it: name, short description, player count, duration, room options and art.
_Avoid_: Meta, catalog entry, game info

**Bridge**:
The contract between the Hub and an embedded Game: what each side may tell or ask the other.
_Avoid_: SDK (for the embedding side), API

**Game server**:
The part of a Game that runs on the shared server: a Turn-based game's rules or a Realtime game's tick. It decides how a Match ends and its Match result, and never touches Player data.
_Avoid_: Plugin, backend module

**Harness**:
A local stand-in for the Hub that runs one Game against a real server, so the Game can be developed and tested without the Hub.
_Avoid_: Sandbox, mock hub, simulator

## State

**Player data**:
Long-lived per-player records owned by the shared backend: account, currency, inventory (items, emoji), achievements, match history. Used by the Hub; a Game never writes it directly and never needs it to play.
_Avoid_: Profile, save data

**Session state**:
Who is online, which Room exists, who sits where, invites and matchmaking. Owned by the Hub and the shared backend.
_Avoid_: Lobby state

**Match state**:
The state of one play-through (board, positions, turn). Owned by the Game.
_Avoid_: Game state, room state

**Match**:
One play-through of a Game by a Room, run by the server from loading until it is over. It ends either settled, with a result, or aborted, with no result, reward or history.
_Avoid_: Round, game (for one play-through)

**Match result**:
The outcome of one settled Match, handed by the Game server to the shared backend: each seat's place and an optional score. Settled once per Match.
_Avoid_: Score, outcome

**Room**:
A group of players about to play or playing one Game together.
_Avoid_: Table, lobby

## Game kinds

**Turn-based game**:
A Game whose Match state changes only when a player acts; its rules can run as pure functions on the shared server.
_Avoid_: Simple game, table game

**Realtime game**:
A Game whose Match state advances on a server tick regardless of player input.
_Avoid_: Complex game, action game

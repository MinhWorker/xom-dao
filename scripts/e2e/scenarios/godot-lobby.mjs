// The Godot hub (#117): from the island ring lobby, open Caro's card in the game select, choose
// it, press CHƠI and play the computer that quick match seats after a wait; win, and the coins
// fly into the balance. Then make a room and a friend opens its invite link. Needs the debug
// web build (npm run godot:export -- --debug).

import {
  caroPlayToEnd,
  coins,
  createRoom,
  DESKTOP,
  godotText,
  launch,
  onScene,
  openGodot,
  PHONE,
  room,
  tap,
  tapCard,
} from '../godot.mjs';

export const games = ['tic-tac-toe'];
export { launch };

export default async function run(t) {
  const host = await openGodot(t, await t.page(DESKTOP));

  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', /./);
  const before = await host.evaluate(() => window.xomdao.state().balances['core:coin'] ?? 0);
  await godotText(host, 'Coins', coins(before));
  await host.screenshot({ path: t.shot('1-lobby.png') });

  // The card opens the game select on Cờ; a tap on Caro's poster opens a room of it.
  await tap(host, 'SelectedGame');
  await onScene(host, 'select');
  await host.screenshot({ path: t.shot('2-select.png') });
  await tapCard(host, 'tic-tac-toe');

  // The room's plate seats the computer, then the host starts.
  await onScene(host, 'room');
  await godotText(host, 'RoomCount', '1/2');
  await godotText(host, 'RoomGame', 'Caro');
  const option = await host.waitForFunction(() => window.xomdao.rect('Option_opponent'));
  const box = await option.jsonValue();
  await host.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2); // Máy
  await godotText(host, 'RoomCount', '2/2');
  const mine = await room(host);
  if (!mine.players.some((p) => p.bot)) throw new Error('The room seated no computer');
  await host.screenshot({ path: t.shot('3-room.png') });
  // The scroll shows the rules; again and they are gone.
  await tap(host, 'RoomRules');
  await godotText(host, 'RulesText', /./);
  await host.screenshot({ path: t.shot('4-rules.png') });
  await host.mouse.click(10, 400);
  await tap(host, 'Start');
  await onScene(host, 'tic-tac-toe', 30_000);
  await caroPlayToEnd(host);
  await godotText(host, 'ResultTitle', 'Bạn thắng!');
  // 20 for the win, then 20 + 20 for the first game's achievements (Ván đầu tiên, Trận thắng đầu).
  const after = before + 20 + 40;
  await godotText(host, 'Coins', coins(after));
  await host.screenshot({ path: t.shot('5-result.png') });

  // Back in the lobby with Caro still on CHƠI; Tạo phòng, then a friend opens the link.
  await tap(host, 'Home');
  await onScene(host, 'lobby');
  await godotText(host, 'SelectedName', 'Caro');
  await godotText(host, 'Coins', coins(after));
  await createRoom(host);
  const code = await godotText(host, 'RoomCode', /^[A-Z0-9]{4}$/);
  const friend = await openGodot(t, await t.page(PHONE), `?room=${code}`);
  await onScene(friend, 'room');
  await host.waitForFunction(() => window.xomdao.state().room?.players.length === 2);
  await godotText(friend, 'RoomStatus', 'Chờ chủ phòng bắt đầu');
  await host.screenshot({ path: t.shot('6-room-desktop.png') });
  await friend.screenshot({ path: t.shot('7-room-phone.png') });
}

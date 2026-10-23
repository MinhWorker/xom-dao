// Stats and achievements in the Godot client (#126): Lan plays Caro against the computer in the
// sandbox (?play=tic-tac-toe); the game unlocks "Ván đầu tiên" (a notice, and its coins). Her Nhà
// shows the level, reached achievement and match history; Đình ranks her on the podium. Needs
// the debug web build (npm run godot:export -- --debug) and a dev server.

import { caroPlayToEnd, DESKTOP, godotText, launch, onScene, openGodot, tap } from '../godot.mjs';

export const games = ['tic-tac-toe'];
export { launch };

export default async function run(t) {
  const lan = await openGodot(t, await t.page(DESKTOP), '?play=tic-tac-toe');
  await onScene(lan, 'tic-tac-toe', 60_000);
  await caroPlayToEnd(lan);
  await godotText(lan, 'ResultTitle', /^(Bạn thắng!|Hoà|.+ thắng!)$/);
  // Ván đầu tiên pays 20 coins (and Trận thắng đầu 20 more when she won).
  await lan.waitForFunction(() => (window.xomdao.state().balances['core:coin'] ?? 0) >= 20);
  await lan.screenshot({ path: t.shot('1-result.png') });

  await tap(lan, 'Home');
  await onScene(lan, 'lobby');
  await godotText(lan, 'LobbyLevel', 'Cấp 1');
  await tap(lan, 'Profile');
  await onScene(lan, 'nha');
  await godotText(lan, 'HomePlayed', '1 ván');
  await tap(lan, 'Tab_thanh-tich');
  await godotText(lan, 'AchievementReached', 'Đã đạt');
  const first = await lan.evaluate(() => window.xomdao.rect('Achievement_core-played-1'));
  if (!first) throw new Error('Ván đầu tiên is not on the shelf');
  await lan.screenshot({ path: t.shot('2-achievements.png') });
  await tap(lan, 'Tab_lich-su');
  await godotText(lan, 'MatchOutcome', /^(Thắng|Thua|Hoà)$/);
  await lan.screenshot({ path: t.shot('3-history.png') });

  await tap(lan, 'Back');
  await onScene(lan, 'lobby');
  await tap(lan, 'Place_dinh');
  await onScene(lan, 'dinh');
  // She has experience now, so Cả xóm has her on the podium.
  await lan.waitForFunction(() => window.xomdao.rect('Rank_1') !== null, null, { timeout: 30_000 });
  await lan.screenshot({ path: t.shot('4-dinh.png') });
}

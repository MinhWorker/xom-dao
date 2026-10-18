// Nhà and Chợ in the Godot client (#125): Lan gets coins (dev:coins), can't buy what she can't
// pay for, buys a frame and an old Phaser avatar, equips both from Túi đồ, and makes a room.
// Hùng joins it at Bến, sees her new look, and opens her Nhà (read-only). Needs the debug web
// build (npm run godot:export -- --debug) and a dev server (XOMDAO_DEV=1).

import {
  createRoom,
  DESKTOP,
  godotText,
  launch,
  onScene,
  openGodot,
  PHONE,
  room,
  tap,
  typeInto,
} from '../godot.mjs';

export const games = ['tic-tac-toe'];
export { launch };

const coinsOf = (page) => page.evaluate(() => window.xomdao.state().balances['core:coin'] ?? 0);

export default async function run(t) {
  const lan = await openGodot(t, await t.page(DESKTOP));
  const hung = await openGodot(t, await t.page(PHONE));
  await onScene(lan, 'lobby');
  await onScene(hung, 'lobby');
  await tap(hung, 'Profile');
  await onScene(hung, 'nha');
  await hung.screenshot({ path: t.shot('0-home-phone.png') });
  await tap(hung, 'Back');
  await onScene(hung, 'lobby');
  await lan.evaluate(() => window.xomdao.request('dev:coins', { amount: 350 }));
  await lan.waitForFunction(() => window.xomdao.reply()?.ok === true);

  await tap(lan, 'Place_cho');
  await onScene(lan, 'cho');
  await godotText(lan, 'Price_frame-jade', '180');
  await lan.screenshot({ path: t.shot('1-shop.png') });
  // 450 coins: refused, nothing paid.
  await tap(lan, 'Buy_frame-obsidian');
  await godotText(lan, 'Toast', 'Không đủ xu');
  if ((await coinsOf(lan)) !== 350) throw new Error('A refused purchase changed the balance');
  // A double tap pays once.
  const buy = await lan.evaluate(() => window.xomdao.rect('Buy_frame-jade'));
  await lan.mouse.click(buy.x + buy.width / 2, buy.y + buy.height / 2, { clickCount: 2 });
  await godotText(lan, 'Owned_frame-jade', 'Đã có');
  await lan.waitForFunction(() => window.xomdao.state().balances['core:coin'] === 170);
  await lan.screenshot({ path: t.shot('2-bought.png') });

  await tap(lan, 'Tab_avatar');
  await godotText(lan, 'Price_avatar-long', '120');
  await tap(lan, 'Buy_avatar-long');
  await godotText(lan, 'Owned_avatar-long', 'Đã có');
  await lan.waitForFunction(() => window.xomdao.state().balances['core:coin'] === 50);
  await lan.screenshot({ path: t.shot('3-avatar-shop.png') });

  await tap(lan, 'Back');
  await onScene(lan, 'lobby');
  await tap(lan, 'Profile');
  await onScene(lan, 'nha');
  await tap(lan, 'EditLooks');
  await tap(lan, 'BagKind_avatar');
  await tap(lan, 'Item_avatar-long');
  await tap(lan, 'Equip_avatar-long');
  await lan.waitForFunction(() => window.xomdao.state().user.avatar === 'long');
  await godotText(lan, 'Equip_avatar-long', 'Đang dùng');
  await tap(lan, 'Tab_ho-so');
  await lan.screenshot({ path: t.shot('4-home-avatar.png') });

  await tap(lan, 'Tab_tui-do');
  await tap(lan, 'BagKind_frame');
  await tap(lan, 'Item_frame-jade');
  await tap(lan, 'Equip_frame-jade');
  await lan.waitForFunction(() => window.xomdao.state().user.frame === 'jade');
  await godotText(lan, 'Equip_frame-jade', 'Đang dùng');
  await lan.screenshot({ path: t.shot('5-home-frame.png') });

  await tap(lan, 'Tab_ho-so');
  await tap(lan, 'EditName');
  await typeInto(lan, 'NameInput', 'Lan Dao');
  await tap(lan, 'SaveName');
  await lan.waitForFunction(() => window.xomdao.state().user.name === 'Lan Dao');
  await godotText(lan, 'HomeName', 'Lan Dao');
  await lan.screenshot({ path: t.shot('6-home-name.png') });

  await tap(lan, 'Back');
  await onScene(lan, 'lobby');
  await createRoom(lan);
  await onScene(lan, 'room');
  const code = await godotText(lan, 'RoomCode', /^[A-Z0-9]{4}$/);

  await onScene(hung, 'lobby');
  await tap(hung, 'Place_ben');
  await onScene(hung, 'ben');
  await typeInto(hung, 'CodeInput', code);
  await tap(hung, 'Join');
  await onScene(hung, 'room');
  const lanId = await lan.evaluate(() => window.xomdao.state().user.id);
  const seen = (await room(hung)).players.find((p) => p.id === lanId);
  if (seen?.frame !== 'jade' || seen?.avatar !== 'long' || seen?.name !== 'Lan Dao')
    throw new Error(`Hùng sees Lan as ${seen?.name}/${seen?.avatar}/${seen?.frame}`);
  await hung.screenshot({ path: t.shot('7-room-phone.png') });
  // Lan is the host, in the first seat: her Nhà opens, read-only.
  await tap(hung, 'Seat0');
  await tap(hung, 'Tab_tui-do');
  await hung.waitForFunction(() => window.xomdao.rect('Item_frame-jade')?.width > 0);
  if (await hung.evaluate(() => window.xomdao.rect('Equip_frame-jade')))
    throw new Error("Someone else's Nhà offers Dùng");
  await hung.screenshot({ path: t.shot('8-her-home-phone.png') });
}

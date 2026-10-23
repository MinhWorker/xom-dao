import { Inject, Injectable } from '@nestjs/common';
import {
  COIN,
  type Letter,
  MAIL_BODY_MAX,
  MAIL_COINS_MAX,
  MAIL_TITLE_MAX,
  type Mailbox,
} from '@xomdao/shared';
import { z } from 'zod';
import { AccountsService } from '../accounts/accounts.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import type { InboxRow, LetterRow, MailStore } from './mail.store.js';

export const MAIL_STORE = Symbol('MAIL_STORE');

/** How many letters Hộp thư shows, and the console's list of sent ones. */
export const MAILBOX_SIZE = 50;

/** A refusal the player or the console reads (in Vietnamese). */
export class MailError extends Error {}

/** A letter written in the console: `to` is a username, empty for everyone. */
const outgoing = z.object({
  to: z.string().trim().max(40).default(''),
  title: z
    .string()
    .trim()
    .min(1, 'Thư cần tiêu đề')
    .max(MAIL_TITLE_MAX, `Tiêu đề tối đa ${MAIL_TITLE_MAX} ký tự`),
  body: z
    .string()
    .trim()
    .min(1, 'Thư cần nội dung')
    .max(MAIL_BODY_MAX, `Nội dung tối đa ${MAIL_BODY_MAX} ký tự`),
  coins: z.coerce
    .number()
    .int('Số xu phải là số nguyên')
    .min(0, 'Số xu không được âm')
    .max(MAIL_COINS_MAX, `Tối đa ${MAIL_COINS_MAX} xu một thư`)
    .default(0),
});

/** A sent letter for the console. */
export interface SentLetter {
  id: string;
  to: string;
  title: string;
  body: string;
  coins: number;
  sentAt: string;
}

/**
 * Hộp thư (docs/adr/0002-modules.md): letters from Xóm Đảo, written in the console to one account
 * or to everyone, sometimes with coins. It owns `letters` and `letter_receipts`; coins are paid
 * through the ledger keyed `mail:<letter>:<user>`, so a letter pays each reader once. The rooms
 * gateway listens (`onSent`) to push the fresh Hộp thư to whoever is online.
 */
@Injectable()
export class MailService {
  private readonly listeners: ((userId: string | null) => void)[] = [];

  constructor(
    @Inject(MAIL_STORE) private readonly store: MailStore,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
  ) {}

  /** Called with the receiver (null: everyone) after each letter goes out. */
  onSent(listener: (userId: string | null) => void) {
    this.listeners.push(listener);
  }

  async mailbox(userId: string): Promise<Mailbox> {
    const letters = (await this.store.inbox(userId, MAILBOX_SIZE)).map(toLetter);
    const waiting = letters.filter((l) => !l.read || (l.coins > 0 && !l.claimed)).length;
    return { letters, waiting };
  }

  async read(userId: string, letterId: string): Promise<Mailbox> {
    await this.find(userId, letterId);
    await this.store.markRead(userId, letterId);
    return this.mailbox(userId);
  }

  /** Pays a letter's coins, once. */
  async claim(userId: string, letterId: string) {
    const letter = await this.find(userId, letterId);
    if (letter.coins <= 0) throw new MailError('Thư này không có quà');
    if (letter.claimed || !(await this.store.claim(userId, letterId))) {
      throw new MailError('Bạn đã nhận rồi');
    }
    await this.ledger.apply({
      userId,
      resource: COIN,
      amount: letter.coins,
      reason: 'mail',
      key: `mail:${letterId}:${userId}`,
    });
    return { mailbox: await this.mailbox(userId), balances: await this.ledger.balances(userId) };
  }

  /** Sends a letter from the console. */
  async send(input: unknown): Promise<SentLetter> {
    const parsed = outgoing.safeParse(input);
    if (!parsed.success) throw new MailError(parsed.error.issues[0]?.message ?? 'Thư chưa đúng');
    const { to, ...letter } = parsed.data;
    let userId: string | null = null;
    if (to) {
      const user = await this.accounts.userByUsername(to);
      if (!user) throw new MailError('Không có ai tên đăng nhập này');
      userId = user.id;
    }
    const row = await this.store.send({ ...letter, userId });
    for (const listener of this.listeners) listener(userId);
    return this.forConsole(row);
  }

  /** The newest letters sent, for the console. */
  async sent(): Promise<SentLetter[]> {
    return Promise.all((await this.store.sent(MAILBOX_SIZE)).map((row) => this.forConsole(row)));
  }

  async remove(id: string) {
    if (!z.uuid().safeParse(id).success || !(await this.store.remove(id))) {
      throw new MailError('Không tìm thấy thư');
    }
  }

  private async find(userId: string, letterId: string): Promise<InboxRow> {
    const letter = (await this.store.inbox(userId, MAILBOX_SIZE)).find((l) => l.id === letterId);
    if (!letter) throw new MailError('Không tìm thấy thư');
    return letter;
  }

  private async forConsole(row: LetterRow): Promise<SentLetter> {
    const to = row.userId ? ((await this.accounts.userById(row.userId))?.username ?? '') : '';
    const { id, title, body, coins, sentAt } = row;
    return { id, to, title, body, coins, sentAt: sentAt.toISOString() };
  }
}

function toLetter(row: InboxRow): Letter {
  const { id, title, body, coins, sentAt, read, claimed } = row;
  return { id, title, body, coins, sentAt: sentAt.getTime(), read, claimed };
}

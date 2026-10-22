import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** The question the console asks before letting anyone in. */
export const CONSOLE_QUESTION = 'Thằng chủ Game này tên gì?';

/** How long a console login lasts. */
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
/** Wrong answers allowed per address per window, then it must wait. */
const MAX_WRONG = 5;
const WRONG_WINDOW_MS = 10 * 60 * 1000;

/** Answers compare in lowercase, NFC, with spaces squeezed: "  bất  KHUẤT " is right too. */
const normalize = (answer: string) =>
  answer.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
const digest = (text: string) => createHash('sha256').update(text).digest();

/** sha256 of the default answer, normalized; `XOMDAO_CONSOLE_ANSWER` replaces it. */
const DEFAULT_ANSWER_SHA256 = '22bbe32d806ad9e5fd09f9403692701ad42cef598c735e3d9c70098ce25f94a2';

export class ConsoleAuthError extends Error {}

/**
 * Who may use the console (/console): whoever answers `CONSOLE_QUESTION`. A right answer gets a
 * random token that lives in this server's memory for `TOKEN_TTL_MS` (a restart logs everyone
 * out). Wrong answers are counted per address, so the answer can't be guessed quickly.
 */
@Injectable()
export class ConsoleAuthService {
  private readonly tokens = new Map<string, number>();
  private readonly wrong = new Map<string, { count: number; since: number }>();
  private readonly answer: Buffer;

  constructor() {
    const fromEnv = process.env.XOMDAO_CONSOLE_ANSWER;
    this.answer = fromEnv ? digest(normalize(fromEnv)) : Buffer.from(DEFAULT_ANSWER_SHA256, 'hex');
  }

  /** A token for a right answer; throws `ConsoleAuthError` (shown as is) otherwise. */
  login(answer: unknown, address: string, now = Date.now()): string {
    const tries = this.wrong.get(address);
    if (tries && now - tries.since > WRONG_WINDOW_MS) this.wrong.delete(address);
    const recent = this.wrong.get(address);
    if (recent && recent.count >= MAX_WRONG) {
      throw new ConsoleAuthError('Sai nhiều lần quá, chờ 10 phút rồi thử lại');
    }
    const given = typeof answer === 'string' ? answer.slice(0, 200) : '';
    if (!timingSafeEqual(digest(normalize(given)), this.answer)) {
      this.wrong.set(address, { count: (recent?.count ?? 0) + 1, since: recent?.since ?? now });
      throw new ConsoleAuthError('Sai rồi');
    }
    this.wrong.delete(address);
    const token = randomBytes(32).toString('base64url');
    this.tokens.set(token, now + TOKEN_TTL_MS);
    return token;
  }

  /** Whether a token from `login` is still good. */
  check(token: string, now = Date.now()) {
    const expires = this.tokens.get(token);
    if (expires === undefined) return false;
    if (expires <= now) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }

  logout(token: string) {
    this.tokens.delete(token);
  }
}

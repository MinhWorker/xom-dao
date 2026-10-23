import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ITEM_LOOKS, ITEM_SLOTS } from '@xomdao/shared';
import { ACCOUNT_PAGE_SIZE, AccountError, AccountsService } from '../accounts/accounts.service.js';
import { ItemError, ItemsService } from '../items/items.service.js';
import { MailError, MailService } from '../mail/mail.service.js';
import { bearer, ConsoleGuard } from './console.guard.js';
import { CONSOLE_QUESTION, ConsoleAuthError, ConsoleAuthService } from './console-auth.service.js';

/** The caller's address: the last hop the host's proxy saw (it appends), else the socket's. */
function addressOf(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }) {
  const forwarded = req.headers['x-forwarded-for'];
  const last = typeof forwarded === 'string' ? forwarded.split(',').pop()?.trim() : '';
  return last || req.socket?.remoteAddress || '';
}

/** Turns refused edits into 400 `{ message }` (Vietnamese, shown in the console). */
async function run<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    if (
      err instanceof AccountError ||
      err instanceof ItemError ||
      err instanceof MailError ||
      err instanceof ConsoleAuthError
    ) {
      throw new BadRequestException(err.message);
    }
    throw err;
  }
}

/** The console's login: the question, and a token for the right answer. */
@Controller('api/console')
export class ConsoleAuthController {
  constructor(private readonly auth: ConsoleAuthService) {}

  @Get('question')
  question() {
    return { question: CONSOLE_QUESTION };
  }

  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: { answer?: unknown } | undefined,
    @Req() req: Parameters<typeof addressOf>[0],
  ) {
    return run(async () => ({ token: this.auth.login(body?.answer, addressOf(req)) }));
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Headers('authorization') header: unknown) {
    this.auth.logout(bearer(header));
    return { ok: true };
  }
}

/** Người dùng: list, make, edit and delete accounts. */
@Controller('api/console/users')
@UseGuards(ConsoleGuard)
export class ConsoleUsersController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  async list(@Query('q') q?: string, @Query('page') page?: string) {
    const found = await this.accounts.listAccounts(String(q ?? ''), Number(page ?? 1));
    return { ...found, pageSize: ACCOUNT_PAGE_SIZE };
  }

  @Post()
  create(@Body() body: unknown) {
    return run(async () => ({ user: await this.accounts.createAccount(body) }));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return run(async () => ({ user: await this.accounts.updateAccount(id, body) }));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return run(async () => {
      await this.accounts.deleteAccount(id);
      return { ok: true };
    });
  }
}

/** Vật phẩm: the shop's items, with the looks each slot can give. */
@Controller('api/console/items')
@UseGuards(ConsoleGuard)
export class ConsoleItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  async list() {
    return { items: await this.items.list(), slots: ITEM_SLOTS, looks: ITEM_LOOKS };
  }

  @Post()
  create(@Body() body: unknown) {
    return run(async () => ({ item: await this.items.create(body) }));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return run(async () => ({ item: await this.items.update(id, body) }));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return run(async () => {
      await this.items.remove(id);
      return { ok: true };
    });
  }
}

/** Thư: letters to one account or to everyone, maybe with coins (Hộp thư in the hub). */
@Controller('api/console/mail')
@UseGuards(ConsoleGuard)
export class ConsoleMailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  async list() {
    return { letters: await this.mail.sent() };
  }

  @Post()
  send(@Body() body: unknown) {
    return run(async () => ({ letter: await this.mail.send(body) }));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return run(async () => {
      await this.mail.remove(id);
      return { ok: true };
    });
  }
}

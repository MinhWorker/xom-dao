import { Controller, Get, Inject } from '@nestjs/common';
import { PROTOCOL_VERSION } from '@xomdao/shared';
import { sql } from 'drizzle-orm';
import { DB, type Db } from './db/db.module.js';
import { DisabledGamesService } from './game-host/disabled-games.service.js';
import { GameHostService } from './game-host/game-host.service.js';
import { APP_COMMIT, APP_VERSION } from './version.js';

const build = { version: APP_VERSION, commit: APP_COMMIT, protocol: PROTOCOL_VERSION };

@Controller('api')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Db | null,
    private readonly gameHost: GameHostService,
    private readonly disabledGames: DisabledGamesService,
  ) {}

  @Get('health')
  async health() {
    if (!this.db) return { ok: true, db: 'off', ...build };
    try {
      await this.db.execute(sql`select 1`);
      return { ok: true, db: 'up', ...build };
    } catch {
      return { ok: true, db: 'down', ...build };
    }
  }

  /** The loaded Game servers that are not switched off. */
  @Get('games')
  games() {
    return this.disabledGames.enabled(this.gameHost.gameIds());
  }
}

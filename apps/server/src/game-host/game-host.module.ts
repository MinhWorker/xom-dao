import { Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { DISABLED_GAMES_STORE, DisabledGamesService } from './disabled-games.service.js';
import { MemoryDisabledGamesStore, PgDisabledGamesStore } from './disabled-games.store.js';
import { GameHostService } from './game-host.service.js';
import { GAME_MANIFESTS, GAME_SERVERS, gameServersProvider, manifestsProvider } from './games.js';

@Module({
  providers: [
    gameServersProvider,
    manifestsProvider,
    GameHostService,
    {
      provide: DISABLED_GAMES_STORE,
      inject: [DB],
      useFactory: (db: Db | null) =>
        db ? new PgDisabledGamesStore(db) : new MemoryDisabledGamesStore(),
    },
    DisabledGamesService,
  ],
  exports: [GAME_MANIFESTS, GAME_SERVERS, GameHostService, DisabledGamesService],
})
export class GameHostModule {}

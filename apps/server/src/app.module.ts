import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { DbModule } from './db/db.module.js';
import { FriendsModule } from './friends/friends.module.js';
import { HealthController } from './health.controller.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { MatchesModule } from './matches/matches.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { StatsModule } from './stats/stats.module.js';

// The server only answers /api and the /ws WebSocket.
@Module({
  imports: [
    DbModule,
    AccountsModule,
    MatchesModule,
    LedgerModule,
    StatsModule,
    FriendsModule,
    RoomsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

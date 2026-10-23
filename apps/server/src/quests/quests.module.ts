import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { QUESTS_STORE, QuestsService } from './quests.service.js';
import { MemoryQuestsStore, PgQuestsStore } from './quests.store.js';

@Global()
@Module({
  providers: [
    {
      provide: QUESTS_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgQuestsStore(db) : new MemoryQuestsStore()),
    },
    QuestsService,
  ],
  exports: [QuestsService],
})
export class QuestsModule {}

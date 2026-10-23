import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { FRIENDS_STORE, FriendsService } from './friends.service.js';
import { MemoryFriendsStore, PgFriendsStore } from './friends.store.js';

@Global()
@Module({
  providers: [
    {
      provide: FRIENDS_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgFriendsStore(db) : new MemoryFriendsStore()),
    },
    FriendsService,
  ],
  exports: [FriendsService],
})
export class FriendsModule {}

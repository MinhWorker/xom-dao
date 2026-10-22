import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { ITEMS_STORE, ItemsService } from './items.service.js';
import { MemoryItemsStore, PgItemsStore } from './items.store.js';

@Global()
@Module({
  providers: [
    {
      provide: ITEMS_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgItemsStore(db) : new MemoryItemsStore()),
    },
    ItemsService,
  ],
  exports: [ItemsService],
})
export class ItemsModule {}

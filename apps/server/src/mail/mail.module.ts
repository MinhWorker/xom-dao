import { Global, Module } from '@nestjs/common';
import { DB, type Db } from '../db/db.module.js';
import { MAIL_STORE, MailService } from './mail.service.js';
import { MemoryMailStore, PgMailStore } from './mail.store.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_STORE,
      inject: [DB],
      useFactory: (db: Db | null) => (db ? new PgMailStore(db) : new MemoryMailStore()),
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}

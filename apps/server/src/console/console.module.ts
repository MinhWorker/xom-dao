import { Module } from '@nestjs/common';
import {
  ConsoleAuthController,
  ConsoleItemsController,
  ConsoleMailController,
  ConsoleUsersController,
} from './console.controller.js';
import { ConsoleGuard } from './console.guard.js';
import { ConsoleAuthService } from './console-auth.service.js';

/**
 * The console (/console, apps/console): an HTTP API under /api/console for whoever answered its
 * question. It owns no table: accounts change through `AccountsService`, items through
 * `ItemsService`, letters through `MailService`.
 */
@Module({
  providers: [ConsoleAuthService, ConsoleGuard],
  controllers: [
    ConsoleAuthController,
    ConsoleUsersController,
    ConsoleItemsController,
    ConsoleMailController,
  ],
})
export class ConsoleModule {}

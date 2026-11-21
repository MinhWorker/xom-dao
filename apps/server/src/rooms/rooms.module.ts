import { Module } from '@nestjs/common';
import { devModeProvider } from '../dev/dev-mode.js';
import { GameHostModule } from '../game-host/game-host.module.js';
import { RoomsGateway } from './rooms.gateway.js';
import { RoomsService } from './rooms.service.js';
import { WsGateway } from './ws.gateway.js';

@Module({
  imports: [GameHostModule],
  providers: [devModeProvider, RoomsService, RoomsGateway, WsGateway],
})
export class RoomsModule {}

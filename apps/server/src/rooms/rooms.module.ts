import { Module } from '@nestjs/common';
import { devModeProvider } from '../dev/dev-mode.js';
import { manifestsProvider } from './manifests.js';
import { RoomsGateway } from './rooms.gateway.js';
import { RoomsService } from './rooms.service.js';
import { WsGateway } from './ws.gateway.js';

@Module({
  providers: [devModeProvider, manifestsProvider, RoomsService, RoomsGateway, WsGateway],
})
export class RoomsModule {}

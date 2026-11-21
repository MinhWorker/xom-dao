import { Module } from '@nestjs/common';
import { GameHostService } from './game-host.service.js';
import { GAME_MANIFESTS, GAME_SERVERS, gameServersProvider, manifestsProvider } from './games.js';

@Module({
  providers: [gameServersProvider, manifestsProvider, GameHostService],
  exports: [GAME_MANIFESTS, GAME_SERVERS, GameHostService],
})
export class GameHostModule {}

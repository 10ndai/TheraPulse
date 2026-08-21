import { Controller, Get } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AppService } from './app.service';
import type { HealthResponse } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Liveness/readiness probe. Must stay @Public — JwtAuthGuard is global, and
   * the Dockerfile HEALTHCHECKs and the post-deploy gate in deploy.yml both
   * require an unauthenticated HTTP 200 here.
   */
  @Public()
  @Get('health')
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }
}

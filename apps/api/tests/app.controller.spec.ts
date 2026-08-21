import { Test, type TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHealth()', () => {
    it('returns status "ok"', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
    });

    it('returns an ISO timestamp string', () => {
      const result = appController.getHealth();
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });

    it('timestamp is close to current time', () => {
      const before = new Date().toISOString();
      const result = appController.getHealth();
      const after = new Date().toISOString();
      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });

    /**
     * JwtAuthGuard is registered globally (APP_GUARD), so without @Public()
     * the health endpoint answers 401. Both Dockerfile HEALTHCHECKs and the
     * post-deploy gate in deploy.yml require HTTP 200 from /api/health.
     */
    it('is marked @Public so unauthenticated probes can reach it', () => {
      const reflector = new Reflector();
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, AppController.prototype.getHealth);
      expect(isPublic).toBe(true);
    });
  });
});

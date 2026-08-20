import { describe, it, expect, beforeEach } from 'vitest';
import { AppService } from '../src/app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(() => {
    service = new AppService();
  });

  it('returns status "ok"', () => {
    const result = service.getHealth();
    expect(result.status).toBe('ok');
  });

  it('returns a valid ISO 8601 timestamp', () => {
    const result = service.getHealth();
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });

  it('timestamp is close to now', () => {
    const before = Date.now();
    const result = service.getHealth();
    const after = Date.now();
    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

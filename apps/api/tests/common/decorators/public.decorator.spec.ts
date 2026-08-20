import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { Public, IS_PUBLIC_KEY } from '../../../src/common/decorators/public.decorator';

describe('@Public() decorator', () => {
  it('sets IS_PUBLIC_KEY metadata to true on a handler', () => {
    class TestController {
      @Public()
      handler() {}
    }

    const reflector = new Reflector();
    const metadata = reflector.get<boolean>(IS_PUBLIC_KEY, TestController.prototype.handler);
    expect(metadata).toBe(true);
  });

  it('exports IS_PUBLIC_KEY as a non-empty string', () => {
    expect(typeof IS_PUBLIC_KEY).toBe('string');
    expect(IS_PUBLIC_KEY.length).toBeGreaterThan(0);
  });
});

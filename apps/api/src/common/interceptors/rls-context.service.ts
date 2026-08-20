import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RlsContext {
  userId: string;
  role: string;
}

/**
 * Carries the per-request RLS user context via AsyncLocalStorage.
 * The PrismaService middleware reads from here to set PostgreSQL session variables.
 */
@Injectable()
export class RlsContextService {
  private readonly storage = new AsyncLocalStorage<RlsContext>();

  run<T>(context: RlsContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  getContext(): RlsContext | undefined {
    return this.storage.getStore();
  }
}

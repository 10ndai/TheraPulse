import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { EncryptionService } from '../modules/encryption/encryption.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { RlsContextService } from '../common/interceptors/rls-context.service';

/**
 * Wraps PrismaClient as a NestJS injectable service.
 * Manages the connection lifecycle via OnModuleInit / OnModuleDestroy.
 *
 * Uses Prisma $extends to transparently handle two cross-cutting concerns on
 * every model operation:
 *   1. Per-request RLS session variables (app.user_id, app.user_role)
 *   2. AES-256-GCM field-level encryption on writes / decryption on reads
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly encryption: EncryptionService,
    private readonly rlsContext: RlsContextService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();

    const encryption = this.encryption;
    const rlsContext = this.rlsContext;
    // Bind to the base client so the RLS raw query is never re-intercepted.
    // $executeRawUnsafe is not a model operation and is unaffected by
    // $allModels.$allOperations, but binding early makes the intent explicit.
    const executeRaw = this.$executeRawUnsafe.bind(this);

    const extended = (this as unknown as PrismaClient).$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // 1. Set PostgreSQL session variables for row-level security.
            const ctx = rlsContext.getContext();
            if (ctx) {
              await executeRaw(
                `SELECT set_config('app.user_id', $1, true), set_config('app.user_role', $2, true)`,
                ctx.userId,
                ctx.role,
              );
            }

            // 2. Encrypt designated fields before the write reaches the database.
            encryption.processWriteArgs(
              model,
              operation,
              args as unknown as Record<string, unknown>,
            );

            // 3. Execute the query with the (possibly-mutated) args.
            const result = await query(args);

            // 4. Decrypt designated fields before returning to the caller.
            return encryption.processReadResult(model, result);
          },
        },
      },
    });

    // Merge the extended client's model accessors onto this instance so callers
    // that already hold a reference to this PrismaService receive the
    // intercepted versions of all model operations.
    Object.assign(this, extended);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

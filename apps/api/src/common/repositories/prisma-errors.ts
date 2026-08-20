import { NotFoundException } from '@nestjs/common';

/**
 * Translates Prisma P2025 "Record not found" errors into NestJS NotFoundException.
 * All other errors are re-thrown unchanged.
 */
export function handlePrismaNotFound(err: unknown, resourceName: string): never {
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as Record<string, unknown>)['code'] === 'P2025'
  ) {
    throw new NotFoundException(`${resourceName} not found`);
  }
  throw err;
}

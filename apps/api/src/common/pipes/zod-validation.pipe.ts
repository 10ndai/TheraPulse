import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * NestJS pipe that validates and transforms the incoming value against a Zod schema.
 *
 * Usage (per-handler):
 *   @Body(new ZodValidationPipe(createUserSchema)) body: CreateUserDto
 *
 * On failure, throws BadRequestException with the standard error envelope:
 *   { success: false, error: { code: 'VALIDATION_ERROR', message, details } }
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: result.error.issues,
        },
      });
    }

    return result.data;
  }
}

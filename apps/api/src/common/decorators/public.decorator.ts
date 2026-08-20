import { SetMetadata } from '@nestjs/common';

/** Metadata key used by JwtAuthGuard to skip token verification on public routes. */
export const IS_PUBLIC_KEY = 'is_public';

/**
 * Marks a route handler (or entire controller) as publicly accessible.
 * JwtAuthGuard will skip token verification for any handler decorated with @Public().
 *
 * @example
 * \@Public()
 * \@Post('login')
 * login(@Body() dto: LoginDto) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

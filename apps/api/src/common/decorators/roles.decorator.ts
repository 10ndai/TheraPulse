import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

/** Metadata key used by RolesGuard to read required roles from a handler or controller. */
export const ROLES_KEY = 'roles';

/**
 * Restricts a route handler (or entire controller) to users with one of the specified roles.
 * RolesGuard reads this metadata and throws ForbiddenException for non-matching roles.
 * Must be used alongside JwtAuthGuard (which populates request.user).
 *
 * @example
 * \@Roles(UserRole.ADMIN)
 * \@Get('admin/users')
 * listUsers() { ... }
 *
 * \@Roles(UserRole.THERAPIST, UserRole.ADMIN)
 * \@Get('sessions')
 * listSessions() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

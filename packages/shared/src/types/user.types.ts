import type { UserRoleType } from '../constants/roles';
import type { UserStatusValue, ApprovalStatusValue } from '../constants/enums';

/**
 * A user object safe to send over the wire — no passwordHash, no totpSecret.
 * Dates are serialised as ISO strings in JSON.
 */
export interface SafeUser {
  readonly id: string;
  readonly email: string;
  readonly role: UserRoleType;
  readonly status: UserStatusValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Approved therapist profile as returned by the public directory API.
 * Only ever contains APPROVED profiles.
 */
export interface TherapistProfileSummary {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly bio: string | null;
  readonly specializations: readonly string[];
  readonly qualifications: readonly string[];
  readonly languages: readonly string[];
  readonly city: string | null;
  readonly province: string | null;
  readonly approvalStatus: ApprovalStatusValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const UserRole = {
  ADMIN: 'ADMIN',
  THERAPIST: 'THERAPIST',
  CLIENT: 'CLIENT',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

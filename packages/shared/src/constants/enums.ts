// Shared enum constants — mirror the Prisma enums but live in packages/shared
// so both frontend and backend can import them without depending on @prisma/client.

export const WorksheetType = {
  PHQ9: 'PHQ9',
  GAD7: 'GAD7',
  MOOD_TRACKING: 'MOOD_TRACKING',
  CBT_THOUGHT_RECORD: 'CBT_THOUGHT_RECORD',
  GOAL_SETTING: 'GOAL_SETTING',
  CUSTOM: 'CUSTOM',
} as const;

export type WorksheetTypeValue = (typeof WorksheetType)[keyof typeof WorksheetType];

export const AssignmentStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
} as const;

export type AssignmentStatusValue = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const NoteStatus = {
  DRAFT: 'DRAFT',
  FINALIZED: 'FINALIZED',
} as const;

export type NoteStatusValue = (typeof NoteStatus)[keyof typeof NoteStatus];

export const RelationshipStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  TERMINATED: 'TERMINATED',
} as const;

export type RelationshipStatusValue = (typeof RelationshipStatus)[keyof typeof RelationshipStatus];

export const ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ApprovalStatusValue = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
} as const;

export type UserStatusValue = (typeof UserStatus)[keyof typeof UserStatus];

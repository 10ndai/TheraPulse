export const APP_NAME = 'TheraPulse' as const;

export const TOKEN_EXPIRY = {
  ACCESS_MS: 15 * 60 * 1000,
  REFRESH_DAYS: 7,
} as const;

export const PASSWORD_RULES = {
  MIN_LENGTH: 12,
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

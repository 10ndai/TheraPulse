import type { PaginationMeta, ApiSuccessResponse, ApiErrorResponse } from '../types/api.types';

/**
 * Creates a successful API response envelope.
 */
export function successResponse<T>(data: T, meta?: PaginationMeta): ApiSuccessResponse<T> {
  return meta !== undefined ? { success: true, data, meta } : { success: true, data };
}

/**
 * Creates an error API response envelope.
 */
export function errorResponse(code: string, message: string, details?: unknown): ApiErrorResponse {
  return details !== undefined
    ? { success: false, error: { code, message, details } }
    : { success: false, error: { code, message } };
}

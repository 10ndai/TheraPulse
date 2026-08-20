import { z } from 'zod';
import { PAGINATION_DEFAULTS } from '../constants/app.constants';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(PAGINATION_DEFAULTS.PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(PAGINATION_DEFAULTS.MAX_LIMIT, `Limit cannot exceed ${PAGINATION_DEFAULTS.MAX_LIMIT}`)
    .default(PAGINATION_DEFAULTS.LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

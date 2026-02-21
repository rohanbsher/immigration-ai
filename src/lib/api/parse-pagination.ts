import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function parsePaginationParams(searchParams: URLSearchParams) {
  const raw = {
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  };
  const result = paginationSchema.safeParse(raw);
  if (!result.success) {
    return { page: 1, limit: 20, offset: 0 };
  }
  const { page, limit } = result.data;
  return { page, limit, offset: (page - 1) * limit };
}

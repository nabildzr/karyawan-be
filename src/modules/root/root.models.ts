import { t } from "elysia";

// Pagination query options
export const paginationOptions = {
  page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Numeric({ default: 25, minimum: 1, maximum: 100 })),
  sortBy: t.Optional(t.String({ default: "createdAt" })),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  search: t.Optional(t.String()),
  searchField: t.Optional(t.String()),
};

// Base response model
export const BaseResponseDTO = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
});

// Paginated response model
export const PaginatedResponseDTO = t.Object({
  success: t.Boolean(),
  data: t.Array(t.Any()),
  meta: t.Object({
    total: t.Number(),
    count: t.Number(),
    page: t.Number(),
  }),
});

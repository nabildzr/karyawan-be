// * Backend module schema: src/modules/root/root.schema.ts
// & This file defines DTO schemas and TypeScript types for the root module.
// % File ini mendefinisikan schema DTO dan tipe TypeScript untuk module root.

import { t } from "elysia";

/** Mengekspor paginationOptions untuk kebutuhan kompatibilitas modul ini. */
export const paginationOptions = {
  page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Numeric({ default: 25, minimum: 1, maximum: 100 })),
  sortBy: t.Optional(t.String({ default: "createdAt" })),
  sortOrder: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  search: t.Optional(t.String()),
  searchField: t.Optional(t.String()),
};

/** Mengekspor BaseResponseDTO untuk kebutuhan kompatibilitas modul ini. */
export const BaseResponseDTO = t.Object({
  success: t.Boolean(),
  message: t.Optional(t.String()),
});

/** Mengekspor PaginatedResponseDTO untuk kebutuhan kompatibilitas modul ini. */
export const PaginatedResponseDTO = t.Object({
  success: t.Boolean(),
  data: t.Array(t.Any()),
  meta: t.Object({
    total: t.Number(),
    count: t.Number(),
    page: t.Number(),
  }),
});

/** Mengekspor RootInfoDTO untuk kebutuhan modul ini. */
export const RootInfoDTO = t.Object({
  name: t.String(),
  version: t.String(),
  status: t.Literal("running"),
  timestamp: t.String(),
});

/** Mengekspor HealthStatusDTO untuk kebutuhan modul ini. */
export const HealthStatusDTO = t.Object({
  status: t.Literal("healthy"),
  uptime: t.Number(),
  timestamp: t.String(),
});

/** Mendefinisikan alias tipe untuk RootInfoPayload. */
export type RootInfoPayload = typeof RootInfoDTO.static;

/** Mendefinisikan alias tipe untuk HealthStatusPayload. */
export type HealthStatusPayload = typeof HealthStatusDTO.static;

/** Mendefinisikan alias tipe untuk BaseResponsePayload. */
export type BaseResponsePayload = typeof BaseResponseDTO.static;

/** Mendefinisikan alias tipe untuk PaginatedResponsePayload. */
export type PaginatedResponsePayload = typeof PaginatedResponseDTO.static;
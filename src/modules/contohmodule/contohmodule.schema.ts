// * Backend module schema: src/modules/contohmodule/contohmodule.schema.ts
// & This file defines DTO schemas and TypeScript types for contohmodule.
// % File ini mendefinisikan schema DTO dan tipe TypeScript untuk module contohmodule.

import { t } from "elysia";

/** Mengekspor ContohQueryDTO untuk kebutuhan modul ini. */
export const ContohQueryDTO = t.Object({
  page: t.Optional(t.Numeric({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Numeric({ default: 10, minimum: 1, maximum: 100 })),
  search: t.Optional(t.String({ description: "Cari data contoh" })),
});

/** Mengekspor ContohItemDTO untuk kebutuhan modul ini. */
export const ContohItemDTO = t.Object({
  id: t.String(),
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  isActive: t.Boolean(),
  createdAt: t.String(),
});

/** Mengekspor ContohListMetaDTO untuk kebutuhan modul ini. */
export const ContohListMetaDTO = t.Object({
  page: t.Number(),
  limit: t.Number(),
  total: t.Number(),
  totalPages: t.Number(),
});

/** Mengekspor ContohListResponseDTO untuk kebutuhan modul ini. */
export const ContohListResponseDTO = t.Object({
  data: t.Array(ContohItemDTO),
  meta: ContohListMetaDTO,
});

/** Mendefinisikan alias tipe untuk ContohQueryPayload. */
export type ContohQueryPayload = typeof ContohQueryDTO.static;

/** Mendefinisikan alias tipe untuk ContohItemPayload. */
export type ContohItemPayload = typeof ContohItemDTO.static;

/** Mendefinisikan alias tipe untuk ContohListMetaPayload. */
export type ContohListMetaPayload = typeof ContohListMetaDTO.static;

/** Mendefinisikan alias tipe untuk ContohListResponsePayload. */
export type ContohListResponsePayload = typeof ContohListResponseDTO.static;
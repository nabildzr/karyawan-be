// * Backend module model: src/modules/rekap/model.ts
// & This file defines DTO schemas and TypeScript types for rekap module.
// % File ini mendefinisikan schema DTO dan tipe TypeScript untuk module rekap.

import { t } from "elysia";

/** Mengekspor RekapQueryDTO untuk kebutuhan modul ini. */
export const RekapQueryDTO = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 10 })),
  search: t.Optional(t.String()),
});

/** Mendefinisikan alias tipe untuk RekapQueryPayload. */
export type RekapQueryPayload = typeof RekapQueryDTO.static;

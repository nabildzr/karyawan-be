// * Backend module: karyawan-be/src/modules/contohmodule/model.ts
// & This file defines DTO schema and TypeScript types for contohmodule.
// % File ini mendefinisikan schema DTO dan tipe TypeScript untuk contohmodule.

import { t } from "elysia";

// & ============ DTO Schemas ============

export const CreateContohDTO = t.Object({
  name: t.String({ minLength: 1, description: "Nama contoh data" }),
  description: t.Optional(t.String({ description: "Deskripsi opsional" })),
  isActive: t.Optional(t.Boolean({ default: true })),
});

export const UpdateContohDTO = t.Partial(CreateContohDTO);

export const ContohQueryDTO = t.Object({
  page: t.Optional(t.Number({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 100 })),
  search: t.Optional(t.String({ description: "Cari by nama" })),
});

// & ============ TypeScript Types (single source of truth dari schema) ============

export type CreateContohPayload = typeof CreateContohDTO.static;
export type UpdateContohPayload = typeof UpdateContohDTO.static;
export type ContohQueryPayload = typeof ContohQueryDTO.static;

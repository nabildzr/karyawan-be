// * Backend module service: src/modules/contohmodule/contohmodule.service.ts
// & This file provides business logic for contohmodule.
// % File ini menyediakan business logic untuk module contohmodule.

import { findContohList } from "./contohmodule.repository";
import type {
    ContohListResponsePayload,
    ContohQueryPayload,
} from "./contohmodule.schema";

/** Mengambil daftar contoh dan membentuk metadata pagination. */
export async function getContohList(
  query: ContohQueryPayload,
): Promise<ContohListResponsePayload> {
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit ?? 10))));
  const search = query.search?.trim() || undefined;
  const result = await findContohList({ page, limit, search });

  return {
    data: result.items,
    meta: {
      page,
      limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    },
  };
}
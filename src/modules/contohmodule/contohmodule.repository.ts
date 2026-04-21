// * Backend module repository: src/modules/contohmodule/contohmodule.repository.ts
// & This file provides data access for contohmodule.
// % File ini menyediakan akses data untuk module contohmodule.

import type { ContohItemPayload, ContohQueryPayload } from "./contohmodule.schema";

/** Menyimpan hasil pencarian contoh dari sumber data. */
export type ContohListResult = {
  items: ContohItemPayload[];
  total: number;
};

/** Mengambil daftar contoh dari sumber data. */
export async function findContohList(
  _query: ContohQueryPayload,
): Promise<ContohListResult> {
  return {
    items: [],
    total: 0,
  };
}
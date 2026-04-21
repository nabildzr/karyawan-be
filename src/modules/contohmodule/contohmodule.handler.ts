// * Backend module handler: src/modules/contohmodule/contohmodule.handler.ts
// & This file adapts request context into service calls for contohmodule.
// % File ini mengubah context request menjadi pemanggilan service untuk module contohmodule.

import type { ContohQueryPayload } from "./contohmodule.schema";
import { getContohList } from "./contohmodule.service";

/** Mengambil daftar contoh dari konteks request. */
export async function handleGetContohList({
  query,
}: {
  query: ContohQueryPayload;
}) {
  return getContohList(query);
}
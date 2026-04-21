// * File ini menangani validasi bisnis untuk module rbac.

import prisma from "../../../config/prisma";

// & Placeholder validation to mark repository abstraction usage.
// % Placeholder validasi untuk menandai penggunaan abstraction repository.
/**
 * Menjalankan tanggung jawab utama fungsi validateRbacRequest.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function validateRbacRequest() {
  return Boolean(prisma);
}

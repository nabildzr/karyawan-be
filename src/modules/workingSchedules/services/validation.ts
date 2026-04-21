// * File ini menangani validasi bisnis untuk module working schedules.

import prisma from "../../../config/prisma";

// & Placeholder validation to mark repository abstraction usage.
// % Placeholder validasi untuk menandai penggunaan abstraction repository.
/**
 * Menjalankan tanggung jawab utama fungsi validateWorkingScheduleRequest.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function validateWorkingScheduleRequest() {
  return Boolean(prisma);
}

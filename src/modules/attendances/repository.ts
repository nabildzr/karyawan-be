// * Repository ini menjadi lapisan akses data untuk module attendances.

import prisma from "../../config/prisma";

export const AttendanceRepository = {
  // & Expose prisma client for attendances repository migration.
  // % Ekspos prisma client untuk migrasi repository attendances.
  getClient() {
    return prisma;
  },
};

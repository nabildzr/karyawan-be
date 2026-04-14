// * Repository ini menjadi lapisan akses data untuk module working schedules.

import prisma from "../../config/prisma";

export const WorkingScheduleRepository = {
  // & Expose prisma client for working schedule repository migration.
  // % Ekspos prisma client untuk migrasi repository jadwal kerja.
  getClient() {
    return prisma;
  },
};

// * Repository ini menjadi lapisan akses data untuk module assessments.

import prisma from "../../config/prisma";

export const AssessmentsRepository = {
  // & Expose prisma client for assessments repository migration.
  // % Ekspos prisma client untuk migrasi repository assessments.
  getClient() {
    return prisma;
  },
};

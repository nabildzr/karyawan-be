// * Repository ini menjadi lapisan akses data untuk module submissions.

import prisma from "../../config/prisma";

export const SubmissionRepository = {
  // & Expose prisma client for submissions repository migration.
  // % Ekspos prisma client untuk migrasi repository submissions.
  getClient() {
    return prisma;
  },
};

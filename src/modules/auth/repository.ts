// * Repository ini menjadi lapisan akses data untuk module auth.

import prisma from "../../config/prisma";

export const AuthRepository = {
  // & Expose prisma client for auth repository migration.
  // % Ekspos prisma client untuk migrasi repository auth.
  getClient() {
    return prisma;
  },
};

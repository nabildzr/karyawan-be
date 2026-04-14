// * Repository ini menjadi lapisan akses data untuk module rbac.

import prisma from "../../config/prisma";

export const RbacRepository = {
  // & Expose prisma client for RBAC repository migration.
  // % Ekspos prisma client untuk migrasi repository RBAC.
  getClient() {
    return prisma;
  },
};

// * File ini berisi repository (akses DB) untuk modul helpdesk (ticketing).

import prisma from "../../config/prisma";

/** Singleton Prisma instance untuk modul helpdesk. */
export const HelpdeskRepository = {
  db: prisma,
} as const;

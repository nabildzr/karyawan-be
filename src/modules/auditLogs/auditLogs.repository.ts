import prisma from "../../config/prisma";
import type { AuditLogs, Prisma } from "../../generated/prisma/client";

/** Mengambil daftar audit log mentah berdasarkan filter dan paginasi. */
export async function findAuditLogs(params: {
  where: Prisma.AuditLogsWhereInput;
  skip: number;
  take: number;
}): Promise<AuditLogs[]> {
  return prisma.auditLogs.findMany({
    where: params.where,
    orderBy: { createdAt: "desc" },
    skip: params.skip,
    take: params.take,
  });
}

/** Menghitung total audit log mentah berdasarkan filter. */
export async function countAuditLogs(
  where: Prisma.AuditLogsWhereInput,
): Promise<number> {
  return prisma.auditLogs.count({ where });
}

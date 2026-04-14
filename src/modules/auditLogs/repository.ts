// * Repository ini menjadi lapisan akses database untuk module audit logs.

import prisma from "../../config/prisma";

export const AuditLogRepository = {
  // & Find paginated audit logs sorted by newest first.
  // % Ambil audit log paginasi urut terbaru terlebih dahulu.
  async findAuditLogs(params: { where: any; skip: number; take: number }) {
    return prisma.auditLogs.findMany({
      where: params.where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  // & Count audit logs by where filter.
  // % Hitung total audit log berdasarkan filter where.
  async countAuditLogs(where: any) {
    return prisma.auditLogs.count({ where });
  },
};

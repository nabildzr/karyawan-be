// * File ini menangani operasi baca/report untuk module audit logs.

import { AuditLogRepository } from "../repository";

// & Get paginated audit log records with optional search.
// % Ambil record audit log paginasi dengan pencarian opsional.
export async function getAll({
  page = 1,
  limit = 10,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
} = {}) {
  const skip = (page - 1) * limit;
  const keyword = search?.trim();

  const where = keyword
    ? {
        OR: [
          { action: { contains: keyword, mode: "insensitive" as const } },
          { entity: { contains: keyword, mode: "insensitive" as const } },
          { entityId: { contains: keyword, mode: "insensitive" as const } },
          { userId: { contains: keyword, mode: "insensitive" as const } },
          { userRole: { contains: keyword, mode: "insensitive" as const } },
          { reason: { contains: keyword, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    AuditLogRepository.findAuditLogs({ where, skip, take: limit }),
    AuditLogRepository.countAuditLogs(where),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

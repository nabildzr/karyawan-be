import type { AuditLogs, Prisma } from "../../generated/prisma/client";
import { countAuditLogs, findAuditLogs } from "./auditLogs.repository";
import type {
  AuditLogItemPayload,
  AuditLogListQueryPayload,
} from "./auditLogs.schema";

type AuditLogListResultPayload = {
  data: AuditLogItemPayload[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

/** Menormalisasi parameter query agar aman dipakai sebagai paginasi. */
function normalizeAuditLogListQuery(query: AuditLogListQueryPayload) {
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit ?? 10))));
  const search = query.search?.trim() || undefined;

  return { page, limit, search };
}

/** Membentuk filter pencarian audit log dari keyword query. */
function buildAuditLogWhere(search?: string): Prisma.AuditLogsWhereInput {
  if (!search) return {};

  return {
    OR: [
      { action: { contains: search, mode: "insensitive" } },
      { entity: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { userId: { contains: search, mode: "insensitive" } },
      { userRole: { contains: search, mode: "insensitive" } },
      { reason: { contains: search, mode: "insensitive" } },
    ],
  };
}

/** Memetakan data audit log mentah ke payload response endpoint. */
function mapAuditLogItem(record: AuditLogs): AuditLogItemPayload {
  return {
    id: record.id,
    action: record.action,
    entity: record.entity,
    entityId: record.entityId,
    userId: record.userId,
    userRole: record.userRole,
    changes: record.changes,
    reason: record.reason,
    createdAt: record.createdAt.toISOString(),
  };
}

/** Mengambil daftar audit log terpaginasikan beserta metadata. */
async function getAuditLogList(
  query: AuditLogListQueryPayload,
): Promise<AuditLogListResultPayload> {
  const { page, limit, search } = normalizeAuditLogListQuery(query);
  const where = buildAuditLogWhere(search);
  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    findAuditLogs({ where, skip, take: limit }),
    countAuditLogs(where),
  ]);

  return {
    data: records.map(mapAuditLogItem),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Mengekspor AuditLogService untuk kebutuhan modul ini. */
export const AuditLogService = {
  getAuditLogList,
};

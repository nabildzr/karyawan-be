import { t } from "elysia";

/** Mengekspor AuditLogListQueryDTO untuk kebutuhan modul ini. */
export const AuditLogListQueryDTO = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
  search: t.Optional(t.String()),
});

/** Mengekspor AuditLogItemDTO untuk kebutuhan modul ini. */
export const AuditLogItemDTO = t.Object({
  id: t.String(),
  action: t.String(),
  entity: t.String(),
  entityId: t.String(),
  userId: t.String(),
  userRole: t.String(),
  changes: t.Any(),
  reason: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
});

/** Mengekspor AuditLogListMetaDTO untuk kebutuhan modul ini. */
export const AuditLogListMetaDTO = t.Object({
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
  totalPages: t.Number(),
});

/** Mengekspor AuditLogListResponseDTO untuk kebutuhan modul ini. */
export const AuditLogListResponseDTO = t.Object({
  success: t.Boolean(),
  data: t.Array(AuditLogItemDTO),
  message: t.String(),
  error: t.Union([t.String(), t.Null()]),
  meta: AuditLogListMetaDTO,
});

/** Mendefinisikan alias tipe untuk AuditLogListQueryPayload. */
export type AuditLogListQueryPayload = typeof AuditLogListQueryDTO.static;

/** Mendefinisikan alias tipe untuk AuditLogItemPayload. */
export type AuditLogItemPayload = typeof AuditLogItemDTO.static;

/** Mendefinisikan alias tipe untuk AuditLogListResponsePayload. */
export type AuditLogListResponsePayload =
  typeof AuditLogListResponseDTO.static;

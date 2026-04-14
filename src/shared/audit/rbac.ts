// * File shared audit: rbac.ts
// & This wrapper writes audit log entries scoped to RBAC entity.
// % Wrapper ini menulis audit log yang diskop ke entity RBAC.
import { AuditActor } from "./actor";
import { writeAuditLog as writeBaseAuditLog } from "./writeAudit";

// & Persist RBAC-specific audit action by delegating to base writer.
// % Simpan aksi audit khusus RBAC dengan mendelegasikan ke penulis dasar.
export async function writeAuditLog(params: {
  actor: AuditActor;
  action: string;
  entityId: string;
  changes: Record<string, unknown>;
  reason?: string;
  db?: {
    auditLogs: {
      create: (args: any) => Promise<any>;
    };
  };
}) {
  await writeBaseAuditLog({
    actor: params.actor,
    action: params.action,
    entity: "RBAC",
    entityId: params.entityId,
    changes: params.changes,
    reason: params.reason,
    db: params.db,
  });
}
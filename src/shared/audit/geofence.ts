// * File shared audit: geofence.ts
// & This wrapper writes audit log entries scoped to Geofences entity.
// % Wrapper ini menulis audit log yang diskop ke entity Geofences.
import { AuditActor } from "./actor";
import { writeAuditLog as writeBaseAuditLog } from "./writeAudit";

// & Persist geofence-specific audit action by delegating to base writer.
// % Simpan aksi audit khusus geofence dengan mendelegasikan ke penulis dasar.
/**
 * Menjalankan tanggung jawab utama fungsi writeAuditLog.
 * @param params Parameter yang digunakan dalam proses ini.
 */
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
    entity: "Geofences",
    entityId: params.entityId,
    changes: params.changes,
    reason: params.reason,
    db: params.db,
  });
}
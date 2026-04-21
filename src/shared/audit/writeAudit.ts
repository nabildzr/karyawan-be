// * File shared audit: writeAudit.ts
// & This module provides the base audit log persistence implementation.
// % Modul ini menyediakan implementasi dasar penyimpanan audit log.
import prisma from "../../config/prisma";
import { AuditActor } from "./actor";

type AuditDbClient = {
  auditLogs: {
    create: (args: any) => Promise<any>;
  };
};

// & Write audit log row with optional db override for testability.
// % Tulis baris audit log dengan override db opsional agar mudah dites.
/**
 * Menjalankan tanggung jawab utama fungsi writeAuditLog.
 * @param params Parameter yang digunakan dalam proses ini.
 */
export async function writeAuditLog(params: {
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string;
  changes: Record<string, unknown>;
  reason?: string;
  db?: AuditDbClient;
}) {
  // & Use injected db client when provided; fallback to shared Prisma client.
  // % Gunakan db client injeksi jika ada; fallback ke Prisma client bersama.
  const db = params.db ?? (prisma as unknown as AuditDbClient);

  await db.auditLogs.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      userId: params.actor.id,
      userRole: params.actor.role,
      changes: params.changes as any,
      reason: params.reason ?? null,
    },
  });
}

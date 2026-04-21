// * File shared audit: actor.ts
// & This module resolves canonical actor identity for audit log records.
// % Modul ini menentukan identitas aktor kanonis untuk record audit log.
/** Mendefinisikan alias tipe untuk AuditActor. */
export type AuditActor = {
  id: string;
  role: string;
};

type AuthLike = {
  sub?: string | null;
  rbacRoleKey?: string | null;
  role?: string | null;
} | null | undefined;

// & Resolve actor id/role from auth payload and enforce authenticated subject.
// % Ambil id/role aktor dari payload auth dan pastikan subject sudah terautentikasi.
/**
 * Menjalankan tanggung jawab utama fungsi resolveAuditActor.
 * @param auth Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function resolveAuditActor(auth: AuthLike): AuditActor {
  if (!auth?.sub) {
    throw new Error("Unauthorized: Token diperlukan untuk mencatat audit log.");
  }

  // & Prefer RBAC role key, then generic role, then SYSTEM fallback.
  // % Prioritaskan key role RBAC, lalu role umum, lalu fallback SYSTEM.
  return {
    id: auth.sub,
    role: auth.rbacRoleKey ?? auth.role ?? "SYSTEM",
  };
}
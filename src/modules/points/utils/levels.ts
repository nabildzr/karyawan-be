// * Integrity level utility: src/modules/points/utils/levels.ts
// & Shared static map for level threshold calculations.
// % Peta statis bersama untuk kalkulasi ambang level.

// & Define minimum point threshold for each integrity level.
// % Tentukan ambang minimal poin untuk setiap level integritas.
/** Mengekspor INTEGRITY_THRESHOLDS untuk kebutuhan modul ini. */
export const INTEGRITY_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 1000,
  PLATINUM: 2000,
} as const;

/** Mendefinisikan alias tipe untuk IntegrityLevelKey. */
export type IntegrityLevelKey = keyof typeof INTEGRITY_THRESHOLDS;

// & Resolve integrity level key from current point balance.
// % Tentukan key level integritas dari saldo poin saat ini.
/**
 * Menjalankan tanggung jawab utama fungsi getIntegrityLevel.
 * @param points Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function getIntegrityLevel(points: number): IntegrityLevelKey {
  if (points >= INTEGRITY_THRESHOLDS.PLATINUM) return "PLATINUM";
  if (points >= INTEGRITY_THRESHOLDS.GOLD) return "GOLD";
  if (points >= INTEGRITY_THRESHOLDS.SILVER) return "SILVER";
  return "BRONZE";
}

// & Resolve next target level from current level.
// % Tentukan level target berikutnya dari level saat ini.
/**
 * Menjalankan tanggung jawab utama fungsi getNextIntegrityLevel.
 * @param level Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function getNextIntegrityLevel(level: IntegrityLevelKey): IntegrityLevelKey {
  if (level === "PLATINUM") return "PLATINUM";
  if (level === "GOLD") return "PLATINUM";
  if (level === "SILVER") return "GOLD";
  return "SILVER";
}

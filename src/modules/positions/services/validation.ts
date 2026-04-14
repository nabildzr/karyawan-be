// * File ini menangani validasi bisnis untuk module positions.

import { PositionRepository } from "../repository";

// & Ensure position exists for mutation flow.
// % Pastikan posisi ada untuk alur mutasi.
export async function ensurePositionExists(id: string) {
  const position = await PositionRepository.findPlainPositionById(id);

  if (!position) {
    throw new Error("Not Found: Posisi dengan ID tersebut tidak ditemukan.");
  }

  return position;
}

// & Ensure position name is unique on create.
// % Pastikan nama posisi unik saat create.
export async function ensurePositionNameUnique(name: string) {
  const existing = await PositionRepository.findPositionByName(name);

  if (existing) {
    throw new Error("Conflict: Posisi dengan nama tersebut sudah ada.");
  }
}

// & Ensure position name is unique on update.
// % Pastikan nama posisi unik saat update.
export async function ensurePositionNameUniqueForUpdate(
  name: string,
  currentPositionId: string,
) {
  const conflict = await PositionRepository.findPositionByNameExcludeId(
    name,
    currentPositionId,
  );

  if (conflict) {
    throw new Error("Conflict: Posisi dengan nama tersebut sudah ada.");
  }
}

// & Ensure division exists when division id is provided.
// % Pastikan divisi ada saat division id dikirim.
export async function ensureDivisionExists(divisionId?: string | null) {
  if (!divisionId) return;

  const division = await PositionRepository.findDivisionById(divisionId);

  if (!division) {
    throw new Error("Not Found: Divisi dengan ID tersebut tidak ditemukan.");
  }
}

// & Ensure position can be deleted when not used by employees.
// % Pastikan posisi boleh dihapus saat tidak dipakai karyawan.
export async function ensurePositionCanBeDeleted(id: string) {
  const employeeCount = await PositionRepository.countEmployeesByPositionId(id);

  if (employeeCount > 0) {
    throw new Error(
      `Bad Request: Posisi tidak dapat dihapus karena masih digunakan oleh ${employeeCount} karyawan.`,
    );
  }
}

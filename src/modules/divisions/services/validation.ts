// * File ini menangani validasi bisnis untuk module divisions.

import { DivisionRepository } from "../repository";

// & Ensure division exists for mutation flow.
// % Pastikan divisi ada untuk alur mutasi.
export async function ensureDivisionExists(id: string) {
  const division = await DivisionRepository.findPlainDivisionById(id);

  if (!division) {
    throw new Error("Not Found: Divisi dengan ID tersebut tidak ditemukan.");
  }

  return division;
}

// & Ensure division name is unique when creating new data.
// % Pastikan nama divisi unik saat membuat data baru.
export async function ensureDivisionNameUnique(name: string) {
  const existing = await DivisionRepository.findDivisionByName(name);

  if (existing) {
    throw new Error("Conflict: Divisi dengan nama tersebut sudah ada.");
  }
}

// & Ensure division name is unique when updating data.
// % Pastikan nama divisi unik saat mengubah data.
export async function ensureDivisionNameUniqueForUpdate(
  name: string,
  currentDivisionId: string,
) {
  const conflict = await DivisionRepository.findDivisionByNameExcludeId(
    name,
    currentDivisionId,
  );

  if (conflict) {
    throw new Error("Conflict: Divisi dengan nama tersebut sudah ada.");
  }
}

// & Ensure manager user exists when managerId is provided.
// % Pastikan user manager ada saat managerId dikirim.
export async function ensureManagerExists(managerId?: string | null) {
  if (!managerId) return;

  const manager = await DivisionRepository.findManagerById(managerId);

  if (!manager) {
    throw new Error("Not Found: User manager dengan ID tersebut tidak ditemukan.");
  }
}

// & Ensure division can be deleted when there are no positions.
// % Pastikan divisi boleh dihapus ketika tidak punya posisi.
export async function ensureDivisionCanBeDeleted(id: string) {
  const positionCount = await DivisionRepository.countPositionsByDivisionId(id);

  if (positionCount > 0) {
    throw new Error(
      `Bad Request: Divisi tidak dapat dihapus karena masih memiliki ${positionCount} posisi. Hapus atau pindahkan posisi tersebut terlebih dahulu.`,
    );
  }
}

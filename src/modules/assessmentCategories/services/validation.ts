// * File ini menangani validasi bisnis untuk module assessment categories.

import { AssessmentCategoryRepository } from "../repository";

// & Build category filter from query params.
// % Bentuk filter kategori dari query params.
export function buildCategoryWhere(query: { isActive?: string; type?: string }) {
  const where: any = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === "true";
  }

  if (query.type) {
    where.type = query.type;
  }

  return where;
}

// & Ensure category exists before update/delete.
// % Pastikan kategori ada sebelum update/hapus.
export async function ensureCategoryExists(id: string) {
  const category = await AssessmentCategoryRepository.findCategoryById(id);

  if (!category) {
    throw new Error("Not Found: Kategori penilaian tidak ditemukan.");
  }

  return category;
}

// & Ensure category can be deleted when there is no usage.
// % Pastikan kategori boleh dihapus saat belum dipakai pada penilaian.
export async function ensureCategoryCanBeDeleted(id: string) {
  const usageCount = await AssessmentCategoryRepository.countAssessmentDetailUsage(id);

  if (usageCount > 0) {
    throw new Error(
      `Gagal menghapus: Kategori ini sudah digunakan dalam ${usageCount} data penilaian. Gunakan fitur Nonaktifkan saja (isActive: false).`,
    );
  }
}

// * File ini menangani operasi baca/report untuk module assessment categories.

import { AssessmentCategoryRepository } from "../repository";
import { buildCategoryWhere } from "./validation";

// & Get category list by optional filter.
// % Ambil daftar kategori berdasarkan filter opsional.
export async function findAll(query: { isActive?: string; type?: string }) {
  const where = buildCategoryWhere(query);
  return AssessmentCategoryRepository.findCategories(where);
}

// & Get compact category statistics.
// % Ambil statistik ringkas kategori penilaian.
export async function getStats() {
  const [total, active, inactive, lastUpdated] = await Promise.all([
    AssessmentCategoryRepository.countCategories(),
    AssessmentCategoryRepository.countCategories({ isActive: true }),
    AssessmentCategoryRepository.countCategories({ isActive: false }),
    AssessmentCategoryRepository.findLatestUpdatedCategory(),
  ]);

  return {
    totalCategories: total,
    activeIndicators: active,
    offIndicators: inactive,
    lastUpdate: lastUpdated?.updatedAt ?? null,
  };
}

// * File ini adalah facade orchestrator untuk module assessment categories.

import { create, remove, update } from "./create";
import { findAll, getStats } from "./report";

export const AssessmentCategoryService = {
  // & Get all categories with optional filter.
  // % Ambil semua kategori dengan filter opsional.
  findAll,

  // & Create new category.
  // % Buat kategori baru.
  create,

  // & Update category by id.
  // % Update kategori berdasarkan id.
  update,

  // & Delete category by id.
  // % Hapus kategori berdasarkan id.
  delete: remove,

  // & Get category stats.
  // % Ambil statistik kategori.
  getStats,
};

// * Repository ini menjadi lapisan akses database untuk module assessment categories.

import prisma from "../../config/prisma";

export const AssessmentCategoryRepository = {
  // & Find assessment categories by dynamic filter.
  // % Ambil daftar kategori penilaian berdasarkan filter dinamis.
  async findCategories(where: any) {
    return prisma.assessmentCategories.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  },

  // & Create a new assessment category row.
  // % Buat baris kategori penilaian baru.
  async createCategory(payload: any) {
    return prisma.assessmentCategories.create({ data: payload });
  },

  // & Find assessment category by id.
  // % Cari kategori penilaian berdasarkan id.
  async findCategoryById(id: string) {
    return prisma.assessmentCategories.findUnique({ where: { id } });
  },

  // & Update assessment category by id.
  // % Update kategori penilaian berdasarkan id.
  async updateCategory(id: string, payload: any) {
    return prisma.assessmentCategories.update({
      where: { id },
      data: payload,
    });
  },

  // & Delete assessment category by id.
  // % Hapus kategori penilaian berdasarkan id.
  async deleteCategory(id: string) {
    return prisma.assessmentCategories.delete({ where: { id } });
  },

  // & Count assessment detail usage by category id.
  // % Hitung pemakaian kategori pada data detail penilaian.
  async countAssessmentDetailUsage(id: string) {
    return prisma.assessmentDetails.count({ where: { categoryId: id } });
  },

  // & Count total categories by filter.
  // % Hitung total kategori berdasarkan filter.
  async countCategories(where?: any) {
    return prisma.assessmentCategories.count({ where });
  },

  // & Find latest updated category timestamp.
  // % Ambil waktu update kategori paling akhir.
  async findLatestUpdatedCategory() {
    return prisma.assessmentCategories.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
  },
};

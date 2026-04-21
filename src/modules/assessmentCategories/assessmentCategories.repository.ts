import prisma from "../../config/prisma";
import type {
    AssessmentCategories,
    Prisma,
} from "../../generated/prisma/client";

/** Mengambil daftar kategori penilaian mentah dari database. */
export async function findAssessmentCategories(
  where: Prisma.AssessmentCategoriesWhereInput,
): Promise<AssessmentCategories[]> {
  return prisma.assessmentCategories.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/** Mencari satu kategori penilaian mentah berdasarkan id. */
export async function findAssessmentCategoryById(
  id: string,
): Promise<AssessmentCategories | null> {
  return prisma.assessmentCategories.findUnique({ where: { id } });
}

/** Membuat kategori penilaian mentah baru di database. */
export async function createAssessmentCategory(
  data: Prisma.AssessmentCategoriesUncheckedCreateInput,
): Promise<AssessmentCategories> {
  return prisma.assessmentCategories.create({ data });
}

/** Mengubah kategori penilaian mentah di database. */
export async function updateAssessmentCategory(
  id: string,
  data: Prisma.AssessmentCategoriesUncheckedUpdateInput,
): Promise<AssessmentCategories> {
  return prisma.assessmentCategories.update({
    where: { id },
    data,
  });
}

/** Menghapus kategori penilaian mentah dari database. */
export async function deleteAssessmentCategory(
  id: string,
): Promise<AssessmentCategories> {
  return prisma.assessmentCategories.delete({ where: { id } });
}

/** Menghitung jumlah kategori penilaian mentah berdasarkan filter. */
export async function countAssessmentCategories(
  where?: Prisma.AssessmentCategoriesWhereInput,
): Promise<number> {
  return prisma.assessmentCategories.count({ where });
}

/** Mengambil waktu update terakhir kategori penilaian dari database. */
export async function findLatestAssessmentCategoryUpdate() {
  return prisma.assessmentCategories.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
}

/** Menghitung jumlah pemakaian kategori pada data detail penilaian. */
export async function countAssessmentDetailsByCategoryId(
  categoryId: string,
): Promise<number> {
  return prisma.assessmentDetails.count({ where: { categoryId } });
}

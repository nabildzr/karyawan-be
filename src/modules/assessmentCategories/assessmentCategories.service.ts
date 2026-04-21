import type { JWTPayload } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import {
    countAssessmentCategories,
    countAssessmentDetailsByCategoryId,
    createAssessmentCategory,
    deleteAssessmentCategory,
    findAssessmentCategories,
    findAssessmentCategoryById,
    findLatestAssessmentCategoryUpdate,
    updateAssessmentCategory,
} from "./assessmentCategories.repository";
import type {
    AssessmentCategoryListQueryPayload,
    AssessmentCategoryPayload,
    AssessmentCategoryStatsPayload,
    CreateAssessmentCategoryBodyPayload,
    UpdateAssessmentCategoryBodyPayload,
} from "./assessmentCategories.schema";

type AssessmentCategoryListResultPayload = {
  data: AssessmentCategoryPayload[];
};

/** Menormalisasi hasil kategori mentah menjadi payload response endpoint. */
function toAssessmentCategoryPayload(record: {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  isActive: boolean;
  isVisibleToEmployee: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AssessmentCategoryPayload {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    type: record.type,
    isActive: record.isActive,
    isVisibleToEmployee: record.isVisibleToEmployee,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Membentuk filter query kategori dari query list endpoint. */
function buildAssessmentCategoryWhere(query: AssessmentCategoryListQueryPayload) {
  const where: { isActive?: boolean; type?: string } = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === "true";
  }

  if (query.type) {
    where.type = query.type;
  }

  return where;
}

/** Memastikan kategori ada sebelum dipakai pada proses mutasi. */
async function ensureAssessmentCategoryExists(id: string) {
  const category = await findAssessmentCategoryById(id);

  if (!category) {
    throw new Error("Not Found: Kategori penilaian tidak ditemukan.");
  }

  return category;
}

/** Memastikan kategori aman dihapus karena belum digunakan detail penilaian. */
async function ensureAssessmentCategoryCanBeDeleted(id: string) {
  const usageCount = await countAssessmentDetailsByCategoryId(id);

  if (usageCount > 0) {
    throw new Error(
      `Gagal menghapus: Kategori ini sudah digunakan dalam ${usageCount} data penilaian. Gunakan fitur Nonaktifkan saja (isActive: false).`,
    );
  }
}

/** Mengambil daftar kategori penilaian berdasarkan filter query. */
async function getAssessmentCategoryList(
  query: AssessmentCategoryListQueryPayload,
): Promise<AssessmentCategoryListResultPayload> {
  const records = await findAssessmentCategories(buildAssessmentCategoryWhere(query));

  return {
    data: records.map(toAssessmentCategoryPayload),
  };
}

/** Mengambil statistik ringkas kategori penilaian. */
async function getAssessmentCategoryStats(): Promise<AssessmentCategoryStatsPayload> {
  const [total, active, inactive, lastUpdated] = await Promise.all([
    countAssessmentCategories(),
    countAssessmentCategories({ isActive: true }),
    countAssessmentCategories({ isActive: false }),
    findLatestAssessmentCategoryUpdate(),
  ]);

  const stats: AssessmentCategoryStatsPayload = {
    totalCategories: total,
    activeIndicators: active,
    offIndicators: inactive,
    lastUpdate: lastUpdated?.updatedAt.toISOString() ?? null,
  };

  return stats;
}

/** Membuat kategori penilaian baru lalu mencatat audit log. */
async function createAssessmentCategoryEntry(
  auth: JWTPayload | null,
  body: CreateAssessmentCategoryBodyPayload,
): Promise<AssessmentCategoryPayload> {
  const actor = resolveAuditActor(auth);
  const created = await createAssessmentCategory(body);

  await writeAuditLog({
    actor,
    action: "CREATE_ASSESSMENT_CATEGORY",
    entity: "AssessmentCategories",
    entityId: created.id,
    changes: {
      before: null,
      after: {
        name: created.name,
        description: created.description,
        type: created.type,
        isActive: created.isActive,
        isVisibleToEmployee: created.isVisibleToEmployee,
      },
    },
  });

  return toAssessmentCategoryPayload(created);
}

/** Mengubah kategori penilaian lalu mencatat audit log perubahan. */
async function updateAssessmentCategoryEntry(
  auth: JWTPayload | null,
  id: string,
  body: UpdateAssessmentCategoryBodyPayload,
): Promise<AssessmentCategoryPayload> {
  const actor = resolveAuditActor(auth);
  const before = await ensureAssessmentCategoryExists(id);
  const updated = await updateAssessmentCategory(id, body);

  await writeAuditLog({
    actor,
    action: "UPDATE_ASSESSMENT_CATEGORY",
    entity: "AssessmentCategories",
    entityId: id,
    changes: {
      before: {
        name: before.name,
        description: before.description,
        type: before.type,
        isActive: before.isActive,
        isVisibleToEmployee: before.isVisibleToEmployee,
      },
      after: {
        name: updated.name,
        description: updated.description,
        type: updated.type,
        isActive: updated.isActive,
        isVisibleToEmployee: updated.isVisibleToEmployee,
      },
    },
  });

  return toAssessmentCategoryPayload(updated);
}

/** Menghapus kategori penilaian jika belum dipakai lalu mencatat audit log. */
async function deleteAssessmentCategoryEntry(
  auth: JWTPayload | null,
  id: string,
): Promise<AssessmentCategoryPayload> {
  const actor = resolveAuditActor(auth);
  const before = await ensureAssessmentCategoryExists(id);
  await ensureAssessmentCategoryCanBeDeleted(id);
  const deleted = await deleteAssessmentCategory(id);

  await writeAuditLog({
    actor,
    action: "DELETE_ASSESSMENT_CATEGORY",
    entity: "AssessmentCategories",
    entityId: id,
    changes: {
      before: {
        name: before.name,
        description: before.description,
        type: before.type,
        isActive: before.isActive,
        isVisibleToEmployee: before.isVisibleToEmployee,
      },
      after: null,
    },
  });

  return toAssessmentCategoryPayload(deleted);
}

/** Mengekspor AssessmentCategoryService untuk kebutuhan modul ini. */
export const AssessmentCategoryService = {
  getAssessmentCategoryList,
  getAssessmentCategoryStats,
  createAssessmentCategoryEntry,
  updateAssessmentCategoryEntry,
  deleteAssessmentCategoryEntry,
};

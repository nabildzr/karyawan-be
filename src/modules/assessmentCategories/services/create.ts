// * File ini menangani operasi tulis untuk module assessment categories.

import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { AssessmentCategoryRepository } from "../repository";
import {
    ensureCategoryCanBeDeleted,
    ensureCategoryExists,
} from "./validation";

// & Create assessment category and write audit log.
// % Buat kategori penilaian dan tulis audit log.
export async function create(payload: any, actor: AuditActor) {
  const created = await AssessmentCategoryRepository.createCategory(payload);

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

  return created;
}

// & Update assessment category and write audit log.
// % Update kategori penilaian dan tulis audit log.
export async function update(id: string, payload: any, actor: AuditActor) {
  const existing = await ensureCategoryExists(id);
  const updated = await AssessmentCategoryRepository.updateCategory(id, payload);

  await writeAuditLog({
    actor,
    action: "UPDATE_ASSESSMENT_CATEGORY",
    entity: "AssessmentCategories",
    entityId: id,
    changes: {
      before: {
        name: existing.name,
        description: existing.description,
        type: existing.type,
        isActive: existing.isActive,
        isVisibleToEmployee: existing.isVisibleToEmployee,
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

  return updated;
}

// & Delete assessment category after usage validation and write audit log.
// % Hapus kategori penilaian setelah validasi pemakaian dan tulis audit log.
export async function remove(id: string, actor: AuditActor) {
  const existing = await ensureCategoryExists(id);
  await ensureCategoryCanBeDeleted(id);

  const deleted = await AssessmentCategoryRepository.deleteCategory(id);

  await writeAuditLog({
    actor,
    action: "DELETE_ASSESSMENT_CATEGORY",
    entity: "AssessmentCategories",
    entityId: id,
    changes: {
      before: {
        name: existing.name,
        description: existing.description,
        type: existing.type,
        isActive: existing.isActive,
        isVisibleToEmployee: existing.isVisibleToEmployee,
      },
      after: null,
    },
  });

  return deleted;
}

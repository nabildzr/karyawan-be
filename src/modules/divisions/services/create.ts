// * File ini menangani operasi tulis untuk module divisions.

import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { DivisionRepository } from "../repository";
import {
    ensureDivisionCanBeDeleted,
    ensureDivisionExists,
    ensureDivisionNameUnique,
    ensureDivisionNameUniqueForUpdate,
    ensureManagerExists,
} from "./validation";

// & Create division and write audit log.
// % Buat divisi dan tulis audit log.
export async function create(
  data: {
    name: string;
    description?: string;
    managerId?: string;
  },
  actor: AuditActor,
) {
  await ensureDivisionNameUnique(data.name);
  await ensureManagerExists(data.managerId);

  const created = await DivisionRepository.createDivision({
    name: data.name,
    description: data.description,
    managerId: data.managerId,
  });

  await writeAuditLog({
    actor,
    action: "CREATE_DIVISION",
    entity: "Divisions",
    entityId: created.id,
    changes: {
      before: null,
      after: {
        name: created.name,
        description: created.description,
        managerId: created.managerId,
      },
    },
  });

  return created;
}

// & Update division and write audit log.
// % Update divisi dan tulis audit log.
export async function update(
  id: string,
  data: {
    name?: string;
    description?: string;
    managerId?: string | null;
  },
  actor: AuditActor,
) {
  const existing = await ensureDivisionExists(id);

  if (data.name && data.name !== existing.name) {
    await ensureDivisionNameUniqueForUpdate(data.name, id);
  }

  if (data.managerId) {
    await ensureManagerExists(data.managerId);
  }

  const updated = await DivisionRepository.updateDivision(id, data);

  await writeAuditLog({
    actor,
    action: "UPDATE_DIVISION",
    entity: "Divisions",
    entityId: id,
    changes: {
      before: {
        name: existing.name,
        description: existing.description,
        managerId: existing.managerId,
      },
      after: {
        name: updated.name,
        description: updated.description,
        managerId: updated.managerId,
      },
    },
  });

  return updated;
}

// & Delete division when no related positions and write audit log.
// % Hapus divisi saat tidak ada posisi terkait dan tulis audit log.
export async function remove(id: string, actor: AuditActor) {
  const existing = await ensureDivisionExists(id);
  await ensureDivisionCanBeDeleted(id);

  const deleted = await DivisionRepository.deleteDivision(id);

  await writeAuditLog({
    actor,
    action: "DELETE_DIVISION",
    entity: "Divisions",
    entityId: id,
    changes: {
      before: {
        name: existing.name,
        description: existing.description,
        managerId: existing.managerId,
      },
      after: null,
    },
  });

  return deleted;
}

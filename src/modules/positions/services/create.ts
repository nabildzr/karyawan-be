// * File ini menangani operasi tulis untuk module positions.

import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { PositionRepository } from "../repository";
import {
    ensureDivisionExists,
    ensurePositionCanBeDeleted,
    ensurePositionExists,
    ensurePositionNameUnique,
    ensurePositionNameUniqueForUpdate,
} from "./validation";

// & Create position and write audit log.
// % Buat posisi dan tulis audit log.
export async function create(
  data: {
    name: string;
    gajiPokok: number;
    isManagerial?: boolean;
    divisionId?: string;
  },
  actor: AuditActor,
) {
  await ensurePositionNameUnique(data.name);
  await ensureDivisionExists(data.divisionId);

  const created = await PositionRepository.createPosition({
    name: data.name,
    gajiPokok: data.gajiPokok,
    isManagerial: data.isManagerial,
    divisionId: data.divisionId,
  });

  await writeAuditLog({
    actor,
    action: "CREATE_POSITION",
    entity: "Positions",
    entityId: created.id,
    changes: {
      before: null,
      after: {
        name: created.name,
        gajiPokok: created.gajiPokok,
        isManagerial: created.isManagerial,
        divisionId: created.divisionId,
      },
    },
  });

  return created;
}

// & Update position and write audit log.
// % Update posisi dan tulis audit log.
export async function update(
  id: string,
  data: {
    name?: string;
    gajiPokok?: number;
    isManagerial?: boolean;
    divisionId?: string | null;
  },
  actor: AuditActor,
) {
  const existing = await ensurePositionExists(id);

  if (data.name && data.name !== existing.name) {
    await ensurePositionNameUniqueForUpdate(data.name, id);
  }

  if (data.divisionId) {
    await ensureDivisionExists(data.divisionId);
  }

  const updated = await PositionRepository.updatePosition(id, data);

  await writeAuditLog({
    actor,
    action: "UPDATE_POSITION",
    entity: "Positions",
    entityId: id,
    changes: {
      before: {
        name: existing.name,
        gajiPokok: existing.gajiPokok,
        isManagerial: existing.isManagerial,
        divisionId: existing.divisionId,
      },
      after: {
        name: updated.name,
        gajiPokok: updated.gajiPokok,
        isManagerial: updated.isManagerial,
        divisionId: updated.divisionId,
      },
    },
  });

  return updated;
}

// & Delete position when unused and write audit log.
// % Hapus posisi saat tidak terpakai dan tulis audit log.
export async function remove(id: string, actor: AuditActor) {
  const existing = await ensurePositionExists(id);
  await ensurePositionCanBeDeleted(id);

  const deleted = await PositionRepository.deletePosition(id);

  await writeAuditLog({
    actor,
    action: "DELETE_POSITION",
    entity: "Positions",
    entityId: id,
    changes: {
      before: {
        name: existing.name,
        gajiPokok: existing.gajiPokok,
        isManagerial: existing.isManagerial,
        divisionId: existing.divisionId,
      },
      after: null,
    },
  });

  return deleted;
}

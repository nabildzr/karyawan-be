import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import {
  countPositionsByDivisionId,
  createDivision,
  deleteDivision,
  findDivisionById,
  findDivisionByIdBasic,
  findDivisionByName,
  findDivisionByNameExcludingId,
  findDivisions,
  findUserById,
  updateDivision,
  type DivisionRecord,
} from "./divisions.repository";
import type {
  DivisionCreateBodyPayload,
  DivisionDetailQueryPayload,
  DivisionListQueryPayload,
  DivisionManagerPayload,
  DivisionPayload,
  DivisionPositionPayload,
  DivisionUpdateBodyPayload,
} from "./divisions.schema";

type DivisionListResultPayload = {
  data: DivisionPayload[];
};

/** Memetakan data manager mentah ke payload response endpoint. */
function toManagerPayload(manager: NonNullable<DivisionRecord["manager"]>): DivisionManagerPayload {
  const employees = manager.employees
    ? [
        {
          id: manager.employees.id,
          fullName: manager.employees.fullName,
          email: manager.employees.email,
          phoneNumber: manager.employees.phoneNumber,
        },
      ]
    : [];

  return {
    id: manager.id,
    nip: manager.nip,
    rbacRole: manager.rbacRole
      ? {
          id: manager.rbacRole.id,
          key: manager.rbacRole.key,
          name: manager.rbacRole.name,
          isActive: manager.rbacRole.isActive,
          canAccessAdmin: manager.rbacRole.canAccessAdmin,
        } 
      : null,
    employees,
  };
}

/** Memetakan data posisi mentah ke payload response endpoint. */
function toPositionPayload(
  position: NonNullable<DivisionRecord["positions"]>[number],
): DivisionPositionPayload {
  const payload: DivisionPositionPayload = {
    id: position.id,
    name: position.name,
    gajiPokok: position.gajiPokok,
    isManagerial: position.isManagerial,
    createdAt: position.createdAt.toISOString(),
    updatedAt: position.updatedAt.toISOString(),
  };

  if ("employees" in position) {
    payload.employees = (position.employees ?? []).map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      phoneNumber: employee.phoneNumber,
    }));
  }

  return payload;
}

/** Memetakan data divisi mentah ke payload response endpoint. */
function toDivisionPayload(record: DivisionRecord): DivisionPayload {
  const payload: DivisionPayload = {
    id: record.id,
    name: record.name,
    description: record.description,
    managerId: record.managerId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };

  if ("manager" in record) {
    payload.manager = record.manager ? toManagerPayload(record.manager) : null;
  }

  if ("positions" in record) {
    payload.positions = (record.positions ?? []).map(toPositionPayload);
  }

  return payload;
}

/** Menormalisasi opsi relasi query untuk endpoint daftar divisi. */
function normalizeListRelationOptions(query: DivisionListQueryPayload) {
  return {
    withPositions: Boolean(query.withPositions),
    withManager: Boolean(query.withManager),
    withEmployees: Boolean(query.withEmployees),
  };
}

/** Menormalisasi opsi relasi query untuk endpoint detail divisi. */
function normalizeDetailRelationOptions(query: DivisionDetailQueryPayload) {
  return {
    withPositions: query.withPositions ?? true,
    withManager: query.withManager ?? true,
    withEmployees: query.withEmployees ?? false,
  };
}

/** Memastikan data divisi tersedia sebelum dipakai proses mutasi. */
async function ensureDivisionExists(id: string) {
  const division = await findDivisionByIdBasic(id);

  if (!division) {
    throw new Error("Not Found: Divisi dengan ID tersebut tidak ditemukan.");
  }

  return division;
}

/** Memastikan nama divisi unik saat pembuatan data baru. */
async function ensureDivisionNameUnique(name: string) {
  const existing = await findDivisionByName(name);

  if (existing) {
    throw new Error("Conflict: Divisi dengan nama tersebut sudah ada.");
  }
}

/** Memastikan nama divisi unik saat update data. */
async function ensureDivisionNameUniqueForUpdate(name: string, currentId: string) {
  const conflict = await findDivisionByNameExcludingId(name, currentId);

  if (conflict) {
    throw new Error("Conflict: Divisi dengan nama tersebut sudah ada.");
  }
}

/** Memastikan manager tersedia saat managerId dikirim ke payload. */
async function ensureManagerExists(managerId?: string | null) {
  if (!managerId) {
    return;
  }

  const manager = await findUserById(managerId);

  if (!manager) {
    throw new Error("Not Found: User manager dengan ID tersebut tidak ditemukan.");
  }
}

/** Memastikan divisi aman dihapus karena tidak punya posisi aktif. */
async function ensureDivisionCanBeDeleted(id: string) {
  const positionCount = await countPositionsByDivisionId(id);

  if (positionCount > 0) {
    throw new Error(
      `Bad Request: Divisi tidak dapat dihapus karena masih memiliki ${positionCount} posisi. Hapus atau pindahkan posisi tersebut terlebih dahulu.`,
    );
  }
}

/** Mengambil daftar divisi dengan opsi relasi sesuai query. */
async function getAll(query: DivisionListQueryPayload): Promise<DivisionListResultPayload> {
  const records = await findDivisions(normalizeListRelationOptions(query));

  return {
    data: records.map(toDivisionPayload),
  };
}

/** Mengambil detail divisi berdasarkan id dan opsi relasi. */
async function getById(
  id: string,
  query: DivisionDetailQueryPayload,
): Promise<DivisionPayload> {
  const record = await findDivisionById(id, normalizeDetailRelationOptions(query));

  if (!record) {
    throw new Error("Not Found: Divisi dengan ID tersebut tidak ditemukan.");
  }

  return toDivisionPayload(record);
}

/** Membuat divisi baru lalu mencatat audit log. */
async function create(
  data: DivisionCreateBodyPayload,
  actor: AuditActor,
): Promise<DivisionPayload> {
  await ensureDivisionNameUnique(data.name);
  await ensureManagerExists(data.managerId);

  const created = await createDivision({
    name: data.name,
    description: data.description,
    managerId: data.managerId ?? null,
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

  return toDivisionPayload(created as DivisionRecord);
}

/** Memperbarui divisi lalu mencatat audit log. */
async function update(
  id: string,
  data: DivisionUpdateBodyPayload,
  actor: AuditActor,
): Promise<DivisionPayload> {
  const existing = await ensureDivisionExists(id);

  if (data.name && data.name !== existing.name) {
    await ensureDivisionNameUniqueForUpdate(data.name, id);
  }

  if (data.managerId) {
    await ensureManagerExists(data.managerId);
  }

  const updated = await updateDivision(id, {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...("managerId" in data && { managerId: data.managerId }),
  });

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

  return toDivisionPayload(updated as DivisionRecord);
}

/** Menghapus divisi jika aman lalu mencatat audit log. */
async function remove(id: string, actor: AuditActor): Promise<void> {
  const existing = await ensureDivisionExists(id);
  await ensureDivisionCanBeDeleted(id);

  await deleteDivision(id);

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
}

/** Mengekspor DivisionService untuk kebutuhan modul ini. */
export const DivisionService = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
};

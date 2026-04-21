import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import {
  countEmployeesByPositionId,
  createPosition,
  deletePosition,
  findDivisionById,
  findPositionById,
  findPositionByIdBasic,
  findPositionByName,
  findPositionByNameExcludingId,
  findPositions,
  updatePosition,
  type PositionRecord,
} from "./positions.repository";
import type {
  PositionCreateBodyPayload,
  PositionDetailQueryPayload,
  PositionListQueryPayload,
  PositionPayload,
  PositionUpdateBodyPayload,
} from "./positions.schema";

type PositionListResultPayload = {
  data: PositionPayload[];
};

/** Memetakan data posisi mentah ke payload response endpoint. */
function toPositionPayload(record: {
  id: string;
  name: string;
  gajiPokok: number;
  isManagerial: boolean;
  divisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  division?: {
    id: string;
    name: string;
  } | null;
  employees?: Array<{
    id: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
  }>;
}): PositionPayload {
  const payload: PositionPayload = {
    id: record.id,
    name: record.name,
    gajiPokok: record.gajiPokok,
    isManagerial: record.isManagerial,
    divisionId: record.divisionId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };

  if ("division" in record) {
    payload.division = record.division
      ? {
          id: record.division.id,
          name: record.division.name,
        }
      : null;
  }

  if ("employees" in record) {
    payload.employees = (record.employees ?? []).map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      phoneNumber: employee.phoneNumber,
    }));
  }

  return payload;
}

/** Menormalisasi opsi relasi query untuk endpoint daftar posisi. */
function normalizeListRelationOptions(query: PositionListQueryPayload) {
  return {
    withDivision: Boolean(query.withDivision),
    withEmployees: Boolean(query.withEmployees),
  };
}

/** Menormalisasi opsi relasi query untuk endpoint detail posisi. */
function normalizeDetailRelationOptions(query: PositionDetailQueryPayload) {
  return {
    withDivision: query.withDivision ?? true,
    withEmployees: query.withEmployees ?? false,
  };
}

/** Memastikan data posisi tersedia sebelum dipakai proses mutasi. */
async function ensurePositionExists(id: string) {
  const position = await findPositionByIdBasic(id);

  if (!position) {
    throw new Error("Not Found: Posisi dengan ID tersebut tidak ditemukan.");
  }

  return position;
}

/** Memastikan nama posisi unik saat pembuatan data baru. */
async function ensurePositionNameUnique(name: string) {
  const existing = await findPositionByName(name);

  if (existing) {
    throw new Error("Conflict: Posisi dengan nama tersebut sudah ada.");
  }
}

/** Memastikan nama posisi unik saat update data. */
async function ensurePositionNameUniqueForUpdate(name: string, currentId: string) {
  const conflict = await findPositionByNameExcludingId(name, currentId);

  if (conflict) {
    throw new Error("Conflict: Posisi dengan nama tersebut sudah ada.");
  }
}

/** Memastikan divisi tersedia saat divisionId dikirim ke payload. */
async function ensureDivisionExists(divisionId?: string | null) {
  if (!divisionId) {
    return;
  }

  const division = await findDivisionById(divisionId);

  if (!division) {
    throw new Error("Not Found: Divisi dengan ID tersebut tidak ditemukan.");
  }
}

/** Memastikan posisi aman dihapus karena tidak dipakai data karyawan. */
async function ensurePositionCanBeDeleted(id: string) {
  const employeeCount = await countEmployeesByPositionId(id);

  if (employeeCount > 0) {
    throw new Error(
      `Bad Request: Posisi tidak dapat dihapus karena masih digunakan oleh ${employeeCount} karyawan.`,
    );
  }
}

/** Mengambil daftar posisi dengan opsi relasi sesuai query. */
async function getAll(
  query: PositionListQueryPayload,
): Promise<PositionListResultPayload> {
  const records = await findPositions(normalizeListRelationOptions(query));

  return {
    data: records.map(toPositionPayload),
  };
}

/** Mengambil detail posisi berdasarkan id dan opsi relasi. */
async function getById(
  id: string,
  query: PositionDetailQueryPayload,
): Promise<PositionPayload> {
  const record = await findPositionById(id, normalizeDetailRelationOptions(query));

  if (!record) {
    throw new Error("Not Found: Posisi dengan ID tersebut tidak ditemukan.");
  }

  return toPositionPayload(record as PositionRecord);
}

/** Membuat posisi baru lalu mencatat audit log. */
async function create(
  data: PositionCreateBodyPayload,
  actor: AuditActor,
): Promise<PositionPayload> {
  await ensurePositionNameUnique(data.name);
  await ensureDivisionExists(data.divisionId ?? null);

  const created = await createPosition({
    name: data.name,
    gajiPokok: data.gajiPokok,
    isManagerial: data.isManagerial ?? false,
    divisionId: data.divisionId ?? null,
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

  return toPositionPayload(created);
}

/** Memperbarui posisi lalu mencatat audit log. */
async function update(
  id: string,
  data: PositionUpdateBodyPayload,
  actor: AuditActor,
): Promise<PositionPayload> {
  const existing = await ensurePositionExists(id);

  if (data.name && data.name !== existing.name) {
    await ensurePositionNameUniqueForUpdate(data.name, id);
  }

  if ("divisionId" in data) {
    await ensureDivisionExists(data.divisionId ?? null);
  }

  const updated = await updatePosition(id, {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.gajiPokok !== undefined && { gajiPokok: data.gajiPokok }),
    ...(data.isManagerial !== undefined && { isManagerial: data.isManagerial }),
    ...("divisionId" in data && { divisionId: data.divisionId }),
  });

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

  return toPositionPayload(updated);
}

/** Menghapus posisi jika aman lalu mencatat audit log. */
async function remove(id: string, actor: AuditActor): Promise<void> {
  const existing = await ensurePositionExists(id);
  await ensurePositionCanBeDeleted(id);

  await deletePosition(id);

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
}

/** Mengekspor PositionService untuk kebutuhan modul ini. */
export const PositionService = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
};

import prisma from "../../config/prisma";
import type { Divisions, Prisma, Users } from "../../generated/prisma/client";

/** Mendefinisikan alias tipe untuk DivisionRecord. */
export type DivisionRecord = {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  manager?: {
    id: string;
    nip: string;
    rbacRole: {
      id: string;
      key: string;
      name: string;
      isActive: boolean;
      canAccessAdmin: boolean;
    } | null;
    employees: {
      id: string;
      fullName: string;
      email: string | null;
      phoneNumber: string | null;
    } | null;
  } | null;
  positions?: Array<{
    id: string;
    name: string;
    gajiPokok: number;
    isManagerial: boolean;
    createdAt: Date;
    updatedAt: Date;
    employees?: Array<{
      id: string;
      fullName: string;
      email: string | null;
      phoneNumber: string | null;
    }>;
  }>;
};

const managerSelect = {
  id: true,
  nip: true,
  rbacRole: {
    select: {
      id: true,
      key: true,
      name: true,
      isActive: true,
      canAccessAdmin: true,
    },
  },
  employees: {
    select: { id: true, fullName: true, email: true, phoneNumber: true },
  },
} satisfies Prisma.UsersSelect;

/** Menyusun query relasi posisi saat opsi withEmployees aktif/nonaktif. */
function positionWithEmployeesSelect(withEmployees: boolean) {
  return {
    select: {
      id: true,
      name: true,
      gajiPokok: true,
      isManagerial: true,
      createdAt: true,
      updatedAt: true,
      employees: withEmployees
        ? {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
            },
            orderBy: { fullName: "asc" as const },
          }
        : false,
    },
    orderBy: { createdAt: "desc" as const },
  } satisfies Prisma.PositionsFindManyArgs;
}

/** Menyusun select query divisi berdasarkan opsi relasi endpoint. */
function buildDivisionSelect(params: {
  withPositions: boolean;
  withManager: boolean;
  withEmployees: boolean;
}) {
  return {
    id: true,
    name: true,
    description: true,
    managerId: true,
    createdAt: true,
    updatedAt: true,
    manager: params.withManager ? { select: managerSelect } : false,
    positions:
      params.withPositions || params.withEmployees
        ? positionWithEmployeesSelect(params.withEmployees)
        : false,
  } satisfies Prisma.DivisionsSelect;
}

/** Mengambil daftar divisi mentah dari database. */
export async function findDivisions(params: {
  withPositions: boolean;
  withManager: boolean;
  withEmployees: boolean;
}): Promise<DivisionRecord[]> {
  return prisma.divisions.findMany({
    select: buildDivisionSelect(params),
    orderBy: { createdAt: "desc" },
  }) as Promise<DivisionRecord[]>;
}

/** Mengambil detail divisi mentah berdasarkan id. */
export async function findDivisionById(
  id: string,
  params: {
    withPositions: boolean;
    withManager: boolean;
    withEmployees: boolean;
  },
): Promise<DivisionRecord | null> {
  return prisma.divisions.findUnique({
    where: { id },
    select: buildDivisionSelect(params),
  }) as Promise<DivisionRecord | null>;
}

/** Mengambil data divisi mentah dasar untuk kebutuhan validasi mutasi. */
export async function findDivisionByIdBasic(id: string): Promise<Divisions | null> {
  return prisma.divisions.findUnique({ where: { id } });
}

/** Mengambil data divisi mentah berdasarkan nama. */
export async function findDivisionByName(name: string): Promise<Divisions | null> {
  return prisma.divisions.findFirst({ where: { name } });
}

/** Mengambil data divisi mentah berdasarkan nama selain id tertentu. */
export async function findDivisionByNameExcludingId(
  name: string,
  currentDivisionId: string,
): Promise<Divisions | null> {
  return prisma.divisions.findFirst({
    where: {
      name,
      NOT: { id: currentDivisionId },
    },
  });
}

/** Mengambil data user mentah berdasarkan id. */
export async function findUserById(id: string): Promise<Users | null> {
  return prisma.users.findUnique({ where: { id } });
}

/** Menghitung jumlah posisi yang terhubung ke satu divisi. */
export async function countPositionsByDivisionId(id: string): Promise<number> {
  return prisma.positions.count({ where: { divisionId: id } });
}

/** Membuat data divisi mentah baru ke database. */
export async function createDivision(
  data: Prisma.DivisionsUncheckedCreateInput,
): Promise<Divisions> {
  return prisma.divisions.create({ data });
}

/** Mengubah data divisi mentah di database. */
export async function updateDivision(
  id: string,
  data: Prisma.DivisionsUncheckedUpdateInput,
): Promise<Divisions> {
  return prisma.divisions.update({ where: { id }, data });
}

/** Menghapus data divisi mentah dari database. */
export async function deleteDivision(id: string): Promise<Divisions> {
  return prisma.divisions.delete({ where: { id } });
}

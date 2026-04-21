import prisma from "../../config/prisma";
import type { Divisions, Positions, Prisma } from "../../generated/prisma/client";

/** Mendefinisikan alias tipe untuk PositionRecord. */
export type PositionRecord = Positions & {
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
};

/** Menyusun include query posisi berdasarkan flag relasi. */
function buildPositionInclude(params: {
  withDivision: boolean;
  withEmployees: boolean;
}) {
  return {
    division: params.withDivision ? { select: { id: true, name: true } } : false,
    employees: params.withEmployees
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
  } satisfies Prisma.PositionsInclude;
}

/** Mengambil daftar posisi mentah dari database. */
export async function findPositions(params: {
  withDivision: boolean;
  withEmployees: boolean;
}): Promise<PositionRecord[]> {
  return prisma.positions.findMany({
    include: buildPositionInclude(params),
    orderBy: { createdAt: "desc" },
  }) as Promise<PositionRecord[]>;
}

/** Mengambil detail posisi mentah berdasarkan id. */
export async function findPositionById(
  id: string,
  params: {
    withDivision: boolean;
    withEmployees: boolean;
  },
): Promise<PositionRecord | null> {
  return prisma.positions.findUnique({
    where: { id },
    include: buildPositionInclude(params),
  }) as Promise<PositionRecord | null>;
}

/** Mengambil data posisi mentah dasar untuk kebutuhan validasi mutasi. */
export async function findPositionByIdBasic(id: string): Promise<Positions | null> {
  return prisma.positions.findUnique({ where: { id } });
}

/** Mengambil data posisi mentah berdasarkan nama. */
export async function findPositionByName(name: string): Promise<Positions | null> {
  return prisma.positions.findFirst({ where: { name } });
}

/** Mengambil data posisi mentah berdasarkan nama selain id tertentu. */
export async function findPositionByNameExcludingId(
  name: string,
  currentPositionId: string,
): Promise<Positions | null> {
  return prisma.positions.findFirst({
    where: {
      name,
      NOT: { id: currentPositionId },
    },
  });
}

/** Mengambil data divisi mentah berdasarkan id. */
export async function findDivisionById(id: string): Promise<Divisions | null> {
  return prisma.divisions.findUnique({ where: { id } });
}

/** Menghitung jumlah karyawan yang memakai posisi tertentu. */
export async function countEmployeesByPositionId(id: string): Promise<number> {
  return prisma.employees.count({ where: { positionId: id } });
}

/** Membuat posisi mentah baru di database. */
export async function createPosition(
  data: Prisma.PositionsUncheckedCreateInput,
): Promise<Positions> {
  return prisma.positions.create({ data });
}

/** Mengubah posisi mentah di database. */
export async function updatePosition(
  id: string,
  data: Prisma.PositionsUncheckedUpdateInput,
): Promise<Positions> {
  return prisma.positions.update({
    where: { id },
    data,
  });
}

/** Menghapus posisi mentah dari database. */
export async function deletePosition(id: string): Promise<Positions> {
  return prisma.positions.delete({ where: { id } });
}

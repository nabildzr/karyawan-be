// * Repository ini menjadi lapisan akses database untuk module positions.

import prisma from "../../config/prisma";

const positionSelect = (params: { withDivision?: boolean; withEmployees?: boolean }) => ({
  id: true,
  name: true,
  gajiPokok: true,
  isManagerial: true,
  divisionId: true,
  createdAt: true,
  updatedAt: true,
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
});

export const PositionRepository = {
  // & Find all positions with optional relations.
  // % Ambil semua posisi dengan relasi opsional.
  async findAllPositions(params: { withDivision?: boolean; withEmployees?: boolean }) {
    return prisma.positions.findMany({
      select: positionSelect(params),
      orderBy: { createdAt: "desc" },
    });
  },

  // & Find position by id with optional relations.
  // % Ambil posisi berdasarkan id dengan relasi opsional.
  async findPositionById(
    id: string,
    params: { withDivision?: boolean; withEmployees?: boolean },
  ) {
    return prisma.positions.findUnique({
      where: { id },
      select: positionSelect(params),
    });
  },

  // & Find plain position entity by id.
  // % Ambil entitas posisi polos berdasarkan id.
  async findPlainPositionById(id: string) {
    return prisma.positions.findUnique({ where: { id } });
  },

  // & Find position by exact name.
  // % Cari posisi berdasarkan nama persis.
  async findPositionByName(name: string) {
    return prisma.positions.findFirst({ where: { name } });
  },

  // & Find position by name excluding current position id.
  // % Cari posisi berdasarkan nama dengan mengecualikan id saat ini.
  async findPositionByNameExcludeId(name: string, excludedId: string) {
    return prisma.positions.findFirst({
      where: {
        name,
        NOT: { id: excludedId },
      },
    });
  },

  // & Find division by id.
  // % Cari divisi berdasarkan id.
  async findDivisionById(id: string) {
    return prisma.divisions.findUnique({ where: { id } });
  },

  // & Count employees using a position.
  // % Hitung jumlah karyawan yang memakai posisi.
  async countEmployeesByPositionId(positionId: string) {
    return prisma.employees.count({ where: { positionId } });
  },

  // & Create position row.
  // % Buat baris posisi.
  async createPosition(data: {
    name: string;
    gajiPokok: number;
    isManagerial?: boolean;
    divisionId?: string | null;
  }) {
    return prisma.positions.create({
      data: {
        name: data.name,
        gajiPokok: data.gajiPokok,
        isManagerial: data.isManagerial ?? false,
        divisionId: data.divisionId ?? null,
      },
    });
  },

  // & Update position row by id.
  // % Update baris posisi berdasarkan id.
  async updatePosition(
    id: string,
    data: {
      name?: string;
      gajiPokok?: number;
      isManagerial?: boolean;
      divisionId?: string | null;
    },
  ) {
    return prisma.positions.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.gajiPokok !== undefined && { gajiPokok: data.gajiPokok }),
        ...(data.isManagerial !== undefined && {
          isManagerial: data.isManagerial,
        }),
        ...("divisionId" in data && { divisionId: data.divisionId }),
      },
    });
  },

  // & Delete position row by id.
  // % Hapus baris posisi berdasarkan id.
  async deletePosition(id: string) {
    return prisma.positions.delete({ where: { id } });
  },
};

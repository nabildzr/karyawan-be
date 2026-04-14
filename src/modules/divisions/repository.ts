// * Repository ini menjadi lapisan akses database untuk module divisions.

import prisma from "../../config/prisma";

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
};

const positionWithEmployeesSelect = (withEmployees: boolean) => ({
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
});

const buildDivisionSelect = (params: {
  withPositions?: boolean;
  withManager?: boolean;
  withEmployees?: boolean;
}) => ({
  id: true,
  name: true,
  description: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
  manager: params.withManager ? { select: managerSelect } : false,
  positions:
    params.withPositions || params.withEmployees
      ? positionWithEmployeesSelect(Boolean(params.withEmployees))
      : false,
});

export const DivisionRepository = {
  // & Find all divisions with optional relation toggles.
  // % Ambil semua divisi dengan toggle relasi opsional.
  async findAllDivisions(params: {
    withPositions?: boolean;
    withManager?: boolean;
    withEmployees?: boolean;
  }) {
    return prisma.divisions.findMany({
      select: buildDivisionSelect(params),
      orderBy: { createdAt: "desc" },
    });
  },

  // & Find division detail by id with optional relation toggles.
  // % Ambil detail divisi berdasarkan id dengan toggle relasi opsional.
  async findDivisionById(
    id: string,
    params: {
      withPositions?: boolean;
      withManager?: boolean;
      withEmployees?: boolean;
    },
  ) {
    return prisma.divisions.findUnique({
      where: { id },
      select: buildDivisionSelect(params),
    });
  },

  // & Find plain division entity by id.
  // % Ambil entitas divisi polos berdasarkan id.
  async findPlainDivisionById(id: string) {
    return prisma.divisions.findUnique({ where: { id } });
  },

  // & Find division by exact name.
  // % Cari divisi berdasarkan nama persis.
  async findDivisionByName(name: string) {
    return prisma.divisions.findFirst({ where: { name } });
  },

  // & Find division by name excluding current division id.
  // % Cari divisi berdasarkan nama dengan mengecualikan id divisi saat ini.
  async findDivisionByNameExcludeId(name: string, excludedId: string) {
    return prisma.divisions.findFirst({
      where: {
        name,
        NOT: { id: excludedId },
      },
    });
  },

  // & Find manager user by id.
  // % Cari user manager berdasarkan id.
  async findManagerById(id: string) {
    return prisma.users.findUnique({ where: { id } });
  },

  // & Count positions under a division.
  // % Hitung jumlah posisi di sebuah divisi.
  async countPositionsByDivisionId(divisionId: string) {
    return prisma.positions.count({ where: { divisionId } });
  },

  // & Create division row.
  // % Buat baris divisi.
  async createDivision(data: {
    name: string;
    description?: string;
    managerId?: string | null;
  }) {
    return prisma.divisions.create({
      data: {
        name: data.name,
        description: data.description,
        managerId: data.managerId ?? null,
      },
    });
  },

  // & Update division row by id.
  // % Update baris divisi berdasarkan id.
  async updateDivision(
    id: string,
    data: {
      name?: string;
      description?: string;
      managerId?: string | null;
    },
  ) {
    return prisma.divisions.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...("managerId" in data && { managerId: data.managerId }),
      },
    });
  },

  // & Delete division row by id.
  // % Hapus baris divisi berdasarkan id.
  async deleteDivision(id: string) {
    return prisma.divisions.delete({ where: { id } });
  },
};

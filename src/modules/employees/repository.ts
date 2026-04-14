// * Repository ini menjadi lapisan abstraksi akses database untuk module employees.

import prisma from "../../config/prisma";
import {
  employeeBaseSelect,
  workingScheduleDeepSelect,
} from "../../shared/selects/employeeDataSelect";

const employeeDeepSelect = {
  ...employeeBaseSelect,
  workingSchedulesId: true,
  workingSchedules: workingScheduleDeepSelect,
  position: {
    select: {
      id: true,
      name: true,
      gajiPokok: true,
      isManagerial: true,
      createdAt: true,
      updatedAt: true,
      division: {
        select: {
          id: true,
          name: true,
          description: true,
          manager: {
            select: {
              id: true,
              nip: true,
              employees: {
                select: { id: true, fullName: true },
              },
            },
          },
        },
      },
    },
  },
  employeeDetails: true,
};

const employeeWriteSelect = {
  user: {
    select: {
      id: true,
      nip: true,
      rbacRoleId: true,
      rbacRole: {
        select: {
          id: true,
          key: true,
          name: true,
          isSystem: true,
          isActive: true,
        },
      },
    },
  },
  employeeDetails: true,
  position: true,
};

export const EmployeeRepository = {
  // & Resolve RBAC role by role id.
  // % Ambil role RBAC berdasarkan id role.
  async findRbacRoleById(id: string) {
    return prisma.rbacRoles.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
  },

  // & Resolve RBAC role by role key.
  // % Ambil role RBAC berdasarkan key role.
  async findRbacRoleByKey(key: string) {
    return prisma.rbacRoles.findUnique({
      where: { key },
      select: { id: true, isActive: true },
    });
  },

  // & Find position master data by id.
  // % Cari data jabatan/posisi berdasarkan id.
  async findPositionById(positionId: string) {
    return prisma.positions.findUnique({ where: { id: positionId } });
  },

  // & Find working schedule master data by id.
  // % Cari data jadwal kerja berdasarkan id.
  async findWorkingScheduleById(scheduleId: string) {
    return prisma.workingSchedules.findUnique({ where: { id: scheduleId } });
  },

  // & Find user by NIP.
  // % Cari user berdasarkan NIP.
  async findUserByNip(nip: string) {
    return prisma.users.findUnique({ where: { nip } });
  },

  // & Find user by NIP excluding specific user id.
  // % Cari user berdasarkan NIP sambil mengecualikan user tertentu.
  async findUserByNipExcludeUserId(nip: string, excludedUserId: string) {
    return prisma.users.findFirst({
      where: { nip, NOT: { id: excludedUserId } },
    });
  },

  // & Find employee by email.
  // % Cari karyawan berdasarkan email.
  async findEmployeeByEmail(email: string) {
    return prisma.employees.findUnique({ where: { email } });
  },

  // & Find employee by email excluding specific employee id.
  // % Cari karyawan berdasarkan email sambil mengecualikan id karyawan tertentu.
  async findEmployeeByEmailExcludeId(email: string, excludedEmployeeId: string) {
    return prisma.employees.findFirst({
      where: { email, NOT: { id: excludedEmployeeId } },
    });
  },

  // & Find employee by phone number.
  // % Cari karyawan berdasarkan nomor telepon.
  async findEmployeeByPhoneNumber(phoneNumber: string) {
    return prisma.employees.findUnique({ where: { phoneNumber } });
  },

  // & Find employee by phone number excluding specific employee id.
  // % Cari karyawan berdasarkan nomor telepon sambil mengecualikan id karyawan tertentu.
  async findEmployeeByPhoneNumberExcludeId(
    phoneNumber: string,
    excludedEmployeeId: string,
  ) {
    return prisma.employees.findFirst({
      where: { phoneNumber, NOT: { id: excludedEmployeeId } },
    });
  },

  // & Find paginated employees with shared base select.
  // % Ambil daftar karyawan paginasi dengan select data dasar.
  async findEmployees(params: { where: any; skip: number; take: number }) {
    return prisma.employees.findMany({
      where: params.where,
      select: employeeBaseSelect,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
    });
  },

  // & Count employees by filter.
  // % Hitung total karyawan berdasarkan filter.
  async countEmployees(where: any) {
    return prisma.employees.count({ where });
  },

  // & Find employee deep detail by id.
  // % Ambil detail karyawan lengkap (deep relation) berdasarkan id.
  async findEmployeeDeepById(id: string) {
    return prisma.employees.findUnique({
      where: { id },
      select: employeeDeepSelect,
    });
  },

  // & Find employee data required for update/delete mutation flow.
  // % Ambil data karyawan minimum untuk alur update/delete.
  async findEmployeeByIdForMutation(id: string) {
    return prisma.employees.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            nip: true,
            rbacRoleId: true,
            rbacRole: {
              select: {
                key: true,
              },
            },
          },
        },
        employeeDetails: true,
      },
    });
  },

  // & Run transaction wrapper for all write operations.
  // % Jalankan wrapper transaction untuk operasi tulis.
  async runTransaction<T>(runner: (tx: any) => Promise<T>) {
    return prisma.$transaction(async (tx) => runner(tx));
  },

  // & Create user inside running transaction.
  // % Buat user di dalam transaction yang sedang berjalan.
  async createUser(tx: any, data: { nip: string; rbacRoleId: string; password: string }) {
    return tx.users.create({ data });
  },

  // & Create employee profile inside running transaction.
  // % Buat profil karyawan di dalam transaction yang sedang berjalan.
  async createEmployee(tx: any, data: any) {
    return tx.employees.create({ data });
  },

  // & Create employee details inside running transaction.
  // % Buat detail karyawan di dalam transaction yang sedang berjalan.
  async createEmployeeDetails(tx: any, data: any) {
    return tx.employeeDetails.create({ data });
  },

  // & Update user inside running transaction.
  // % Update user di dalam transaction yang sedang berjalan.
  async updateUser(tx: any, userId: string, data: any) {
    return tx.users.update({ where: { id: userId }, data });
  },

  // & Update employee profile inside running transaction.
  // % Update profil karyawan di dalam transaction yang sedang berjalan.
  async updateEmployee(tx: any, employeeId: string, data: any) {
    return tx.employees.update({ where: { id: employeeId }, data });
  },

  // & Upsert employee details inside running transaction.
  // % Upsert detail karyawan di dalam transaction yang sedang berjalan.
  async upsertEmployeeDetails(tx: any, employeeId: string, details: any) {
    return tx.employeeDetails.upsert({
      where: { employeeId },
      update: details,
      create: { ...details, employeeId },
    });
  },

  // & Find post-write employee data snapshot for API response.
  // % Ambil snapshot data karyawan setelah write untuk response API.
  async findEmployeeByIdForWriteResult(tx: any, employeeId: string) {
    return tx.employees.findUnique({
      where: { id: employeeId },
      include: employeeWriteSelect,
    });
  },

  // & Delete employee details by employee id.
  // % Hapus detail karyawan berdasarkan employee id.
  async deleteEmployeeDetailsByEmployeeId(tx: any, employeeId: string) {
    return tx.employeeDetails.deleteMany({ where: { employeeId } });
  },

  // & Delete employee profile by employee id.
  // % Hapus profil karyawan berdasarkan employee id.
  async deleteEmployeeById(tx: any, employeeId: string) {
    return tx.employees.delete({ where: { id: employeeId } });
  },

  // & Delete user by user id.
  // % Hapus user berdasarkan user id.
  async deleteUserById(tx: any, userId: string) {
    return tx.users.delete({ where: { id: userId } });
  },
};

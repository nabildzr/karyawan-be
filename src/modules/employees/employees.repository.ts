import prisma from "../../config/prisma";
import type {
  EmployeeDetails,
  Employees,
  Prisma,
  RbacRoles,
  Users,
} from "../../generated/prisma/client";
import {
  employeeBaseSelect,
  workingScheduleDeepSelect,
} from "../../shared/selects/employeeDataSelect";

type EmployeeDbClient = any;

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
} satisfies Prisma.EmployeesInclude;

const employeeMutationSnapshotInclude = {
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
} satisfies Prisma.EmployeesInclude;

const employeeDetailSelect = {
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
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      },
    },
  },
  employeeDetails: true,
} satisfies Prisma.EmployeesSelect;

/** Menentukan client database aktif, default ke Prisma global. */
function getDb(db?: EmployeeDbClient) {
  return db ?? prisma;
}

/** Menjalankan operasi database karyawan dalam transaksi Prisma. */
export async function withEmployeeTransaction<T>(
  handler: (tx: any) => Promise<T>,
): Promise<T> {
  return prisma.$transaction((tx) => handler(tx));
}

/** Mengambil daftar karyawan mentah dari database. */
export async function findEmployees(
  params: {
    where: Prisma.EmployeesWhereInput;
    skip: number;
    take: number;
  },
  db?: EmployeeDbClient,
) {
  return getDb(db).employees.findMany({
    where: params.where,
    select: employeeBaseSelect,
    orderBy: { createdAt: "desc" },
    skip: params.skip,
    take: params.take,
  });
}

/** Menghitung total karyawan mentah berdasarkan filter query. */
export async function countEmployees(
  where: Prisma.EmployeesWhereInput,
  db?: EmployeeDbClient,
): Promise<number> {
  return getDb(db).employees.count({ where });
}

/** Mengambil detail karyawan mentah berdasarkan id. */
export async function findEmployeeById(id: string, db?: EmployeeDbClient) {
  return getDb(db).employees.findUnique({
    where: { id },
    select: employeeDetailSelect,
  });
}

/** Mengambil snapshot karyawan mentah untuk update/hapus. */
export async function findEmployeeMutationSnapshot(
  id: string,
  db?: EmployeeDbClient,
) {
  return getDb(db).employees.findUnique({
    where: { id },
    include: employeeMutationSnapshotInclude,
  });
}

/** Mengambil snapshot karyawan mentah hasil mutasi create/update. */
export async function findEmployeeWriteSnapshot(
  id: string,
  db?: EmployeeDbClient,
) {
  return getDb(db).employees.findUnique({
    where: { id },
    include: employeeWriteSelect,
  });
}

/** Mengambil user profile mentah untuk endpoint employees/me. */
export async function findUserProfileById(
  id: string,
  withEmployee: boolean,
  db?: EmployeeDbClient,
) {
  return getDb(db).users.findUnique({
    where: { id },
    select: {
      id: true,
      nip: true,
      rbacRole: {
        select: {
          id: true,
          key: true,
          name: true,
          isSystem: true,
          isActive: true,
          canAccessAdmin: true,
          permissions: {
            where: {
              isAllowed: true,
              resource: {
                isActive: true,
              },
            },
            orderBy: [
              {
                resource: {
                  groupName: "asc",
                },
              },
              {
                resource: {
                  name: "asc",
                },
              },
              {
                action: "asc",
              },
            ],
            select: {
              action: true,
              resource: {
                select: {
                  key: true,
                  name: true,
                  routePath: true,
                  groupName: true,
                  supportsApprove: true,
                },
              },
            },
          },
        },
      },
      employees: withEmployee
        ? {
            select: {
              id: true,
              fullName: true,
              address: true,
              email: true,
              phoneNumber: true,
              joinDate: true,
              userId: true,
              position: {
                select: {
                  id: true,
                  name: true,
                  gajiPokok: true,
                  isManagerial: true,
                  division: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          }
        : false,
    },
  });
}

/** Mengambil user mentah berdasarkan nip. */
export async function findUserByNip(
  nip: string,
  db?: EmployeeDbClient,
): Promise<Users | null> {
  return getDb(db).users.findUnique({ where: { nip } });
}

/** Mengambil user mentah berdasarkan nip selain id tertentu. */
export async function findUserByNipExcludingId(
  nip: string,
  userId: string,
  db?: EmployeeDbClient,
): Promise<Users | null> {
  return getDb(db).users.findFirst({
    where: {
      nip,
      NOT: { id: userId },
    },
  });
}

/** Mengambil karyawan mentah berdasarkan email. */
export async function findEmployeeByEmail(
  email: string,
  db?: EmployeeDbClient,
): Promise<Employees | null> {
  return getDb(db).employees.findUnique({ where: { email } });
}

/** Mengambil karyawan mentah berdasarkan email selain id tertentu. */
export async function findEmployeeByEmailExcludingId(
  email: string,
  employeeId: string,
  db?: EmployeeDbClient,
): Promise<Employees | null> {
  return getDb(db).employees.findFirst({
    where: {
      email,
      NOT: { id: employeeId },
    },
  });
}

/** Mengambil karyawan mentah berdasarkan nomor telepon. */
export async function findEmployeeByPhoneNumber(
  phoneNumber: string,
  db?: EmployeeDbClient,
): Promise<Employees | null> {
  return getDb(db).employees.findUnique({ where: { phoneNumber } });
}

/** Mengambil karyawan mentah berdasarkan nomor telepon selain id tertentu. */
export async function findEmployeeByPhoneNumberExcludingId(
  phoneNumber: string,
  employeeId: string,
  db?: EmployeeDbClient,
): Promise<Employees | null> {
  return getDb(db).employees.findFirst({
    where: {
      phoneNumber,
      NOT: { id: employeeId },
    },
  });
}

/** Mengambil posisi mentah berdasarkan id. */
export async function findPositionById(id: string, db?: EmployeeDbClient) {
  return getDb(db).positions.findUnique({ where: { id } });
}

/** Mengambil jadwal kerja mentah berdasarkan id. */
export async function findWorkingScheduleById(
  id: string,
  db?: EmployeeDbClient,
) {
  return getDb(db).workingSchedules.findUnique({ where: { id } });
}

/** Mengambil role RBAC mentah berdasarkan id. */
export async function findRbacRoleById(
  id: string,
  db?: EmployeeDbClient,
): Promise<Pick<RbacRoles, "id" | "isActive"> | null> {
  return getDb(db).rbacRoles.findUnique({
    where: { id },
    select: {
      id: true,
      isActive: true,
    },
  });
}

/** Mengambil role RBAC mentah berdasarkan key. */
export async function findRbacRoleByKey(
  key: string,
  db?: EmployeeDbClient,
): Promise<Pick<RbacRoles, "id" | "isActive"> | null> {
  return getDb(db).rbacRoles.findUnique({
    where: { key },
    select: {
      id: true,
      isActive: true,
    },
  });
}

/** Membuat user mentah baru di database. */
export async function createUser(
  data: Prisma.UsersUncheckedCreateInput,
  db?: EmployeeDbClient,
): Promise<Users> {
  return getDb(db).users.create({ data });
}

/** Membuat karyawan mentah baru di database. */
export async function createEmployee(
  data: Prisma.EmployeesUncheckedCreateInput,
  db?: EmployeeDbClient,
): Promise<Employees> {
  return getDb(db).employees.create({ data });
}

/** Membuat detail karyawan mentah baru di database. */
export async function createEmployeeDetails(
  data: Prisma.EmployeeDetailsUncheckedCreateInput,
  db?: EmployeeDbClient,
): Promise<EmployeeDetails> {
  return getDb(db).employeeDetails.create({ data });
}

/** Memperbarui user mentah di database. */
export async function updateUser(
  id: string,
  data: Prisma.UsersUncheckedUpdateInput,
  db?: EmployeeDbClient,
): Promise<Users> {
  return getDb(db).users.update({ where: { id }, data });
}

/** Memperbarui karyawan mentah di database. */
export async function updateEmployee(
  id: string,
  data: Prisma.EmployeesUncheckedUpdateInput,
  db?: EmployeeDbClient,
): Promise<Employees> {
  return getDb(db).employees.update({ where: { id }, data });
}

/** Upsert detail karyawan mentah di database. */
export async function upsertEmployeeDetails(
  employeeId: string,
  data: Prisma.EmployeeDetailsUncheckedUpdateInput,
  db?: EmployeeDbClient,
): Promise<EmployeeDetails> {
  return getDb(db).employeeDetails.upsert({
    where: { employeeId },
    update: data,
    create: {
      ...(data as Prisma.EmployeeDetailsUncheckedCreateInput),
      employeeId,
    },
  });
}

/** Menghapus detail karyawan mentah berdasarkan employeeId. */
export async function deleteEmployeeDetailsByEmployeeId(
  employeeId: string,
  db?: EmployeeDbClient,
) {
  return getDb(db).employeeDetails.deleteMany({ where: { employeeId } });
}

/** Menghapus karyawan mentah berdasarkan id. */
export async function deleteEmployeeById(
  id: string,
  db?: EmployeeDbClient,
): Promise<Employees> {
  return getDb(db).employees.delete({ where: { id } });
}

/** Menghapus user mentah berdasarkan id. */
export async function deleteUserById(
  id: string,
  db?: EmployeeDbClient,
): Promise<Users> {
  return getDb(db).users.delete({ where: { id } });
}

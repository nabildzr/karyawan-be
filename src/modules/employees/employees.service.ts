import * as argon2 from "argon2";
import type { Prisma } from "../../generated/prisma/client";
import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import { isValidEmail, isValidPhoneNumber } from "../../utils";
import {
  countEmployees,
  createEmployee,
  createEmployeeDetails,
  createUser,
  deleteEmployeeById,
  deleteEmployeeDetailsByEmployeeId,
  deleteUserById,
  findEmployeeByEmail,
  findEmployeeByEmailExcludingId,
  findEmployeeById,
  findEmployeeByPhoneNumber,
  findEmployeeByPhoneNumberExcludingId,
  findEmployeeMutationSnapshot,
  findEmployeeWriteSnapshot,
  findEmployees,
  findPositionById,
  findRbacRoleById,
  findRbacRoleByKey,
  findUserByNip,
  findUserByNipExcludingId,
  findUserProfileById,
  findWorkingScheduleById,
  updateEmployee,
  updateUser,
  upsertEmployeeDetails,
  withEmployeeTransaction,
} from "./employees.repository";
import type {
  EmployeeCreateBodyPayload,
  EmployeeListQueryPayload,
  EmployeeMeQueryPayload,
  EmployeeUpdateBodyPayload,
} from "./employees.schema";

/** Mendefinisikan alias tipe untuk SupportedRoleInput. */
type SupportedRoleInput =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CEO"
  | "MANAGER"
  | "HR"
  | "USER";

const LEGACY_ROLE_TO_RBAC_KEY: Record<SupportedRoleInput, string> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "SUPER_ADMIN",
  CEO: "CEO",
  MANAGER: "MANAGER",
  HR: "HR",
  USER: "USER",
};

/** Mengubah role lama menjadi key RBAC sesuai standar database. */
function mapLegacyRoleToRbacKey(role?: string | null) {
  if (!role) {
    return undefined;
  }

  const normalizedRole = role.toUpperCase() as SupportedRoleInput;
  return LEGACY_ROLE_TO_RBAC_KEY[normalizedRole];
}

/** Menormalkan query list karyawan agar aman dipakai untuk paginasi. */
function normalizeEmployeeListQuery(query: EmployeeListQueryPayload) {
  return {
    page: Math.max(1, Math.floor(Number(query.page ?? 1))),
    limit: Math.min(100, Math.max(1, Math.floor(Number(query.limit ?? 10)))),
    search: query.search?.trim() || undefined,
    positionId: query.positionId,
    divisionId: query.divisionId,
    workingSchedulesId: query.workingSchedulesId,
    role: query.role,
  };
}

/** Menentukan rbacRoleId final dari explicit role id atau fallback role lama. */
async function resolveRbacRoleId(
  params: {
    explicitRoleId?: string | null;
    fallbackLegacyRole?: SupportedRoleInput | null;
  },
  db?: any,
) {
  try {
    if (params.explicitRoleId !== undefined) {
      if (!params.explicitRoleId) {
        throw new Error("Bad Request: rbacRoleId tidak boleh kosong.");
      }

      const targetRole = await findRbacRoleById(params.explicitRoleId, db);

      if (!targetRole) {
        throw new Error("Not Found: Role RBAC tidak ditemukan.");
      }

      if (!targetRole.isActive) {
        throw new Error("Bad Request: Role RBAC sedang nonaktif.");
      }

      return targetRole.id;
    }

    const fallbackRole = (params.fallbackLegacyRole ?? "USER") as SupportedRoleInput;
    const roleKey = LEGACY_ROLE_TO_RBAC_KEY[fallbackRole] ?? "USER";

    const mappedRole = await findRbacRoleByKey(roleKey, db);

    if (!mappedRole) {
      throw new Error(`Not Found: Role RBAC default ${roleKey} tidak ditemukan.`);
    }

    if (!mappedRole.isActive) {
      throw new Error(`Bad Request: Role RBAC default ${roleKey} sedang nonaktif.`);
    }

    return mappedRole.id;
  } catch (error) {
    throw new Error(
      `Internal Server Error: Gagal memperbarui role RBAC. ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/** Memvalidasi referensi master data pada alur create karyawan. */
async function validateCreateReferences(employee: {
  positionId?: string | null;
  workingSchedulesId?: string | null;
}) {
  if (!employee.positionId) {
    throw new Error("Bad Request: Posisi harus dipilih.");
  }

  const positionExists = await findPositionById(employee.positionId);

  if (!positionExists) {
    throw new Error("Not Found: Posisi (Jabatan) tidak ditemukan di sistem.");
  }

  if (employee.workingSchedulesId) {
    const scheduleExists = await findWorkingScheduleById(employee.workingSchedulesId);

    if (!scheduleExists) {
      throw new Error(
        "Not Found: Jadwal Kerja yang dipilih tidak ditemukan di sistem.",
      );
    }
  }
}

/** Memvalidasi referensi master data pada alur update karyawan. */
async function validateUpdateReferences(employee?: {
  positionId?: string | null;
  workingSchedulesId?: string | null;
}) {
  if (!employee) {
    return;
  }

  if (employee.positionId) {
    const positionExists = await findPositionById(employee.positionId);

    if (!positionExists) {
      throw new Error("Not Found: Posisi (Jabatan) tidak ditemukan di sistem.");
    }
  }

  if (employee.workingSchedulesId) {
    const scheduleExists = await findWorkingScheduleById(employee.workingSchedulesId);

    if (!scheduleExists) {
      throw new Error(
        "Not Found: Jadwal Kerja yang dipilih tidak ditemukan di sistem.",
      );
    }
  }
}

/** Memvalidasi format email dan nomor telepon jika nilainya tersedia. */
function validateContactFormat(params: {
  email?: string | null;
  phoneNumber?: string | null;
}) {
  if (params.email && !isValidEmail(params.email)) {
    throw new Error("Bad Request: Format email tidak valid.");
  }

  if (params.phoneNumber && !isValidPhoneNumber(params.phoneNumber)) {
    throw new Error("Bad Request: Format nomor HP tidak valid.");
  }
}

/** Memastikan NIP, email, dan nomor telepon unik saat create karyawan. */
async function ensureCreateUniqueIdentity(params: {
  nip: string;
  email?: string | null;
  phoneNumber?: string | null;
}) {
  const [existingNip, existingEmail, existingPhone] = await Promise.all([
    findUserByNip(params.nip),
    params.email ? findEmployeeByEmail(params.email) : null,
    params.phoneNumber ? findEmployeeByPhoneNumber(params.phoneNumber) : null,
  ]);

  if (existingNip) {
    throw new Error(`Conflict: NIP ${params.nip} sudah digunakan.`);
  }

  if (existingEmail) {
    throw new Error(`Conflict: Email ${params.email} sudah terdaftar.`);
  }

  if (existingPhone) {
    throw new Error(`Conflict: Nomor HP ${params.phoneNumber} sudah terdaftar.`);
  }
}

/** Memastikan NIP, email, dan nomor telepon unik saat update karyawan. */
async function ensureUpdateUniqueIdentity(params: {
  existingUserId: string;
  employeeId: string;
  nip?: string;
  email?: string | null;
  phoneNumber?: string | null;
}) {
  const [dupNip, dupEmail, dupPhone] = await Promise.all([
    params.nip ? findUserByNipExcludingId(params.nip, params.existingUserId) : null,
    params.email
      ? findEmployeeByEmailExcludingId(params.email, params.employeeId)
      : null,
    params.phoneNumber
      ? findEmployeeByPhoneNumberExcludingId(params.phoneNumber, params.employeeId)
      : null,
  ]);

  if (dupNip) {
    throw new Error(`Conflict: NIP ${params.nip} sudah digunakan.`);
  }

  if (dupEmail) {
    throw new Error(`Conflict: Email ${params.email} sudah terdaftar.`);
  }

  if (dupPhone) {
    throw new Error(`Conflict: Nomor HP ${params.phoneNumber} sudah terdaftar.`);
  }
}

/** Mengambil daftar karyawan terpaginasi dengan dukungan filter query. */
async function getAll(query: EmployeeListQueryPayload) {
  const { page, limit, search, positionId, divisionId, workingSchedulesId, role } =
    normalizeEmployeeListQuery(query);

  const skip = (page - 1) * limit;
  const mappedRoleKey = mapLegacyRoleToRbacKey(role);

  const where: Prisma.EmployeesWhereInput = {
    ...(positionId && { positionId }),
    ...(divisionId && { divisionId }),
    ...(workingSchedulesId && { workingSchedulesId }),
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { user: { nip: { contains: search, mode: "insensitive" } } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(mappedRoleKey && { user: { rbacRole: { key: mappedRoleKey } } }),
  };

  const [data, total] = await Promise.all([
    findEmployees({
      where,
      skip,
      take: limit,
    }),
    countEmployees(where),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** Mengambil detail karyawan lengkap berdasarkan id. */
async function getById(id: string) {
  const employee = await findEmployeeById(id);

  if (!employee) {
    throw new Error("Not Found: Karyawan tidak ditemukan.");
  }

  return employee;
}

/** Mengambil profil user saat ini untuk endpoint employees/me. */
async function getMe(userId: string, options?: EmployeeMeQueryPayload) {
  const user = await findUserProfileById(userId, Boolean(options?.withEmployee));

  if (!user) {
    throw new Error("Not Found: User tidak ditemukan.");
  }

  const permissions = (user.rbacRole?.permissions ?? []).map(
    (permission: any) => ({
      action: permission.action,
      resourceKey: permission.resource.key,
      resourceName: permission.resource.name,
      resourceRoutePath: permission.resource.routePath,
      groupName: permission.resource.groupName,
      supportsApprove: permission.resource.supportsApprove,
    }),
  );

  return {
    ...user,
    role: user.rbacRole?.key ?? null,
    rbacRoleKey: user.rbacRole?.key ?? null,
    permissions,
  };
}

/** Membuat transaksi karyawan baru beserta akun user dan detail opsional. */
async function create(payload: EmployeeCreateBodyPayload, actor: AuditActor) {
  const { user, employee, details } = payload;

  const resolvedLegacyRole = (user.role as SupportedRoleInput | undefined) ?? "USER";
  const resolvedRbacRoleId = await resolveRbacRoleId({
    explicitRoleId: user.rbacRoleId,
    fallbackLegacyRole: resolvedLegacyRole,
  });

  await validateCreateReferences(employee);
  validateContactFormat({
    email: employee.email,
    phoneNumber: employee.phoneNumber,
  });

  await ensureCreateUniqueIdentity({
    nip: user.nip,
    email: employee.email,
    phoneNumber: employee.phoneNumber,
  });

  const generatedPassword = `P@ssw0rd${Math.floor(Math.random() * 10000)}`;
  console.log("Generated password for new employee:", generatedPassword);

  const hashedPassword = await argon2.hash(generatedPassword);

  return withEmployeeTransaction(async (tx) => {
    const createdUser = await createUser(
      {
        nip: user.nip,
        rbacRoleId: resolvedRbacRoleId,
        password: hashedPassword,
      },
      tx,
    );

    const createdEmployee = await createEmployee(
      {
        ...employee,
        userId: createdUser.id,
        positionId: employee.positionId,
        workingSchedulesId: employee.workingSchedulesId ?? null,
      },
      tx,
    );

    const createdDetails = details
      ? await createEmployeeDetails(
          {
            ...details,
            employeeId: createdEmployee.id,
          },
          tx,
        )
      : null;

    const result = await findEmployeeWriteSnapshot(createdEmployee.id, tx);

    await writeAuditLog({
      actor,
      action: "CREATE_EMPLOYEE",
      entity: "Employees",
      entityId: createdEmployee.id,
      changes: {
        before: null,
        after: {
          userId: createdUser.id,
          nip: createdUser.nip,
          employeeId: createdEmployee.id,
          fullName: createdEmployee.fullName,
          email: createdEmployee.email,
          phoneNumber: createdEmployee.phoneNumber,
          positionId: createdEmployee.positionId,
          workingSchedulesId: createdEmployee.workingSchedulesId,
          rbacRoleId: createdUser.rbacRoleId,
          details: createdDetails,
        },
      },
      db: tx as any,
    });

    return result;
  });
}

/** Memperbarui data karyawan, user, dan detail dalam satu transaksi. */
async function update(
  id: string,
  payload: EmployeeUpdateBodyPayload,
  actor: AuditActor,
) {
  const { user, employee, details } = payload;

  const existing = await findEmployeeMutationSnapshot(id);

  if (!existing) {
    throw new Error("Not Found: Karyawan tidak ditemukan.");
  }

  await validateUpdateReferences(employee);
  validateContactFormat({
    email: employee?.email,
    phoneNumber: employee?.phoneNumber,
  });

  await ensureUpdateUniqueIdentity({
    existingUserId: existing.userId,
    employeeId: id,
    nip: user?.nip,
    email: employee?.email,
    phoneNumber: employee?.phoneNumber,
  });

  return withEmployeeTransaction(async (tx) => {
    if (user && Object.keys(user).length > 0) {
      const nextUserData: Record<string, unknown> = { ...user };
      delete nextUserData.role;

      if (user.rbacRoleId !== undefined || user.role !== undefined) {
        const nextLegacyRole =
          (user.role as SupportedRoleInput | undefined) ??
          (existing.user.rbacRole?.key as SupportedRoleInput | undefined) ??
          "USER";

        const nextRbacRoleId = await resolveRbacRoleId(
          {
            explicitRoleId: user.rbacRoleId,
            fallbackLegacyRole: nextLegacyRole,
          },
          tx,
        );

        nextUserData.rbacRoleId = nextRbacRoleId;
      }

      await updateUser(existing.userId, nextUserData, tx);
    }

    if (employee && Object.keys(employee).length > 0) {
      await updateEmployee(id, employee, tx);
    }

    if (details && Object.keys(details).length > 0) {
      await upsertEmployeeDetails(id, details, tx);
    }

    const updatedEmployee = await findEmployeeWriteSnapshot(id, tx);

    await writeAuditLog({
      actor,
      action: "UPDATE_EMPLOYEE",
      entity: "Employees",
      entityId: id,
      changes: {
        before: {
          nip: existing.user.nip,
          rbacRoleId: existing.user.rbacRoleId,
          fullName: existing.fullName,
          email: existing.email,
          phoneNumber: existing.phoneNumber,
          positionId: existing.positionId,
          workingSchedulesId: existing.workingSchedulesId,
          details: existing.employeeDetails,
        },
        after: {
          nip: updatedEmployee?.user?.nip ?? existing.user.nip,
          rbacRoleId: updatedEmployee?.user?.rbacRoleId ?? existing.user.rbacRoleId,
          fullName: updatedEmployee?.fullName ?? existing.fullName,
          email: updatedEmployee?.email ?? existing.email,
          phoneNumber: updatedEmployee?.phoneNumber ?? existing.phoneNumber,
          positionId: updatedEmployee?.positionId ?? existing.positionId,
          workingSchedulesId:
            updatedEmployee?.workingSchedulesId ?? existing.workingSchedulesId,
          details: updatedEmployee?.employeeDetails ?? existing.employeeDetails,
        },
      },
      db: tx as any,
    });

    return updatedEmployee;
  });
}

/** Menghapus karyawan beserta akun user terkait dalam satu transaksi. */
async function remove(id: string, actor: AuditActor): Promise<void> {
  const existing = await findEmployeeMutationSnapshot(id);

  if (!existing) {
    throw new Error("Not Found: Karyawan tidak ditemukan.");
  }

  if (existing.user.id === actor.id) {
    throw new Error("Forbidden: Anda tidak dapat menghapus data diri sendiri.");
  }

  await withEmployeeTransaction(async (tx) => {
    await deleteEmployeeDetailsByEmployeeId(id, tx);
    await deleteEmployeeById(id, tx);
    await deleteUserById(existing.user.id, tx);

    await writeAuditLog({
      actor,
      action: "DELETE_EMPLOYEE",
      entity: "Employees",
      entityId: id,
      changes: {
        before: {
          userId: existing.user.id,
          nip: existing.user.nip,
          rbacRoleId: existing.user.rbacRoleId,
          rbacRoleKey: existing.user.rbacRole?.key ?? null,
          employeeId: existing.id,
          fullName: existing.fullName,
          email: existing.email,
          phoneNumber: existing.phoneNumber,
          positionId: existing.positionId,
          workingSchedulesId: existing.workingSchedulesId,
          details: existing.employeeDetails,
        },
        after: null,
      },
      db: tx as any,
    });
  });
}

/** Mengekspor EmployeeService untuk kebutuhan modul ini. */
export const EmployeeService = {
  getAll,
  getById,
  getMe,
  create,
  update,
  delete: remove,
};

// * File ini menangani seluruh validasi bisnis untuk module employees.

import { isValidEmail, isValidPhoneNumber } from "../../../utils";
import { EmployeeRepository } from "../repository";

export type SupportedRoleInput =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CEO"
  | "MANAGER"
  | "HR"
  | "USER";

export const LEGACY_ROLE_TO_RBAC_KEY: Record<SupportedRoleInput, string> = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "SUPER_ADMIN",
  CEO: "CEO",
  MANAGER: "MANAGER",
  HR: "HR",
  USER: "USER",
};

// & Map legacy role input to RBAC role key.
// % Ubah role lama menjadi key RBAC yang dipakai di database.
export const mapLegacyRoleToRbacKey = (role?: string | null) => {
  if (!role) return undefined;

  const normalizedRole = role.toUpperCase() as SupportedRoleInput;
  return LEGACY_ROLE_TO_RBAC_KEY[normalizedRole];
};

// & Resolve final RBAC role id from explicit roleId or legacy role fallback.
// % Tentukan rbacRoleId final dari explicit roleId atau fallback role lama.
export async function resolveRbacRoleId(params: {
  explicitRoleId?: string | null;
  fallbackLegacyRole?: SupportedRoleInput | null;
}) {
  try {
    // & Prioritize explicit role id when client sends rbacRoleId.
    // % Prioritaskan explicit role id ketika client mengirim rbacRoleId.
    if (params.explicitRoleId !== undefined) {
      if (!params.explicitRoleId) {
        throw new Error("Bad Request: rbacRoleId tidak boleh kosong.");
      }

      const targetRole = await EmployeeRepository.findRbacRoleById(
        params.explicitRoleId,
      );

      if (!targetRole) {
        throw new Error("Not Found: Role RBAC tidak ditemukan.");
      }

      if (!targetRole.isActive) {
        throw new Error("Bad Request: Role RBAC sedang nonaktif.");
      }

      return targetRole.id;
    }

    // & Fallback to legacy role mapping when explicit role is not provided.
    // % Gunakan fallback mapping role lama saat explicit role tidak tersedia.
    const fallbackRole = (params.fallbackLegacyRole ?? "USER") as SupportedRoleInput;
    const roleKey = LEGACY_ROLE_TO_RBAC_KEY[fallbackRole] ?? "USER";

    const mappedRole = await EmployeeRepository.findRbacRoleByKey(roleKey);

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

// & Validate reference master data on create flow.
// % Validasi referensi master data saat proses create.
export async function validateCreateReferences(employee: {
  positionId?: string | null;
  workingSchedulesId?: string | null;
}) {
  if (!employee.positionId) {
    throw new Error("Bad Request: Posisi harus dipilih.");
  }

  const positionExists = await EmployeeRepository.findPositionById(
    employee.positionId,
  );

  if (!positionExists) {
    throw new Error("Not Found: Posisi (Jabatan) tidak ditemukan di sistem.");
  }

  if (employee.workingSchedulesId) {
    const scheduleExists = await EmployeeRepository.findWorkingScheduleById(
      employee.workingSchedulesId,
    );

    if (!scheduleExists) {
      throw new Error(
        "Not Found: Jadwal Kerja yang dipilih tidak ditemukan di sistem.",
      );
    }
  }
}

// & Validate reference master data on update flow.
// % Validasi referensi master data saat proses update.
export async function validateUpdateReferences(employee?: {
  positionId?: string | null;
  workingSchedulesId?: string | null;
}) {
  if (!employee) return;

  if (employee.positionId) {
    const positionExists = await EmployeeRepository.findPositionById(
      employee.positionId,
    );

    if (!positionExists) {
      throw new Error("Not Found: Posisi (Jabatan) tidak ditemukan di sistem.");
    }
  }

  if (employee.workingSchedulesId) {
    const scheduleExists = await EmployeeRepository.findWorkingScheduleById(
      employee.workingSchedulesId,
    );

    if (!scheduleExists) {
      throw new Error(
        "Not Found: Jadwal Kerja yang dipilih tidak ditemukan di sistem.",
      );
    }
  }
}

// & Validate email and phone format if value exists.
// % Validasi format email dan nomor telepon jika nilainya ada.
export function validateContactFormat(params: {
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

// & Ensure unique NIP, email, and phone for create flow.
// % Pastikan NIP, email, dan nomor telepon unik saat create.
export async function ensureCreateUniqueIdentity(params: {
  nip: string;
  email?: string | null;
  phoneNumber?: string | null;
}) {
  const [existingNip, existingEmail, existingPhone] = await Promise.all([
    EmployeeRepository.findUserByNip(params.nip),
    params.email ? EmployeeRepository.findEmployeeByEmail(params.email) : null,
    params.phoneNumber
      ? EmployeeRepository.findEmployeeByPhoneNumber(params.phoneNumber)
      : null,
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

// & Ensure unique NIP, email, and phone for update flow while excluding current record.
// % Pastikan NIP, email, dan nomor telepon unik saat update dengan mengecualikan record sendiri.
export async function ensureUpdateUniqueIdentity(params: {
  existingUserId: string;
  employeeId: string;
  nip?: string;
  email?: string | null;
  phoneNumber?: string | null;
}) {
  const [dupNip, dupEmail, dupPhone] = await Promise.all([
    params.nip
      ? EmployeeRepository.findUserByNipExcludeUserId(
          params.nip,
          params.existingUserId,
        )
      : null,
    params.email
      ? EmployeeRepository.findEmployeeByEmailExcludeId(
          params.email,
          params.employeeId,
        )
      : null,
    params.phoneNumber
      ? EmployeeRepository.findEmployeeByPhoneNumberExcludeId(
          params.phoneNumber,
          params.employeeId,
        )
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

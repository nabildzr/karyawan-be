// * File ini menangani operasi write untuk module employees (create/update/delete).

import * as argon2 from "argon2";
import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import {
  CreateEmployeePayload,
  UpdateEmployeePayload,
} from "../model";
import { EmployeeRepository } from "../repository";
import {
  ensureCreateUniqueIdentity,
  ensureUpdateUniqueIdentity,
  resolveRbacRoleId,
  SupportedRoleInput,
  validateContactFormat,
  validateCreateReferences,
  validateUpdateReferences,
} from "./validation";

// & Create employee transaction that includes user account and optional details.
// % Buat transaksi karyawan lengkap beserta akun user dan detail opsional.
export async function CreateEmployeeTransaction(
  payload: CreateEmployeePayload,
  actor: AuditActor,
) {
  const { user, employee, details } = payload;

  // & Resolve target RBAC role id from explicit role or legacy fallback.
  // % Tentukan rbacRoleId target dari explicit role atau fallback role lama.
  const resolvedLegacyRole =
    (user.role as SupportedRoleInput | undefined) ?? "USER";
  const resolvedRbacRoleId = await resolveRbacRoleId({
    explicitRoleId: user.rbacRoleId,
    fallbackLegacyRole: resolvedLegacyRole,
  });

  // & Validate references and contact format before writing transaction.
  // % Validasi referensi dan format kontak sebelum menulis transaction.
  await validateCreateReferences(employee);
  validateContactFormat({
    email: employee.email,
    phoneNumber: employee.phoneNumber,
  });

  // & Ensure identity values are unique.
  // % Pastikan nilai identitas tidak duplikat.
  await ensureCreateUniqueIdentity({
    nip: user.nip,
    email: employee.email,
    phoneNumber: employee.phoneNumber,
  });

  // & Generate default password and hash it before insert.
  // % Generate password default lalu hash sebelum disimpan.
  const generatedPassword = `P@ssw0rd${Math.floor(Math.random() * 10000)}`;
  console.log("Generated password for new employee:", generatedPassword);

  const hashedPassword = await argon2.hash(generatedPassword);

  // & Execute atomic transaction: user -> employee -> details -> audit log.
  // % Jalankan transaction atomik: user -> employee -> details -> audit log.
  return EmployeeRepository.runTransaction(async (tx) => {
    const createdUser = await EmployeeRepository.createUser(tx, {
      nip: user.nip,
      rbacRoleId: resolvedRbacRoleId,
      password: hashedPassword,
    });

    const createdEmployee = await EmployeeRepository.createEmployee(tx, {
      ...employee,
      userId: createdUser.id,
      positionId: employee.positionId,
      workingSchedulesId: employee.workingSchedulesId ?? null,
    });

    const createdDetails = details
      ? await EmployeeRepository.createEmployeeDetails(tx, {
          ...details,
          employeeId: createdEmployee.id,
        })
      : null;

    const result = await EmployeeRepository.findEmployeeByIdForWriteResult(
      tx,
      createdEmployee.id,
    );

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

// & Update employee data, user data, and optional details in one transaction.
// % Update data karyawan, data user, dan detail opsional dalam satu transaction.
export async function UpdateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
  actor: AuditActor,
) {
  const { user, employee, details } = payload;

  // & Load existing employee snapshot for validation and audit before mutation.
  // % Ambil snapshot karyawan saat ini untuk validasi dan audit sebelum mutasi.
  const existing = await EmployeeRepository.findEmployeeByIdForMutation(id);

  if (!existing) {
    throw new Error("Not Found: Karyawan tidak ditemukan.");
  }

  // & Validate references and contact format only when values are provided.
  // % Validasi referensi dan format kontak hanya ketika nilai dikirim.
  await validateUpdateReferences(employee);
  validateContactFormat({
    email: employee?.email,
    phoneNumber: employee?.phoneNumber,
  });

  // & Ensure updated identity values stay unique excluding current record.
  // % Pastikan identitas hasil update tetap unik dengan mengecualikan record sendiri.
  await ensureUpdateUniqueIdentity({
    existingUserId: existing.userId,
    employeeId: id,
    nip: user?.nip,
    email: employee?.email,
    phoneNumber: employee?.phoneNumber,
  });

  return EmployeeRepository.runTransaction(async (tx) => {
    // & Update linked user account if user payload exists.
    // % Update akun user terkait jika payload user tersedia.
    if (user && Object.keys(user).length > 0) {
      const nextUserData: Record<string, unknown> = { ...user };
      delete nextUserData.role;

      if (user.rbacRoleId !== undefined || user.role !== undefined) {
        const nextLegacyRole =
          (user.role as SupportedRoleInput | undefined) ??
          (existing.user.rbacRole?.key as SupportedRoleInput | undefined) ??
          "USER";

        const nextRbacRoleId = await resolveRbacRoleId({
          explicitRoleId: user.rbacRoleId,
          fallbackLegacyRole: nextLegacyRole,
        });

        nextUserData.rbacRoleId = nextRbacRoleId;
      }

      await EmployeeRepository.updateUser(tx, existing.userId, nextUserData);
    }

    // & Update employee profile if employee payload exists.
    // % Update profil karyawan jika payload employee tersedia.
    if (employee && Object.keys(employee).length > 0) {
      await EmployeeRepository.updateEmployee(tx, id, employee);
    }

    // & Upsert employee details when detail payload exists.
    // % Upsert detail karyawan ketika payload detail tersedia.
    if (details && Object.keys(details).length > 0) {
      await EmployeeRepository.upsertEmployeeDetails(tx, id, details);
    }

    const updatedEmployee = await EmployeeRepository.findEmployeeByIdForWriteResult(
      tx,
      id,
    );

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
          rbacRoleId:
            updatedEmployee?.user?.rbacRoleId ?? existing.user.rbacRoleId,
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

// & Delete employee and linked user account in one transaction.
// % Hapus data karyawan beserta akun user terkait dalam satu transaction.
export async function DeleteEmployee(id: string, actor: AuditActor) {
  const existing = await EmployeeRepository.findEmployeeByIdForMutation(id);

  if (!existing) {
    throw new Error("Not Found: Karyawan tidak ditemukan.");
  }

  // & Protect actor from deleting their own account.
  // % Cegah actor menghapus akun dirinya sendiri.
  if (existing.user.id === actor.id) {
    throw new Error("Forbidden: Anda tidak dapat menghapus data diri sendiri.");
  }

  await EmployeeRepository.runTransaction(async (tx) => {
    // & Delete dependent records first to keep FK constraints valid.
    // % Hapus record turunan lebih dulu agar constraint FK tetap valid.
    await EmployeeRepository.deleteEmployeeDetailsByEmployeeId(tx, id);
    await EmployeeRepository.deleteEmployeeById(tx, id);
    await EmployeeRepository.deleteUserById(tx, existing.user.id);

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

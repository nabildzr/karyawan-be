// * File ini menangani operasi baca/listing karyawan (reporting/query side).

import { EmployeeRepository } from "../repository";
import { mapLegacyRoleToRbacKey } from "./validation";

// & Get paginated employee list with filters.
// % Ambil daftar karyawan dengan paginasi dan filter.
export async function GetAllEmployees({
  page = 1,
  limit = 10,
  search,
  positionId,
  divisionId,
  workingSchedulesId,
  role,
}: {
  page?: number;
  limit?: number;
  search?: string;
  positionId?: string;
  divisionId?: string;
  workingSchedulesId?: string;
  role?: string;
} = {}) {
  // & Build pagination offset for database query.
  // % Hitung offset paginasi untuk query database.
  const skip = (page - 1) * limit;

  // & Convert legacy role filter into RBAC role key.
  // % Ubah filter role lama menjadi RBAC role key.
  const mappedRoleKey = mapLegacyRoleToRbacKey(role);

  // & Compose dynamic where clause based on optional filters.
  // % Susun where clause dinamis berdasarkan filter opsional.
  const where = {
    ...(positionId && { positionId }),
    ...(divisionId && { divisionId }),
    ...(workingSchedulesId && { workingSchedulesId }),
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: "insensitive" as const } },
        { user: { nip: { contains: search, mode: "insensitive" as const } } },
        { email: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(mappedRoleKey && { user: { rbacRole: { key: mappedRoleKey } } }),
  };

  // & Execute list query and total count in parallel.
  // % Jalankan query list dan hitung total secara paralel.
  const [data, total] = await Promise.all([
    EmployeeRepository.findEmployees({ where, skip, take: limit }),
    EmployeeRepository.countEmployees(where),
  ]);

  // & Return list payload with pagination metadata.
  // % Kembalikan payload list beserta metadata paginasi.
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

// & Get full deep employee detail by id.
// % Ambil detail karyawan lengkap berdasarkan id.
export async function GetById(id: string) {
  const employee = await EmployeeRepository.findEmployeeDeepById(id);

  if (!employee) {
    throw new Error("Not Found: Karyawan tidak ditemukan.");
  }

  return employee;
}

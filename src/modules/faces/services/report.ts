// * File ini menangani operasi baca/report untuk module faces.

import { FaceRepository } from "../repository";
import { buildFaceSearchWhere } from "./validation";

const normalizeFaceUserRole = <T extends { user: { rbacRole?: { key?: string | null } | null } }>(
  item: T,
) => ({
  ...item,
  user: {
    ...item.user,
    role: item.user.rbacRole?.key ?? "USER",
  },
});

// & Check whether a user already has registered face data.
// % Cek apakah user sudah memiliki data wajah terdaftar.
export async function isFaceRegistered(userId: string) {
  const faceRecord = await FaceRepository.findFaceByUserId(userId);
  return Boolean(faceRecord);
}

// & Get paginated face list with optional search.
// % Ambil daftar wajah paginasi dengan pencarian opsional.
export async function getAllFaces({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const skip = (page - 1) * limit;
  const where = buildFaceSearchWhere(search);

  const [data, total] = await Promise.all([
    FaceRepository.findFaces({ where, skip, take: limit }),
    FaceRepository.countFaces(where),
  ]);

  const normalizedData = data.map((item) => normalizeFaceUserRole(item));

  return {
    data: normalizedData,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// & Get face detail by user id.
// % Ambil detail wajah berdasarkan user id.
export async function getFaceByUserId(userId: string) {
  const face = await FaceRepository.findFaceDetailByUserId(userId);

  if (!face) {
    throw new Error("Not Found: Data wajah tidak ditemukan.");
  }

  return normalizeFaceUserRole(face);
}

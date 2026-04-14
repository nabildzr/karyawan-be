// * File ini menangani validasi bisnis untuk module faces.

import { FaceRepository } from "../repository";

// & Ensure user exists for face operation.
// % Pastikan user ada untuk operasi wajah.
export async function ensureUserExists(userId: string) {
  const user = await FaceRepository.findUserById(userId);

  if (!user) {
    throw new Error("Not Found: User tidak ditemukan.");
  }

  return user;
}

// & Ensure user has not registered face yet.
// % Pastikan user belum mendaftarkan wajah.
export async function ensureFaceNotRegistered(userId: string) {
  const face = await FaceRepository.findFaceByUserId(userId);

  if (face) {
    throw new Error(
      "Conflict: Wajah untuk user ini sudah terdaftar. Silakan gunakan fitur Re-enroll jika ingin mengubah.",
    );
  }
}

// & Ensure user has existing face record.
// % Pastikan user sudah punya data wajah.
export async function ensureFaceRegistered(userId: string) {
  const face = await FaceRepository.findFaceByUserId(userId);

  if (!face) {
    throw new Error(
      "Not Found: Data wajah tidak ditemukan untuk user ini. Silakan lakukan registrasi terlebih dahulu.",
    );
  }

  return face;
}

// & Ensure actor cannot delete own face data.
// % Pastikan actor tidak bisa menghapus data wajah sendiri.
export function ensureCanDeleteFace(targetUserId: string, actorId: string) {
  if (targetUserId === actorId) {
    throw new Error("Forbidden: Anda tidak dapat menghapus data wajah diri sendiri.");
  }
}

// & Build search filter for face list endpoint.
// % Bentuk filter pencarian untuk endpoint daftar wajah.
export function buildFaceSearchWhere(search: string) {
  if (!search) {
    return undefined;
  }

  return {
    user: {
      employees: {
        OR: [
          {
            fullName: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        ],
      },
    },
  };
}

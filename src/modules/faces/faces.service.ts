import type { Prisma } from "../../generated/prisma/client";
import type { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/writeAudit";
import {
    countFaces,
    createFace,
    deleteFace as deleteFaceByUserId,
    findFaceByUserId,
    findFaceDetailByUserId,
    findFaces,
    findUserById,
    updateFace as updateFaceByUserId,
    type FaceRecord,
} from "./faces.repository";
import type {
    FaceAdminListQueryPayload,
    FaceListMetaPayload,
    FacePayload,
} from "./faces.schema";

const FLASK_URL = "http://127.0.0.1:5000/v1/faces/extract";

type FaceListResultPayload = {
  data: FacePayload[];
  meta: FaceListMetaPayload;
};

/** Memetakan data wajah mentah ke payload response endpoint. */
function toFacePayload(record: FaceRecord): FacePayload {
  return {
    userId: record.userId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    user: {
      id: record.user.id,
      nip: record.user.nip,
      rbacRole: record.user.rbacRole
        ? {
            key: record.user.rbacRole.key,
          }
        : null,
      employees: record.user.employees
        ? {
            fullName: record.user.employees.fullName,
            email: record.user.employees.email,
          }
        : null,
      role: record.user.rbacRole?.key ?? "USER",
    },
  };
}

/** Menormalisasi query daftar wajah agar aman untuk paginasi. */
function normalizeFaceListQuery(query: FaceAdminListQueryPayload) {
  const page = Math.max(1, Math.floor(Number(query.page ?? 1)));
  const limit = Math.max(1, Math.floor(Number(query.limit ?? 10)));
  const search = String(query.search ?? "").trim();

  return {
    page,
    limit,
    search,
  };
}

/** Membentuk where filter pencarian data wajah berdasarkan keyword. */
function buildFaceSearchWhere(search: string): Prisma.UserFacesWhereInput | undefined {
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
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      },
    },
  };
}

/** Memastikan user tersedia sebelum operasi wajah dijalankan. */
async function ensureUserExists(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error("Not Found: User tidak ditemukan.");
  }

  return user;
}

/** Memastikan user belum punya data wajah saat proses registrasi. */
async function ensureFaceNotRegistered(userId: string) {
  const face = await findFaceByUserId(userId);

  if (face) {
    throw new Error(
      "Conflict: Wajah untuk user ini sudah terdaftar. Silakan gunakan fitur Re-enroll jika ingin mengubah.",
    );
  }
}

/** Memastikan user sudah punya data wajah untuk update/hapus. */
async function ensureFaceRegistered(userId: string) {
  const face = await findFaceByUserId(userId);

  if (!face) {
    throw new Error(
      "Not Found: Data wajah tidak ditemukan untuk user ini. Silakan lakukan registrasi terlebih dahulu.",
    );
  }

  return face;
}

/** Memastikan actor tidak bisa menghapus data wajah milik dirinya sendiri. */
function ensureCanDeleteFace(targetUserId: string, actorId: string) {
  if (targetUserId === actorId) {
    throw new Error("Forbidden: Anda tidak dapat menghapus data wajah diri sendiri.");
  }
}

/** Mengekstrak vektor wajah dari Flask service lalu decode menjadi buffer biner. */
async function extractFaceBinary(imageFile: File): Promise<Buffer> {
  const formData = new FormData();
  formData.append("image", imageFile);

  const flaskResponse = await fetch(FLASK_URL, {
    method: "POST",
    body: formData,
  });

  const flaskData = await flaskResponse.json();

  if (!flaskResponse.ok) {
    throw new Error(
      `Flask AI Error: ${flaskData?.error || "Gagal mengekstrak wajah"}`,
    );
  }

  const base64String = flaskData.data.vector_base64;
  return Buffer.from(base64String, "base64");
}

/** Mengonversi buffer hasil ekstraksi ke format bytes yang kompatibel Prisma. */
function toPrismaBytes(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(buffer.length));
  bytes.set(buffer);
  return bytes;
}

/** Mengecek apakah user sudah memiliki data wajah terdaftar. */
async function isFaceRegistered(userId: string): Promise<boolean> {
  const faceRecord = await findFaceByUserId(userId);
  return Boolean(faceRecord);
}

/** Mengambil daftar wajah terpaginasi dengan dukungan pencarian opsional. */
async function getAllFaces(query: FaceAdminListQueryPayload): Promise<FaceListResultPayload> {
  const { page, limit, search } = normalizeFaceListQuery(query);
  const skip = (page - 1) * limit;
  const where = buildFaceSearchWhere(search);

  const [data, total] = await Promise.all([
    findFaces({
      skip,
      take: limit,
      where,
    }),
    countFaces(where),
  ]);

  return {
    data: data.map(toFacePayload),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** Mengambil detail wajah berdasarkan user id. */
async function getFaceByUserId(userId: string): Promise<FacePayload> {
  const face = await findFaceDetailByUserId(userId);

  if (!face) {
    throw new Error("Not Found: Data wajah tidak ditemukan.");
  }

  return toFacePayload(face);
}

/** Mendaftarkan data wajah user baru lalu mencatat audit log. */
async function registerFace(
  userId: string,
  imageFile: File,
  actor: AuditActor,
): Promise<void> {
  await ensureUserExists(userId);
  await ensureFaceNotRegistered(userId);

  const binaryFaceData = await extractFaceBinary(imageFile);
  const savedFace = await createFace({
    userId,
    faceData: toPrismaBytes(binaryFaceData),
  });

  await writeAuditLog({
    actor,
    action: "REGISTER_FACE",
    entity: "UserFaces",
    entityId: savedFace.id,
    changes: {
      before: null,
      after: {
        userId: savedFace.userId,
        createdAt: savedFace.createdAt,
      },
    },
  });
}

/** Memperbarui data wajah user lalu mencatat audit log. */
async function updateFace(
  userId: string,
  imageFile: File,
  actor: AuditActor,
): Promise<void> {
  await ensureUserExists(userId);
  const existingFace = await ensureFaceRegistered(userId);

  const binaryFaceData = await extractFaceBinary(imageFile);
  const updatedFace = await updateFaceByUserId(userId, {
    faceData: toPrismaBytes(binaryFaceData),
  });

  await writeAuditLog({
    actor,
    action: "UPDATE_FACE",
    entity: "UserFaces",
    entityId: updatedFace.id,
    changes: {
      before: {
        userId: existingFace.userId,
        createdAt: existingFace.createdAt,
        updatedAt: existingFace.updatedAt,
      },
      after: {
        userId: updatedFace.userId,
        createdAt: updatedFace.createdAt,
        updatedAt: updatedFace.updatedAt,
      },
    },
  });
}

/** Menghapus data wajah user lalu mencatat audit log. */
async function deleteFace(userId: string, actor: AuditActor): Promise<void> {
  const existing = await ensureFaceRegistered(userId);
  ensureCanDeleteFace(userId, actor.id);

  await deleteFaceByUserId(userId);

  await writeAuditLog({
    actor,
    action: "DELETE_FACE",
    entity: "UserFaces",
    entityId: existing.id,
    changes: {
      before: {
        userId: existing.userId,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      },
      after: null,
    },
  });
}

/** Mengekspor FaceService untuk kebutuhan modul ini. */
export const FaceService = {
  registerFace,
  updateFace,
  isFaceRegistered,
  getAllFaces,
  getFaceByUserId,
  deleteFace,
};

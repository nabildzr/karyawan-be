// * File ini menangani operasi tulis untuk module faces.

import { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { FaceRepository } from "../repository";
import {
    ensureCanDeleteFace,
    ensureFaceNotRegistered,
    ensureFaceRegistered,
    ensureUserExists,
} from "./validation";

const FLASK_URL = "http://127.0.0.1:5000/v1/faces/extract";

// & Extract face vector from Flask service and decode to binary buffer.
// % Ekstrak vektor wajah dari service Flask lalu decode ke buffer biner.
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

// & Register face data for a user.
// % Daftarkan data wajah untuk user.
export async function registerFace(
  userId: string,
  imageFile: File,
  actor: AuditActor,
) {
  await ensureUserExists(userId);
  await ensureFaceNotRegistered(userId);

  const binaryFaceData = await extractFaceBinary(imageFile);
  const savedFace = await FaceRepository.createFace(userId, binaryFaceData);

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

  return savedFace;
}

// & Update existing face data for a user.
// % Perbarui data wajah yang sudah ada untuk user.
export async function updateFace(
  userId: string,
  imageFile: File,
  actor: AuditActor,
) {
  await ensureUserExists(userId);
  const existingFace = await ensureFaceRegistered(userId);

  const binaryFaceData = await extractFaceBinary(imageFile);
  const updatedFace = await FaceRepository.updateFace(userId, binaryFaceData);

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

  return updatedFace;
}

// & Delete face data by user id.
// % Hapus data wajah berdasarkan user id.
export async function deleteFace(userId: string, actor: AuditActor) {
  const existing = await ensureFaceRegistered(userId);
  ensureCanDeleteFace(userId, actor.id);

  await FaceRepository.deleteFace(userId);

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

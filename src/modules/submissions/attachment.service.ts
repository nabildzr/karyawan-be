// * File ini menangani upload dan validasi lampiran pengajuan.
// & Handles attachment validation and Cloudinary upload/delete operations.
// % Menangani validasi lampiran dan operasi upload/hapus ke Cloudinary.

import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary";
import { getCloudinaryClient, getSubmissionAttachmentFolder } from "../../config/cloudinary";

export const ALLOWED_SUBMISSION_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

const ALLOWED_MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
};

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export type SubmissionUploadedAttachment = {
  url: string;
  publicId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

function normalizeOriginalFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop() ?? "attachment";

  return baseName
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120);
}

function getLowercaseExtension(fileName: string) {
  const parts = fileName.split(".");
  if (parts.length < 2) {
    return "";
  }

  return parts.pop()?.toLowerCase() ?? "";
}

function validateFileSignature(file: File, bytes: Uint8Array) {
  if (file.type === "application/pdf") {
    const isPdf =
      bytes.length >= 4 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46;

    if (!isPdf) {
      throw new Error("Bad Request: Signature file PDF tidak valid.");
    }

    return;
  }

  if (file.type === "image/jpeg") {
    const isJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    if (!isJpeg) {
      throw new Error("Bad Request: Signature file JPG/JPEG tidak valid.");
    }

    return;
  }

  if (file.type === "image/png") {
    const isPng =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    if (!isPng) {
      throw new Error("Bad Request: Signature file PNG tidak valid.");
    }

    return;
  }

  throw new Error("Bad Request: Tipe file lampiran tidak didukung.");
}

async function toFileBuffer(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  validateFileSignature(file, bytes);

  return Buffer.from(arrayBuffer);
}

function validateSubmissionAttachment(file: File) {
  if (!ALLOWED_SUBMISSION_MIME_TYPES.includes(file.type as any)) {
    throw new Error("Bad Request: Lampiran hanya mendukung PDF, JPG, atau PNG.");
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("Bad Request: Ukuran lampiran maksimal 10MB.");
  }

  if (!file.name || file.name.includes("\u0000")) {
    throw new Error("Bad Request: Nama file lampiran tidak valid.");
  }

  const normalizedName = normalizeOriginalFileName(file.name);
  const extension = getLowercaseExtension(normalizedName);
  const allowedExtensions = ALLOWED_MIME_TO_EXTENSIONS[file.type] ?? [];

  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error("Bad Request: Ekstensi file tidak sesuai tipe lampiran.");
  }

  return normalizedName;
}

function uploadBufferToCloudinary(
  buffer: Buffer,
  fileName: string,
  userId: string,
): Promise<UploadApiResponse> {
  const cloudinary = getCloudinaryClient();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: getSubmissionAttachmentFolder(),
        resource_type: "auto",
        public_id: `${userId}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        display_name: fileName,
        overwrite: false,
        use_filename: false,
        unique_filename: false,
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary tidak mengembalikan hasil upload."));
          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });
}

export async function uploadSubmissionAttachment(
  file: File,
  userId: string,
): Promise<SubmissionUploadedAttachment> {
  const normalizedName = validateSubmissionAttachment(file);
  const fileBuffer = await toFileBuffer(file);

  try {
    const uploadResult = await uploadBufferToCloudinary(fileBuffer, normalizedName, userId);

    return {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      originalName: normalizedName,
      mimeType: file.type,
      sizeBytes: file.size,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    throw new Error("Internal Server Error: Gagal mengunggah lampiran ke Cloudinary.");
  }
}

export async function deleteSubmissionAttachment(publicId: string) {
  const cloudinary = getCloudinaryClient();

  const destroyAsImage = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  if (destroyAsImage.result === "ok") {
    return;
  }

  const destroyAsRaw = await cloudinary.uploader.destroy(publicId, {
    resource_type: "raw",
    invalidate: true,
  });

  if (destroyAsRaw.result === "ok" || destroyAsRaw.result === "not found") {
    return;
  }

  if (destroyAsImage.result === "not found" && destroyAsRaw.result === "not found") {
    return;
  }

  throw new Error("Internal Server Error: Gagal menghapus lampiran dari Cloudinary.");
}

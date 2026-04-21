// * File ini menangani verifikasi wajah untuk kebutuhan absensi.
// & Provides face verification and caption generation for attendance checks.
// % Menyediakan verifikasi wajah dan caption image untuk validasi absensi.

import { FLASK_MATCH_URL } from "../../../config/externalApi";
import {
  FALLBACK_HF_BLIP_URL,
  HF_API_TOKEN,
  HF_BLIP_URL,
} from "../../../config/huggingface";
import prisma from "../../../config/prisma";

type BlipPayload =
  | {
      generated_text?: string;
      error?: string;
    }
  | Array<{
      generated_text?: string;
    }>
  | null;

// & Normalize BLIP payload into a single caption string.
// % Normalisasi payload BLIP menjadi satu string caption.
const extractCaptionFromPayload = (payload: BlipPayload): string | null => {
  if (
    Array.isArray(payload) &&
    typeof payload[0]?.generated_text === "string"
  ) {
    return payload[0].generated_text;
  }

  if (
    payload &&
    !Array.isArray(payload) &&
    typeof payload.generated_text === "string"
  ) {
    return payload.generated_text;
  }

  return null;
};

// & Decide whether BLIP request should be retried using fallback endpoint.
// % Tentukan apakah request BLIP perlu dicoba ulang lewat endpoint fallback.
const shouldRetryWithFallback = (
  requestedUrl: string,
  status: number,
  payload: BlipPayload,
) => {
  if (requestedUrl === FALLBACK_HF_BLIP_URL) {
    return false;
  }

  if (status === 404 || status === 410) {
    return true;
  }

  if (payload && !Array.isArray(payload) && typeof payload.error === "string") {
    const normalizedError = payload.error.toLowerCase();
    return normalizedError.includes("model not supported by provider hf-inference");
  }

  return false;
};

// & Verify live face image against enrolled face template for attendance.
// % Verifikasi wajah live terhadap template wajah terdaftar untuk absensi.
/** Mengekspor verifyFaceForAttendance untuk kebutuhan modul ini. */
export const verifyFaceForAttendance = async (
  userId: string,
  liveImageFile: File,
) => {
  // & Load enrolled face data from database.
  // % Ambil data wajah yang sudah didaftarkan dari database.
  const userFace = await prisma.userFaces.findUnique({
    where: { userId: userId },
  });

  if (!userFace) {
    throw new Error(
      "Forbidden: Anda belum melakukan registrasi wajah (Face Enrollment).",
    );
  }

  const registeredBase64 = Buffer.from(userFace.faceData).toString("base64");

  // & Build multipart payload for Flask matching API.
  // % Susun payload multipart untuk API pencocokan Flask.
  const formData = new FormData();
  formData.append("image", liveImageFile);
  formData.append("registered_face", registeredBase64);

  // & Call external Flask service for face matching.
  // % Panggil service Flask eksternal untuk pencocokan wajah.
  const flaskResponse = await fetch(FLASK_MATCH_URL, {
    method: "POST",
    body: formData,
  });

  const flaskData = await flaskResponse.json();

  if (!flaskResponse.ok) {
    throw new Error(
      `Flask AI Error: ${flaskData.error || "Gagal menganalisis wajah"}`,
    );
  }

  const { is_match, confidence_percentage } = flaskData.data;

  return {
    isMatch: !!is_match,
    confidence: Number(confidence_percentage ?? 0),
  };
};

// & Generate BLIP caption text from captured image.
// % Generate teks caption BLIP dari gambar hasil capture.
/** Mengekspor generateBlipCaption untuk kebutuhan modul ini. */
export const generateBlipCaption = async (imageFile: File) => {
  try {
    // & Prepare request headers and optional token.
    // % Siapkan header request dan token opsional.
    const headers: Record<string, string> = {
      "Content-Type": imageFile.type || "image/jpeg",
    };

    if (HF_API_TOKEN) {
      headers.Authorization = `Bearer ${HF_API_TOKEN}`;
    }

    // & Send BLIP request and parse response payload safely.
    // % Kirim request BLIP dan parse payload response dengan aman.
    const requestCaption = async (url: string) => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: imageFile,
      });

      const payload = (await response.json().catch(() => null)) as BlipPayload;
      return { response, payload };
    };

    let { response, payload } = await requestCaption(HF_BLIP_URL);

    // & Auto retry with fallback endpoint for unsupported provider/model errors.
    // % Coba ulang otomatis ke endpoint fallback saat provider/model tidak didukung.
    if (shouldRetryWithFallback(HF_BLIP_URL, response.status, payload)) {
      const fallbackResult = await requestCaption(FALLBACK_HF_BLIP_URL);
      response = fallbackResult.response;
      payload = fallbackResult.payload;
    }

    if (!response.ok) {
      if (response.status === 404 || response.status === 410) {
        throw new Error(
          "Bad Request: Endpoint model caption AI tidak tersedia. Aktifkan fallback validasi aksesori atau gunakan model URL lain via HF_BLIP_URL.",
        );
      }

      const message =
        payload && !Array.isArray(payload) && typeof payload.error === "string"
          ? payload.error
          : "Gagal menganalisis caption gambar.";
      throw new Error(`Bad Request: ${message}`);
    }

    const caption = extractCaptionFromPayload(payload);
    if (caption) {
      return { caption };
    }

    throw new Error("Bad Request: Response caption dari BLIP tidak valid.");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Bad Request")) {
      throw error;
    }

    throw new Error(
      "Bad Request: Layanan caption AI sedang tidak tersedia. Silakan lanjutkan dengan mode fallback atau konfigurasi ulang HF_BLIP_URL.",
    );
  }
};

// & Verify face match and return confidence payload for attendance flow.
// % Verifikasi kecocokan wajah dan kembalikan payload confidence untuk flow absensi.
/** Mengekspor verifyFace untuk kebutuhan modul ini. */
export const verifyFace = async (userId: string, liveImageFile: File) => {
  const faceMatch = await verifyFaceForAttendance(userId, liveImageFile);

  if (!faceMatch.isMatch) {
    throw new Error(
      `Unauthorized: Wajah tidak cocok! (Kemiripan hanya ${faceMatch.confidence}%)`,
    );
  }

  return {
    confidence: faceMatch.confidence,
    photoBase64: null as string | null,
  };
};

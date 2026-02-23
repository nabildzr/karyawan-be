import prisma from "../../config/prisma";

const FLASK_MATCH_URL = "http://127.0.0.1:5000/v1/faces/match";

export const AttendanceService = {
  async verifyFaceCheckIn(userId: string, liveImageFile: File) {
    // ? 1. cek apakah user udah pernah registrasi wajah
    const userFace = await prisma.userFaces.findUnique({ where: { userId } });
    
    if (!userFace) {
      throw new Error("Forbidden: Anda belum melakukan registrasi wajah (Face Enrollment).");
    }

    // ? 2. konversi binary (ByteA) dari Postgres balik ke Base64
    const registeredBase64 = Buffer.from(userFace.faceData).toString("base64");

    // ? 3. siapin payload ke Flask
    const formData = new FormData();
    formData.append("image", liveImageFile);
    formData.append("registered_face", registeredBase64); // Kirim string Base64 ke Flask

    // ? 4. tembak Microservice Flask
    const flaskResponse = await fetch(FLASK_MATCH_URL, {
      method: "POST",
      body: formData,
    });

    const flaskData = await flaskResponse.json();

    if (!flaskResponse.ok) {
      throw new Error(`Flask AI Error: ${flaskData.error || 'Gagal menganalisis wajah'}`);
    }

    const { is_match, distance, confidence_percentage } = flaskData.data;

    // ? 5. validasi keputusan Flask
    if (!is_match) {
      throw new Error(`Unauthorized: Wajah tidak cocok! (Kemiripan hanya ${confidence_percentage}%)`);
    }

    // & === kalau lolos sampai sini, berarti WAJAH COCOK ===
    // ? di sinilah kta masukin logic insert ke tabel `Attendances`
    // TODO ? (misal: hitung geofence, bandingin jam shift, set status LATE/PRESENT, dll)

    return {
      success: true,
      message: "Verifikasi wajah berhasil.",
      confidence: confidence_percentage
    };
  }
};
import prisma from "../../config/prisma";

// ? FLASK ENDPOINT
const FLASK_URL = "http://127.0.0.1:5000/v1/faces/extract"; 

export const FaceService = {
  async registerFace(userId: string, imageFile: File) {
    // ? 1. validasi: pastiin user beneran ada dan belum punya data wajah
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Not Found: User tidak ditemukan.");

    const existingFace = await prisma.userFaces.findUnique({ where: { userId } });
    if (existingFace) throw new Error("Conflict: Wajah untuk user ini sudah terdaftar. Silakan gunakan fitur Re-enroll jika ingin mengubah.");

    // ? 2. siapin FormData buat dilempar ke Flask
    const formData = new FormData();
    formData.append("image", imageFile);

    // ? 3. panggil Microservice Flask (Inter-service Communication)
    const flaskResponse = await fetch(FLASK_URL, {
      method: "POST",
      body: formData,
    });

    const flaskData = await flaskResponse.json();

    if (!flaskResponse.ok) {
      throw new Error(`Flask AI Error: ${flaskData.error || 'Gagal mengekstrak wajah'}`);
    }

    const base64String = flaskData.data.vector_base64;

    // ? 4. DECODE BASE64 KE BINARY
    // ! ini ajaibnya kita ubah teks random panjang tadi jadi format ByteA murni
    const binaryFaceData = Buffer.from(base64String, "base64");

    // ? 5. simpan ke postgreSQL
    const savedFace = await prisma.userFaces.create({
      data: {
        userId: userId,
        faceData: binaryFaceData,
      },
    });

    return savedFace;
  }
};
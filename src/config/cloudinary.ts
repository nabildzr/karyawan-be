// * Backend module: karyawan-be/src/config/cloudinary.ts
// & This file defines backend logic for cloudinary.ts.
// % File ini mendefinisikan logika backend untuk cloudinary.ts.

import { v2 as cloudinary } from "cloudinary";

// & A flag to track whether Cloudinary has been configured to prevent redundant configuration.
// % Sebuah flag untuk melacak apakah Cloudinary telah dikonfigurasi untuk mencegah konfigurasi yang redundan.
let isConfigured = false;

// & This function initializes and returns the Cloudinary client instance, ensuring it's configured only once.
// % Fungsi ini menginisialisasi dan mengembalikan instance klien Cloudinary, memastikan hanya dikonfigurasi sekali.
export function getCloudinaryClient() {
  // % Memastikan bahwa Cloudinary hanya dikonfigurasi sekali untuk menghindari overhead konfigurasi berulang.
  if (isConfigured) {
    return cloudinary;
  }

  // & Validate that the CLOUDINARY_URL environment variable is set before configuring Cloudinary.
  // % Validasi bahwa variabel lingkungan (env) CLOUDINARY_URL telah diatur sebelum mengonfigurasi Cloudinary.
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (!cloudinaryUrl) {
    throw new Error(
      "Bad Request: CLOUDINARY_URL belum dikonfigurasi pada environment server.",
    );
  }

  // & Configure Cloudinary with the provided URL and enforce secure connections.
  // % Konfigurasikan Cloudinary dengan URL yang diberikan dan paksa koneksi yang aman.
  cloudinary.config({
    cloudinary_url: cloudinaryUrl,
    secure: true,
  });

  // & Set the configuration flag to true to prevent future redundant configurations.
  // % Setel flag konfigurasi ke true untuk mencegah konfigurasi berulang di masa depan.
  isConfigured = true;
  return cloudinary;
}

// & This function retrieves the Cloudinary folder path for submission attachments from environment variables, with a default fallback.
// % Fungsi ini mengambil path folder Cloudinary untuk lampiran pengajuan dari variabel lingkungan (env), dengan fallback default.
export function getSubmissionAttachmentFolder() {
  // ? Folder pengajuan
  return process.env.CLOUDINARY_SUBMISSIONS_FOLDER || "karyawan/submissions";
}

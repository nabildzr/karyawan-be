// * Backend module: karyawan-be/src/config/constants.ts
// & This file defines backend logic for constants.ts.
// % File ini mendefinisikan logika backend untuk constants.ts.

/** Mengekspor constants untuk kebutuhan modul ini. */
export const constants = {
  // & Define server metadata constants for application identification and contact information.
  // % Mendefinisikan konstanta metadata server untuk identifikasi aplikasi dan informasi kontak.
  server: {
    name: "Karyawan Backend",
    author: "Nabildzr",
    version: "1.0.0",
    email: "nabildzikrika@gmail.com",
  },
  // & Define API versioning constants for consistent endpoint structuring.
  // % Mendefinisikan konstanta versioning API untuk struktur endpoint yang konsisten.
  // ? (Tidak disarankan untuk versioning yang lebih kompleks, tapi cukup untuk kebutuhan saat ini)
  api: {
    versionPrefix: "/v",
    version: 1,
  },
  // & Define authentication-related constants such as JWT secret, token expiration, and password requirements.
  // % Mendefinisikan konstanta terkait otentikasi seperti rahasia JWT, masa berlaku token, dan persyaratan kata sandi.
  auth: {
    jwtSecret: process.env.JWT_SECRET || "kepo",
    jwtMaxAge: 7, // days
    passwordMinLength: 8,
  },
  // & Define pagination defaults and limits for API responses.
  // % Mendefinisikan default dan batas pagination untuk respons API.
  pagination: {
    defaultLimit: 25,
    maxLimit: 100,
  },
};

/** Mengekspor RedisKeys untuk kebutuhan modul ini. */
export const RedisKeys = {
  USER: (userId: string) => `user:${userId}`,
  USERS: "users",
  EMPLOYEE: (id: string) => `employee:${id}`,
  EMPLOYEES: "employees",
};

import Elysia from "elysia";
import { constants } from "../config/constants";
import * as jose from "jose";

// & ============ Types ============
export interface JWTPayload {
  employeeId: string;
  email: string;
  role: "ADMIN" | "USER";
  iat?: number;
  exp?: number;
}

// & ============ JWT Helper ============
async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, secretKey);
  return payload as unknown as JWTPayload;
}

// & ============ Auth Plugin (WITH HYBRID TOKEN ) ============
/**
 * Elysia plugin yang meng-derive `auth` context dari Bearer token.
 * TIDAK memblokir request tanpa token (auth = null).
 * Gunakan `checkAuth` / `checkAdmin` di beforeHandle untuk enforce.
 */
export const authPlugin = new Elysia({ name: "auth-plugin" }).derive(
  { as: "scoped" },
  async ({
    headers,
    cookie: { auth_session },
  }): Promise<{ auth: JWTPayload | null }> => {
    let token = "";
    const authHeader = headers.authorization;

    // ? skenario mobile (flutter): cek header bearer
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // ? skenario web (nextjs): cek HTTP-Only Cookie
    else if (auth_session?.value) {
      token = auth_session.value as string;
    }

    // ? klo token ada, verifikasi pake jose
    try {
      const payload = await verifyJWT(token, constants.auth.jwtSecret);
      return { auth: payload };
    } catch {
      // ? token expired ato invalid signature
      return { auth: null };
    }
  },
);

// & ============ beforeHandle Guards ============

/**
 * beforeHandle: Wajib login (token valid).
 * Cocok untuk route yang bisa diakses semua user yang sudah login.
 *
 * Mengembalikan response langsung (short-circuit) jika tidak ada token,
 * sehingga error response selalu berupa JSON.
 */
export const checkAuth = ({ auth, set }: any) => {
  if (!auth) {
    set.status = 401;
    return {
      success: false as const,
      message: "Token diperlukan untuk mengakses resource ini",
    };
  }
};

/**
 * beforeHandle: Wajib login + role ADMIN.
 * Cocok untuk route CRUD master data yang hanya boleh admin.
 */
export const checkAdmin = ({ auth, set }: any) => {
  if (!auth) {
    set.status = 401;
    return {
      success: false as const,
      message: "Token diperlukan untuk mengakses resource ini",
    };
  }
  if (auth.role !== "ADMIN") {
    set.status = 403;
    return {
      success: false as const,
      message: "Hanya admin yang dapat mengakses resource ini",
    };
  }
};

/**
 * beforeHandle factory: Wajib login + owner resource ATAU admin.
 * Cek apakah auth.employeeId === params[paramName].
 *
 * @param paramName - nama param yang berisi employeeId (default: "employeeId")
 */
export const checkOwnerOrAdmin =
  (paramName: string = "employeeId") =>
  ({ auth, params, set }: any) => {
    if (!auth) {
      set.status = 401;
      return {
        success: false as const,
        message: "Token diperlukan untuk mengakses resource ini",
      };
    }
    // Admin bisa akses semua
    if (auth.role === "ADMIN") return;

    // User biasa hanya bisa akses data sendiri
    const targetId = params?.[paramName];
    if (targetId && auth.employeeId !== targetId) {
      set.status = 403;
      return {
        success: false as const,
        message: "Anda hanya dapat mengakses data milik sendiri",
      };
    }
  };

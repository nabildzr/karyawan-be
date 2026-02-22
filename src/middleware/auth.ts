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

// & ============ Auth Plugin ============
/**
 * Elysia plugin yang meng-derive `auth` context dari Bearer token.
 * TIDAK memblokir request tanpa token (auth = null).
 * Gunakan `checkAuth` / `checkAdmin` di beforeHandle untuk enforce.
 */
export const authPlugin = new Elysia({ name: "auth-plugin" }).derive(
  { as: "scoped" },
  async ({ headers }): Promise<{ auth: JWTPayload | null }> => {
    const authHeader = headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return { auth: null };
    }

    try {
      const token = authHeader.slice(7);
      const payload = await verifyJWT(token, constants.auth.jwtSecret);
      return { auth: payload };
    } catch {
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

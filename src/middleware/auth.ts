// * Backend module: karyawan-be/src/middleware/auth.ts
// & This file defines backend logic for auth.ts.
// % File ini mendefinisikan logika backend untuk auth.ts.

import Elysia from "elysia";
import * as jose from "jose";
import { constants } from "../config/constants";
import prisma from "../config/prisma";
import { PermissionAction } from "../generated/prisma/enums";

// & ============ Types ============
/** Mendefinisikan kontrak data untuk interface JWTPayload. */
export interface JWTPayload {
  sub: string;
  employeeId?: string | null;
  email?: string | null;
  role?: string | null;
  rbacRoleKey?: string | null;
  iat?: number;
  exp?: number;
}

// & ============ JWT Helper ============
async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jose.jwtVerify(token, secretKey);
  return payload as unknown as JWTPayload;
}

const ADMIN_ROUTE_PREFIX = "/admin";
const API_VERSION_PREFIX_PATTERN = /^\/v\d+(?=\/|$)/;

const APPROVE_REQUIRED_PATH_PATTERNS: RegExp[] = [
  /^\/submissions\/[^/]+\/status$/,
];

const ADMIN_RESOURCE_ROUTE_MAP: Array<{
  apiPrefix: string;
  resourceKey: string;
}> = [
  { apiPrefix: "/audit-logs", resourceKey: "audit_logs" },
  { apiPrefix: "/assessment-categories", resourceKey: "assessment_categories" },
  { apiPrefix: "/attendances/manual", resourceKey: "manual_attendance" },
  {
    apiPrefix: "/attendances/admin/correct",
    resourceKey: "attendance_corrections",
  },
  { apiPrefix: "/attendances/admin", resourceKey: "attendances" },
  { apiPrefix: "/divisions", resourceKey: "divisions" },
  { apiPrefix: "/employees", resourceKey: "employees" },
  { apiPrefix: "/faces/admin", resourceKey: "faces" },
  { apiPrefix: "/holidays", resourceKey: "holidays" },
  { apiPrefix: "/positions", resourceKey: "positions" },
  { apiPrefix: "/submissions", resourceKey: "submissions" },
  { apiPrefix: "/working-schedules", resourceKey: "working_schedules" },
  { apiPrefix: "/rbac", resourceKey: "rbac" },
  { apiPrefix: "/assessments", resourceKey: "assessments" },
  { apiPrefix: "/points/admin", resourceKey: "points" },
];

function unauthorizedResponse(set: any) {
  set.status = 401;
  return {
    success: false as const,
    message: "Token diperlukan untuk mengakses resource ini",
  };
}

function forbiddenResponse(set: any, message: string) {
  set.status = 403;
  return {
    success: false as const,
    message,
  };
}

function methodToPermissionAction(method?: string): PermissionAction | null {
  switch ((method || "").toUpperCase()) {
    case "GET":
    case "HEAD":
      return PermissionAction.READ;
    case "POST":
      return PermissionAction.CREATE;
    case "PUT":
    case "PATCH":
      return PermissionAction.UPDATE;
    case "DELETE":
      return PermissionAction.DELETE;
    default:
      return null;
  }
}

function normalizePath(pathname: string) {
  const trimmed = pathname.trim().toLowerCase();
  if (!trimmed) return "/";

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

function stripApiVersionPrefix(pathname: string) {
  const normalized = normalizePath(pathname);
  const stripped = normalized.replace(API_VERSION_PREFIX_PATTERN, "");
  if (!stripped) return "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

function matchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resolveAdminResourceKey(pathname: string) {
  for (const route of ADMIN_RESOURCE_ROUTE_MAP) {
    if (matchesRoutePrefix(pathname, route.apiPrefix)) {
      return route.resourceKey;
    }
  }

  return null;
}

function resolveAdminRequiredAction(pathname: string, method?: string) {
  if (
    APPROVE_REQUIRED_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
  ) {
    return PermissionAction.APPROVE;
  }

  return methodToPermissionAction(method);
}

function getRequestPathname(request?: Request): string {
  if (!request) return "";

  try {
    return new URL(request.url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function resolveHrResourceKey(pathname: string): string | null {
  if (pathname.includes("/faces/")) {
    return "faces";
  }

  if (pathname.includes("/attendances/manual")) {
    return "manual_attendance";
  }

  if (pathname.includes("/attendances/admin/correct")) {
    return "attendance_corrections";
  }

  return null;
}

async function getUserAccessContext(userId: string) {
  return prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      rbacRole: {
        select: {
          id: true,
          key: true,
          isActive: true,
        },
      },
      employees: {
        select: {
          position: {
            select: {
              divisionId: true,
            },
          },
        },
      },
    },
  });
}

async function hasRolePermission(
  roleId: string,
  resourceKey: string,
  action: PermissionAction,
) {
  const permission = await prisma.rolePermissionActions.findFirst({
    where: {
      roleId,
      action,
      isAllowed: true,
      resource: {
        key: resourceKey,
        isActive: true,
      },
    },
    select: { id: true },
  });

  return Boolean(permission);
}

async function hasAnyAdminPortalAccess(roleId: string) {
  const permission = await prisma.rolePermissionActions.findFirst({
    where: {
      roleId,
      isAllowed: true,
      resource: {
        isActive: true,
        routePath: {
          startsWith: ADMIN_ROUTE_PREFIX,
        },
      },
    },
    select: { id: true },
  });

  return Boolean(permission);
}

async function hasGlobalEvaluationScope(roleId: string) {
  const permission = await prisma.rolePermissionActions.findFirst({
    where: {
      roleId,
      action: PermissionAction.READ,
      isAllowed: true,
      resource: {
        key: {
          in: ["assessment_categories", "assessment_reports"],
        },
        isActive: true,
      },
    },
    select: { id: true },
  });

  return Boolean(permission);
}

// & ============ Auth Plugin (WITH HYBRID TOKEN ) ============
/**
 * Elysia plugin yang meng-derive `auth` context dari Bearer token.
 * TIDAK memblokir request tanpa token (auth = null).
 * Gunakan `checkAuth` / `checkAdmin` di beforeHandle untuk enforce.
 */
// export const authPlugin = new Elysia({ name: "auth-plugin" }).derive(
//   { as: "scoped" },
//   async ({
//     headers,
//     cookie: { auth_session },
//   }): Promise<{ auth: JWTPayload | null }> => {
//     let token = "";
//     const authHeader = headers.authorization;

//     // ? skenario mobile (flutter): cek header bearer
//     if (authHeader?.startsWith("Bearer ")) {
//       token = authHeader.slice(7);
//     }

//     // ? skenario web (nextjs): cek HTTP-Only Cookie
//     else if (auth_session?.value) {
//       token = auth_session.value as string;
//     }

//     // ? klo token ada, verifikasi pake jose
//     try {
//       const payload = await verifyJWT(token, constants.auth.jwtSecret);
//       return { auth: payload };
//     } catch {
//       // ? token expired ato invalid signature
//       return { auth: null };
//     }
//   },
// );

export async function signJWT(payload: JWTPayload, secret: string) {
  // WAJIB ADA INI JUGA DI SIGN!
  const secretKey = new TextEncoder().encode(secret);

  return await new jose.SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey); // Pake secretKey yang udah di-encode
}

/** Mengekspor authPlugin untuk kebutuhan modul ini. */
export const authPlugin = new Elysia({ name: "auth-plugin" }).derive(
  { as: "scoped" },
  async ({
    headers,
    cookie: { auth_session },
  }): Promise<{ auth: JWTPayload | null }> => {
    let token = "";
    const authHeader = headers.authorization;

    // --- LOG DEBUGGING 1: Cek apakah request beneran bawa header ---
    console.log("[DEBUG 1] Raw Authorization Header:", authHeader);

    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7);
    } else if (auth_session?.value) {
      token = auth_session.value as string;
    }

    // --- LOG DEBUGGING 2: Cek hasil ekstraksi ---
    console.log(
      "[DEBUG 2] Extracted Token:",
      token ? "Dapet Tokennya!" : "KOSONG",
    );

    if (!token) {
      console.log("[DEBUG 3] Eksekusi dihentikan karena token kosong.");
      return { auth: null };
    }

    try {
      const payload = await verifyJWT(token, constants.auth.jwtSecret);
      // --- LOG DEBUGGING 4: Kalau sukses ---
      console.log("[DEBUG 4] Verifikasi Sukses! Payload:", payload);
      return { auth: payload as JWTPayload };
    } catch (error) {
      // --- LOG DEBUGGING 5: INI TERSANGKA UTAMANYA ---
      console.error("[DEBUG 5] JWT Verification Exception ->", error);
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
    return unauthorizedResponse(set);
  }
};

/**
 * beforeHandle: Wajib login + punya permission RBAC untuk area admin.
 */
export const checkAdmin = async ({ auth, request, set }: any) => {
  if (!auth) {
    return unauthorizedResponse(set);
  }

  const user = await getUserAccessContext(auth.sub);

  if (!user?.rbacRole?.id || user.rbacRole.isActive !== true) {
    return forbiddenResponse(
      set,
      "Role RBAC Anda belum ditetapkan atau sedang nonaktif",
    );
  }

  const apiPathname = stripApiVersionPrefix(getRequestPathname(request));
  const resourceKey = resolveAdminResourceKey(apiPathname);
  const requiredAction = resolveAdminRequiredAction(apiPathname, request?.method);

  if (resourceKey && requiredAction) {
    const hasResourceAccess = await hasRolePermission(
      user.rbacRole.id,
      resourceKey,
      requiredAction,
    );

    if (!hasResourceAccess) {
      return forbiddenResponse(
        set,
        `Role Anda tidak memiliki izin ${requiredAction} untuk resource ${resourceKey}`,
      );
    }

    return;
  }

  const hasPortalAccess = await hasAnyAdminPortalAccess(user.rbacRole.id);
  if (!hasPortalAccess) {
    return forbiddenResponse(set, "Role Anda tidak memiliki akses ke portal admin");
  }
};

/**
 * beforeHandle: Wajib login + punya permission RBAC untuk resource `rbac`.
 */
export const checkSuperAdmin = async ({ auth, request, set }: any) => {
  if (!auth) {
    return unauthorizedResponse(set);
  }

  const user = await getUserAccessContext(auth.sub);
  const requiredAction =
    methodToPermissionAction(request?.method) ?? PermissionAction.READ;

  if (!user?.rbacRole?.id || user.rbacRole.isActive !== true) {
    return forbiddenResponse(
      set,
      "Role RBAC Anda belum ditetapkan atau sedang nonaktif",
    );
  }

  const hasRbacAccess = await hasRolePermission(
    user.rbacRole.id,
    "rbac",
    requiredAction,
  );

  if (!hasRbacAccess) {
    return forbiddenResponse(
      set,
      "Role Anda tidak memiliki izin RBAC untuk resource ini",
    );
  }
};

/**
 * beforeHandle factory: Wajib login + owner resource ATAU punya izin kelola karyawan.
 * Cek apakah auth.employeeId === params[paramName].
 *
 * @param paramName - nama param yang berisi employeeId (default: "employeeId")
 */
export const checkOwnerOrAdmin =
  (paramName: string = "employeeId") =>
  async ({ auth, params, set }: any) => {
    if (!auth) {
      return unauthorizedResponse(set);
    }

    // Owner selalu boleh akses data sendiri.
    const targetId = params?.[paramName];
    if (!targetId || auth.employeeId === targetId) {
      return;
    }

    const user = await getUserAccessContext(auth.sub);

    if (!user?.rbacRole?.id || user.rbacRole.isActive !== true) {
      return forbiddenResponse(
        set,
        "Role RBAC Anda belum ditetapkan atau sedang nonaktif",
      );
    }

    const canManageEmployee = await hasRolePermission(
      user.rbacRole.id,
      "employees",
      PermissionAction.UPDATE,
    );

    if (canManageEmployee) {
      return;
    }

    return forbiddenResponse(
      set,
      "Anda hanya dapat mengakses data milik sendiri",
    );
  };

// & ============ beforeHandle Guard (Divisi & Position apakah sebagai manager)============

/**
 * beforeHandle: Wajib login + role dengan scope evaluasi per divisi.
 */
export const checkManager = async ({ auth, set }: any) => {
  if (!auth) {
    return unauthorizedResponse(set);
  }

  const user = await getUserAccessContext(auth.sub);

  if (!user?.rbacRole?.id || user.rbacRole.isActive !== true) {
    return forbiddenResponse(
      set,
      "Role RBAC Anda belum ditetapkan atau sedang nonaktif",
    );
  }

  const hasDivisionScopePermission = await hasRolePermission(
    user.rbacRole.id,
    "assessments_division",
    PermissionAction.READ,
  );

  if (!hasDivisionScopePermission) {
    return forbiddenResponse(
      set,
      "Role Anda tidak memiliki akses evaluasi berbasis divisi",
    );
  }

  const isGlobalEvaluator = await hasGlobalEvaluationScope(user.rbacRole.id);
  if (isGlobalEvaluator) {
    return;
  }

  const division = await prisma.divisions.findFirst({
    where: { managerId: auth.sub },
    select: { id: true },
  });

  if (!division) {
    return forbiddenResponse(set, "Anda bukan manager dari divisi manapun");
  }
};

/**
 * beforeHandle: Wajib login + permission RBAC untuk endpoint HR terkait.
 */
export const checkHR = async ({ auth, request, set }: any) => {
  if (!auth) {
    return unauthorizedResponse(set);
  }

  const requiredAction = methodToPermissionAction(request?.method);
  const resourceKey = resolveHrResourceKey(getRequestPathname(request));

  if (!requiredAction || !resourceKey) {
    return forbiddenResponse(
      set,
      "Permission endpoint HR belum terkonfigurasi untuk route ini",
    );
  }

  const user = await getUserAccessContext(auth.sub);

  if (!user?.rbacRole?.id || user.rbacRole.isActive !== true) {
    return forbiddenResponse(
      set,
      "Role RBAC Anda belum ditetapkan atau sedang nonaktif",
    );
  }

  const hasAccess = await hasRolePermission(
    user.rbacRole.id,
    resourceKey,
    requiredAction,
  );

  if (!hasAccess) {
    return forbiddenResponse(
      set,
      "Role Anda tidak memiliki izin untuk mengakses resource ini",
    );
  }
};

/**
 * beforeHandle: Wajib login + permission RBAC untuk resource geofence.
 */
export const checkAdminOrCEO = async ({ auth, request, set }: any) => {
  // Cek keberadaan token JWT — tanpa token request langsung ditolak 401
  if (!auth) {
    return unauthorizedResponse(set);
  }

  const requiredAction = methodToPermissionAction(request?.method);
  if (!requiredAction) {
    return forbiddenResponse(
      set,
      "Aksi HTTP tidak didukung untuk resource geofence",
    );
  }

  const user = await getUserAccessContext(auth.sub);

  if (!user?.rbacRole?.id || user.rbacRole.isActive !== true) {
    return forbiddenResponse(
      set,
      "Role RBAC Anda belum ditetapkan atau sedang nonaktif",
    );
  }

  const hasGeofenceAccess = await hasRolePermission(
    user.rbacRole.id,
    "geofences",
    requiredAction,
  );

  if (!hasGeofenceAccess) {
    return forbiddenResponse(
      set,
      "Role Anda tidak memiliki izin geofence untuk aksi ini",
    );
  }
};

/**
 * beforeHandle: Guard untuk fitur penilaian karyawan berbasis permission RBAC.
 */
export const checkEvaluator = async ({ auth, request, set }: any) => {
  if (!auth) {
    return unauthorizedResponse(set);
  }

  const requiredAction = methodToPermissionAction(request?.method);
  if (!requiredAction) {
    return forbiddenResponse(
      set,
      "Aksi HTTP tidak didukung untuk fitur penilaian",
    );
  }

  const user = await getUserAccessContext(auth.sub);

  if (!user?.rbacRole?.id || user.rbacRole.isActive !== true) {
    return forbiddenResponse(
      set,
      "Role RBAC Anda belum ditetapkan atau sedang nonaktif",
    );
  }

  const hasAssessmentAccess = await hasRolePermission(
    user.rbacRole.id,
    "assessments",
    requiredAction,
  );

  if (!hasAssessmentAccess) {
    return forbiddenResponse(
      set,
      "Role Anda tidak memiliki akses ke fitur penilaian karyawan",
    );
  }

  const isGlobalEvaluator = await hasGlobalEvaluationScope(user.rbacRole.id);
  if (isGlobalEvaluator) {
    return;
  }

  if (user.employees?.position?.divisionId) {
    return;
  }

  return forbiddenResponse(
    set,
    "Evaluator berbasis divisi harus memiliki posisi yang berelasi dengan divisi",
  );
};



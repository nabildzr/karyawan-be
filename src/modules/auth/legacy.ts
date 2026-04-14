// * File ini menyimpan implementasi legacy service module auth sebagai referensi transisi.

import { verify } from "argon2";
import prisma from "../../config/prisma";
import { LoginPayload } from "./model";

export const AuthService = {
  async authenticateUser(data: LoginPayload) {
    const user = await prisma.users.findUnique({
      where: { nip: data.nip },
      select: {
        id: true,
        nip: true,
        rbacRole: {
          select: {
            id: true,
            key: true,
            name: true,
            isActive: true,
            canAccessAdmin: true,
          },
        },
        password: true, // jgn kirim password ke client
        employees: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!user) throw new Error("Bad Request: NIP atau Password salah.");

    // verifikasi hash cryptography
    const isPasswordValid = await verify(user.password, data.password);
    if (!isPasswordValid)
      throw new Error("Bad Request: NIP atau Password salah.");

    // Gatekeeper WEB: akses ditentukan murni dari permission RBAC di DB.
    // Portal web saat ini mencakup jalur /admin dan /karyawan.
    let hasWebAccessByRbac = false;

    if (user.rbacRole?.id && user.rbacRole.isActive) {
      if (user.rbacRole.canAccessAdmin) {
        hasWebAccessByRbac = true;
      } else {
        const webPortalPermission = await prisma.rolePermissionActions.findFirst({
          where: {
            roleId: user.rbacRole.id,
            isAllowed: true,
            resource: {
              isActive: true,
              OR: [
                {
                  routePath: {
                    startsWith: "/admin",
                  },
                },
                {
                  routePath: {
                    startsWith: "/karyawan",
                  },
                },
              ],
            },
          },
          select: { id: true },
        });

        hasWebAccessByRbac = Boolean(webPortalPermission);
      }
    }

    if (data.clientType === "WEB" && !hasWebAccessByRbac) {
      throw new Error(
        "Forbidden: Role Anda belum memiliki izin akses ke portal web.",
      );
    }

    return {
      id: user.id,
      employeeId: user.employees?.id || null,
      email: user.employees?.email || null,
      role: user.rbacRole?.key ?? null,
      rbacRoleKey: user.rbacRole?.key ?? null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 hari
    };
  },

  async me(id: string, options?: { withEmployee?: boolean }) {
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        nip: true,
        rbacRole: {
          select: {
            id: true,
            key: true,
            name: true,
            isSystem: true,
            isActive: true,
            canAccessAdmin: true,
            permissions: {
              where: {
                isAllowed: true,
                resource: {
                  isActive: true,
                },
              },
              orderBy: [
                {
                  resource: {
                    groupName: "asc",
                  },
                },
                {
                  resource: {
                    name: "asc",
                  },
                },
                {
                  action: "asc",
                },
              ],
              select: {
                action: true,
                resource: {
                  select: {
                    key: true,
                    name: true,
                    routePath: true,
                    groupName: true,
                    supportsApprove: true,
                  },
                },
              },
            },
          },
        },
        employees: options?.withEmployee
          ? {
              select: {
                id: true,
                fullName: true,
                address: true,
                email: true,
                phoneNumber: true,
                joinDate: true,
                userId: true,

                position: {
                  select: {
                    id: true,
                    name: true,
                    gajiPokok: true,
                    isManagerial: true,
                    division: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            }
          : false,
      },
    });

    if (!user) throw new Error("Not Found: User tidak ditemukan.");

    const permissions = (user.rbacRole?.permissions ?? []).map(
      (permission) => ({
        action: permission.action,
        resourceKey: permission.resource.key,
        resourceName: permission.resource.name,
        resourceRoutePath: permission.resource.routePath,
        groupName: permission.resource.groupName,
        supportsApprove: permission.resource.supportsApprove,
      }),
    );

    return {
      ...user,
      role: user.rbacRole?.key ?? null,
      rbacRoleKey: user.rbacRole?.key ?? null,
      permissions,
    };
  },
};

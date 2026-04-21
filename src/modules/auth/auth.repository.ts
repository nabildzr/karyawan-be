import prisma from "../../config/prisma";

type AuthDbClient = any;

function getDb(db?: AuthDbClient) {
  return db ?? prisma;
}

/** Mengambil data login user mentah berdasarkan nip. */
export async function findLoginUserByNip(nip: string, db?: AuthDbClient) {
  return getDb(db).users.findUnique({
    where: { nip },
    select: {
      id: true,
      nip: true,
      password: true,
      rbacRole: {
        select: {
          id: true,
          key: true,
          name: true,
          isActive: true,
          canAccessAdmin: true,
        },
      },
      employees: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });
}

/** Mengecek izin akses web portal mentah berdasarkan role RBAC. */
export async function findWebPortalPermissionByRoleId(
  roleId: string,
  db?: AuthDbClient,
) {
  return getDb(db).rolePermissionActions.findFirst({
    where: {
      roleId,
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
}

/** Mengambil profil user mentah untuk endpoint auth/me. */
export async function findUserProfileById(
  id: string,
  withEmployee: boolean,
  db?: AuthDbClient,
) {
  return getDb(db).users.findUnique({
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
      employees: withEmployee
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
}

/** Mengambil user mentah untuk proses reset berdasarkan identifier. */
export async function findResetUserByIdentifier(
  identifier: string,
  db?: AuthDbClient,
) {
  return getDb(db).users.findFirst({
    where: {
      OR: [
        { nip: identifier },
        {
          employees: {
            is: {
              email: {
                equals: identifier,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      updatedAt: true,
      employees: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });
}

/** Mengambil user mentah untuk validasi token reset password. */
export async function findUserPasswordSnapshotById(
  id: string,
  db?: AuthDbClient,
) {
  return getDb(db).users.findUnique({
    where: { id },
    select: {
      id: true,
      password: true,
      updatedAt: true,
    },
  });
}

/** Memperbarui password user mentah berdasarkan id. */
export async function updateUserPasswordById(
  id: string,
  password: string,
  db?: AuthDbClient,
) {
  return getDb(db).users.update({
    where: { id },
    data: { password },
  });
}

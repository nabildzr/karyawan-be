import prisma from "../../config/prisma";
import { PermissionAction } from "../../generated/prisma/enums";

// Read permission resources with optional inactive records.
const findPermissionResources = (includeInactive: boolean) => {
  return prisma.permissionResources.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
  });
};

// Read permission resources for role permission seeding.
const findPermissionResourceSeeds = () => {
  return prisma.permissionResources.findMany({
    select: {
      id: true,
      supportsApprove: true,
    },
  });
};

// Read permission resources by keys for permission updates.
const findPermissionResourcesByKeys = (keys: string[]) => {
  return prisma.permissionResources.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true, supportsApprove: true },
  });
};

// Read role list using pagination and filters.
const findRoles = (where: Record<string, unknown>, skip: number, take: number) => {
  return prisma.rbacRoles.findMany({
    where,
    include: {
      _count: {
        select: {
          users: true,
          permissions: true,
        },
      },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    skip,
    take,
  });
};

// Count roles by filter for pagination meta.
const countRoles = (where: Record<string, unknown>) => {
  return prisma.rbacRoles.count({ where });
};

// Read role detail with permission relations.
const findRoleDetailById = (roleId: string) => {
  return prisma.rbacRoles.findUnique({
    where: { id: roleId },
    include: {
      permissions: true,
      _count: {
        select: { users: true },
      },
    },
  });
};

// Read role by id for updates.
const findRoleById = (roleId: string) => {
  return prisma.rbacRoles.findUnique({ where: { id: roleId } });
};

// Read role by key for uniqueness checks.
const findRoleByKey = (key: string) => {
  return prisma.rbacRoles.findUnique({
    where: { key },
    select: { id: true },
  });
};

// Read role by name excluding current role id.
const findRoleByNameExceptId = (name: string, roleId: string) => {
  return prisma.rbacRoles.findFirst({
    where: {
      name,
      NOT: { id: roleId },
    },
  });
};

// Create a new RBAC role row.
const createRole = (data: {
  key: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  canAccessAdmin: boolean;
}) => {
  return prisma.rbacRoles.create({ data });
};

// Update RBAC role metadata.
const updateRole = (
  roleId: string,
  data: {
    name?: string;
    isActive?: boolean;
    canAccessAdmin?: boolean;
  },
) => {
  return prisma.rbacRoles.update({
    where: { id: roleId },
    data,
  });
};

// Insert role permission actions in batch.
const createManyRolePermissionActions = (
  data: {
    roleId: string;
    resourceId: string;
    action: PermissionAction;
    isAllowed: boolean;
  }[],
) => {
  return prisma.rolePermissionActions.createMany({
    data,
    skipDuplicates: true,
  });
};

// Batch update role permissions by role and action/resource pairs.
const updateManyRolePermissionActions = (
  roleId: string,
  conditions: { resourceId: string; action: PermissionAction }[],
  isAllowed: boolean,
) => {
  return prisma.rolePermissionActions.updateMany({
    where: {
      roleId,
      OR: conditions,
    },
    data: {
      isAllowed,
    },
  });
};

// Read user and its current RBAC role.
const findUserWithRole = (userId: string) => {
  return prisma.users.findUnique({
    where: { id: userId },
    include: {
      rbacRole: {
        select: { id: true, key: true },
      },
    },
  });
};

// Read SUPER_ADMIN role id.
const findSuperAdminRole = () => {
  return prisma.rbacRoles.findUnique({
    where: { key: "SUPER_ADMIN" },
    select: { id: true },
  });
};

// Count users assigned to a role.
const countUsersByRoleId = (roleId: string) => {
  return prisma.users.count({
    where: { rbacRoleId: roleId },
  });
};

// Assign role to user and return selected projection.
const updateUserRole = (userId: string, roleId: string) => {
  return prisma.users.update({
    where: { id: userId },
    data: {
      rbacRoleId: roleId,
    },
    select: {
      id: true,
      nip: true,
      rbacRoleId: true,
      rbacRole: {
        select: {
          id: true,
          key: true,
          name: true,
        },
      },
    },
  });
};

export const RbacRepository = {
  findPermissionResources,
  findPermissionResourceSeeds,
  findPermissionResourcesByKeys,
  findRoles,
  countRoles,
  findRoleDetailById,
  findRoleById,
  findRoleByKey,
  findRoleByNameExceptId,
  createRole,
  updateRole,
  createManyRolePermissionActions,
  updateManyRolePermissionActions,
  findUserWithRole,
  findSuperAdminRole,
  countUsersByRoleId,
  updateUserRole,
};

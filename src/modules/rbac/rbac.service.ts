import { PermissionAction } from "../../generated/prisma/enums";
import { AuditActor } from "../../shared/audit/actor";
import { writeAuditLog } from "../../shared/audit/rbac";
import type {
  AssignUserRolePayload,
  RbacRoleCreatePayload,
  RbacRolePermissionBulkUpdatePayload,
  RbacRoleUpdatePayload,
} from "./rbac.schema";
import { RbacRepository } from "./rbac.repository";
import {
  BULK_PERMISSION_UPDATE_CHUNK_SIZE,
  chunkArray,
  normalizeRoleKey,
  resourceActions,
} from "./utils/validate.util";

export const RbacService = {
  // Return permission resource catalog.
  async listResources(includeInactive = false) {
    return RbacRepository.findPermissionResources(includeInactive);
  },

  // Return paginated role list.
  async listRoles({
    page = 1,
    limit = 20,
    search,
  }: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const skip = (page - 1) * limit;

    const where = search?.trim()
      ? {
          OR: [
            {
              name: {
                contains: search.trim(),
                mode: "insensitive" as const,
              },
            },
            {
              key: {
                contains: search.trim(),
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      RbacRepository.findRoles(where, skip, limit),
      RbacRepository.countRoles(where),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  // Return role detail and permission matrix.
  async getRoleDetail(roleId: string) {
    const role = await RbacRepository.findRoleDetailById(roleId);

    if (!role) {
      throw new Error("Not Found: Role tidak ditemukan.");
    }

    const resources = await RbacRepository.findPermissionResources(true);

    const permissionMap = new Map(
      role.permissions.map((permission) => [
        `${permission.resourceId}:${permission.action}`,
        permission,
      ]),
    );

    const matrix = resources.map((resource) => {
      const actions = resourceActions(resource.supportsApprove);

      return {
        resourceId: resource.id,
        resourceKey: resource.key,
        resourceName: resource.name,
        routePath: resource.routePath,
        groupName: resource.groupName,
        supportsApprove: resource.supportsApprove,
        actions: actions.map((action) => {
          const existing = permissionMap.get(`${resource.id}:${action}`);
          return {
            action,
            isAllowed: existing?.isAllowed ?? false,
          };
        }),
      };
    });

    return {
      role: {
        id: role.id,
        key: role.key,
        name: role.name,
        isSystem: role.isSystem,
        isActive: role.isActive,
        canAccessAdmin: role.canAccessAdmin,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        userCount: role._count.users,
      },
      matrix,
    };
  },

  // Create role and seed default permissions.
  async createRole(payload: RbacRoleCreatePayload, actor: AuditActor) {
    const normalizedKey = normalizeRoleKey(payload.key ?? payload.name);

    if (!normalizedKey) {
      throw new Error("Bad Request: Key role tidak valid.");
    }

    if (normalizedKey === "SUPER_ADMIN") {
      throw new Error(
        "Forbidden: Role SUPER_ADMIN adalah role sistem dan tidak boleh dibuat manual.",
      );
    }

    const existing = await RbacRepository.findRoleByKey(normalizedKey);

    if (existing) {
      throw new Error("Conflict: Key role sudah digunakan.");
    }

    const role = await RbacRepository.createRole({
      key: normalizedKey,
      name: payload.name.trim(),
      isSystem: false,
      isActive: payload.isActive ?? true,
      canAccessAdmin: payload.canAccessAdmin ?? false,
    });

    const resources = await RbacRepository.findPermissionResourceSeeds();

    const records = resources.flatMap((resource) =>
      resourceActions(resource.supportsApprove).map((action) => ({
        roleId: role.id,
        resourceId: resource.id,
        action,
        isAllowed: false,
      })),
    );

    if (records.length > 0) {
      await RbacRepository.createManyRolePermissionActions(records);
    }

    await writeAuditLog({
      actor,
      action: "CREATE_RBAC_ROLE",
      entityId: role.id,
      changes: {
        before: null,
        after: {
          id: role.id,
          key: role.key,
          name: role.name,
          isActive: role.isActive,
        },
      },
    });

    return role;
  },

  // Update role metadata.
  async updateRole(roleId: string, payload: RbacRoleUpdatePayload, actor: AuditActor) {
    const existing = await RbacRepository.findRoleById(roleId);

    if (!existing) {
      throw new Error("Not Found: Role tidak ditemukan.");
    }

    if (existing.key === "SUPER_ADMIN" && payload.isActive === false) {
      throw new Error("Forbidden: SUPER_ADMIN tidak boleh dinonaktifkan.");
    }

    if (!payload.name && payload.isActive === undefined && payload.canAccessAdmin === undefined) {
      throw new Error("Bad Request: Tidak ada perubahan yang dikirim.");
    }

    if (payload.name?.trim()) {
      const duplicateName = await RbacRepository.findRoleByNameExceptId(
        payload.name.trim(),
        roleId,
      );

      if (duplicateName) {
        throw new Error("Conflict: Nama role sudah digunakan.");
      }
    }

    const updated = await RbacRepository.updateRole(roleId, {
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      ...(payload.canAccessAdmin !== undefined ? { canAccessAdmin: payload.canAccessAdmin } : {}),
    });

    await writeAuditLog({
      actor,
      action: "UPDATE_RBAC_ROLE",
      entityId: roleId,
      changes: {
        before: {
          name: existing.name,
          isActive: existing.isActive,
        },
        after: {
          name: updated.name,
          isActive: updated.isActive,
        },
      },
    });

    return updated;
  },

  // Bulk update role permission flags.
  async updateRolePermissions(
    roleId: string,
    payload: RbacRolePermissionBulkUpdatePayload,
    actor: AuditActor,
  ) {
    const role = await RbacRepository.findRoleById(roleId);

    if (!role) {
      throw new Error("Not Found: Role tidak ditemukan.");
    }

    const requestedKeys = Array.from(
      new Set(payload.permissions.map((permission) => permission.resourceKey)),
    );

    const resources = await RbacRepository.findPermissionResourcesByKeys(requestedKeys);

    const resourceByKey = new Map(resources.map((resource) => [resource.key, resource]));

    const missingKeys = requestedKeys.filter((key) => !resourceByKey.has(key));
    if (missingKeys.length > 0) {
      throw new Error(
        `Bad Request: Resource tidak ditemukan (${missingKeys.join(", ")}).`,
      );
    }

    const normalizedMap = new Map<
      string,
      {
        roleId: string;
        resourceId: string;
        action: PermissionAction;
        isAllowed: boolean;
      }
    >();

    for (const permission of payload.permissions) {
      const resource = resourceByKey.get(permission.resourceKey);
      if (!resource) {
        throw new Error(
          `Bad Request: Resource ${permission.resourceKey} tidak ditemukan.`,
        );
      }

      if (
        permission.action === PermissionAction.APPROVE &&
        !resource.supportsApprove
      ) {
        throw new Error(
          `Bad Request: Resource ${permission.resourceKey} tidak mendukung aksi APPROVE.`,
        );
      }

      const action = permission.action as PermissionAction;
      normalizedMap.set(`${resource.id}:${action}`, {
        roleId,
        resourceId: resource.id,
        action,
        isAllowed: permission.isAllowed,
      });
    }

    const normalizedPermissions = Array.from(normalizedMap.values());

    if (normalizedPermissions.length > 0) {
      await RbacRepository.createManyRolePermissionActions(normalizedPermissions);

      const shouldBeAllowed = normalizedPermissions.filter(
        (permission) => permission.isAllowed,
      );

      const shouldBeDenied = normalizedPermissions.filter(
        (permission) => !permission.isAllowed,
      );

      for (const chunk of chunkArray(
        shouldBeAllowed,
        BULK_PERMISSION_UPDATE_CHUNK_SIZE,
      )) {
        await RbacRepository.updateManyRolePermissionActions(
          roleId,
          chunk.map((permission) => ({
            resourceId: permission.resourceId,
            action: permission.action,
          })),
          true,
        );
      }

      for (const chunk of chunkArray(
        shouldBeDenied,
        BULK_PERMISSION_UPDATE_CHUNK_SIZE,
      )) {
        await RbacRepository.updateManyRolePermissionActions(
          roleId,
          chunk.map((permission) => ({
            resourceId: permission.resourceId,
            action: permission.action,
          })),
          false,
        );
      }
    }

    await writeAuditLog({
      actor,
      action: "UPDATE_RBAC_PERMISSIONS",
      entityId: roleId,
      changes: {
        permissionCount: normalizedPermissions.length,
      },
    });

    return this.getRoleDetail(roleId);
  },

  // Assign a new role to a user.
  async assignUserRole(
    userId: string,
    payload: AssignUserRolePayload,
    actor: AuditActor,
  ) {
    const targetRole = await RbacRepository.findRoleById(payload.roleId);

    if (!targetRole) {
      throw new Error("Not Found: Role target tidak ditemukan.");
    }

    if (!targetRole.isActive) {
      throw new Error("Bad Request: Role target sedang nonaktif.");
    }

    const user = await RbacRepository.findUserWithRole(userId);

    if (!user) {
      throw new Error("Not Found: User tidak ditemukan.");
    }

    const superAdminRole = await RbacRepository.findSuperAdminRole();

    if (
      superAdminRole &&
      user.rbacRoleId === superAdminRole.id &&
      targetRole.id !== superAdminRole.id
    ) {
      const superAdminCount = await RbacRepository.countUsersByRoleId(
        superAdminRole.id,
      );

      if (superAdminCount <= 1) {
        throw new Error(
          "Forbidden: Tidak bisa memindahkan SUPER_ADMIN terakhir ke role lain.",
        );
      }
    }

    const updated = await RbacRepository.updateUserRole(userId, targetRole.id);

    await writeAuditLog({
      actor,
      action: "ASSIGN_USER_ROLE",
      entityId: userId,
      changes: {
        before: {
          rbacRoleId: user.rbacRoleId,
          rbacRoleKey: user.rbacRole?.key ?? null,
        },
        after: {
          rbacRoleId: targetRole.id,
          rbacRoleKey: targetRole.key,
        },
      },
    });

    return updated;
  },
};

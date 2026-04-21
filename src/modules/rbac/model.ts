import { t } from "elysia";

/** Mengekspor PermissionActionEnum untuk kebutuhan modul ini. */
export const PermissionActionEnum = t.Union([
  t.Literal("CREATE"),
  t.Literal("READ"),
  t.Literal("UPDATE"),
  t.Literal("DELETE"),
  t.Literal("APPROVE"),
]);

/** Mengekspor RbacRoleCreateDTO untuk kebutuhan modul ini. */
export const RbacRoleCreateDTO = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  key: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  isActive: t.Optional(t.Boolean({ default: true })),
  canAccessAdmin: t.Optional(t.Boolean({ default: false })),
});

/** Mengekspor RbacRoleUpdateDTO untuk kebutuhan modul ini. */
export const RbacRoleUpdateDTO = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  isActive: t.Optional(t.Boolean()),
  canAccessAdmin: t.Optional(t.Boolean()),
});

/** Mengekspor RbacRolePermissionUpdateItemDTO untuk kebutuhan modul ini. */
export const RbacRolePermissionUpdateItemDTO = t.Object({
  resourceKey: t.String({ minLength: 1 }),
  action: PermissionActionEnum,
  isAllowed: t.Boolean(),
});

/** Mengekspor RbacRolePermissionBulkUpdateDTO untuk kebutuhan modul ini. */
export const RbacRolePermissionBulkUpdateDTO = t.Object({
  permissions: t.Array(RbacRolePermissionUpdateItemDTO, { minItems: 1 }),
});

/** Mengekspor AssignUserRoleDTO untuk kebutuhan modul ini. */
export const AssignUserRoleDTO = t.Object({
  roleId: t.String({ minLength: 1 }),
});

/** Mendefinisikan alias tipe untuk RbacRoleCreatePayload. */
export type RbacRoleCreatePayload = typeof RbacRoleCreateDTO.static;
/** Mendefinisikan alias tipe untuk RbacRoleUpdatePayload. */
export type RbacRoleUpdatePayload = typeof RbacRoleUpdateDTO.static;
/** Mendefinisikan alias tipe untuk RbacRolePermissionBulkUpdatePayload. */
export type RbacRolePermissionBulkUpdatePayload =
  typeof RbacRolePermissionBulkUpdateDTO.static;
/** Mendefinisikan alias tipe untuk AssignUserRolePayload. */
export type AssignUserRolePayload = typeof AssignUserRoleDTO.static;

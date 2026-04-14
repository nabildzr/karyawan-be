import { t } from "elysia";

export const PermissionActionEnum = t.Union([
  t.Literal("CREATE"),
  t.Literal("READ"),
  t.Literal("UPDATE"),
  t.Literal("DELETE"),
  t.Literal("APPROVE"),
]);

export const RbacRoleCreateDTO = t.Object({
  name: t.String({ minLength: 2, maxLength: 100 }),
  key: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  isActive: t.Optional(t.Boolean({ default: true })),
  canAccessAdmin: t.Optional(t.Boolean({ default: false })),
});

export const RbacRoleUpdateDTO = t.Object({
  name: t.Optional(t.String({ minLength: 2, maxLength: 100 })),
  isActive: t.Optional(t.Boolean()),
  canAccessAdmin: t.Optional(t.Boolean()),
});

export const RbacRolePermissionUpdateItemDTO = t.Object({
  resourceKey: t.String({ minLength: 1 }),
  action: PermissionActionEnum,
  isAllowed: t.Boolean(),
});

export const RbacRolePermissionBulkUpdateDTO = t.Object({
  permissions: t.Array(RbacRolePermissionUpdateItemDTO, { minItems: 1 }),
});

export const AssignUserRoleDTO = t.Object({
  roleId: t.String({ minLength: 1 }),
});

export type RbacRoleCreatePayload = typeof RbacRoleCreateDTO.static;
export type RbacRoleUpdatePayload = typeof RbacRoleUpdateDTO.static;
export type RbacRolePermissionBulkUpdatePayload =
  typeof RbacRolePermissionBulkUpdateDTO.static;
export type AssignUserRolePayload = typeof AssignUserRoleDTO.static;

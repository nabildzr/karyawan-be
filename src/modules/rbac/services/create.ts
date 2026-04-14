// * File ini menangani operasi tulis untuk module rbac.

import { RbacService as LegacyRbacService } from "../legacy";

// & Create RBAC role.
// % Buat role RBAC.
export const createRole = LegacyRbacService.createRole;

// & Update RBAC role metadata.
// % Update metadata role RBAC.
export const updateRole = LegacyRbacService.updateRole;

// & Update RBAC role permissions.
// % Update permission role RBAC.
export const updateRolePermissions = LegacyRbacService.updateRolePermissions;

// & Assign RBAC role to user.
// % Tetapkan role RBAC ke user.
export const assignUserRole = LegacyRbacService.assignUserRole;

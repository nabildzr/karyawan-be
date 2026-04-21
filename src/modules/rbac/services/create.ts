// * File ini menangani operasi tulis untuk module rbac.

import { RbacService } from "../implementation";

// & Create RBAC role.
// % Buat role RBAC.
/** Mengekspor createRole untuk kebutuhan modul ini. */
export const createRole = RbacService.createRole;

// & Update RBAC role metadata.
// % Update metadata role RBAC.
/** Mengekspor updateRole untuk kebutuhan modul ini. */
export const updateRole = RbacService.updateRole;

// & Update RBAC role permissions.
// % Update permission role RBAC.
/** Mengekspor updateRolePermissions untuk kebutuhan modul ini. */
export const updateRolePermissions = RbacService.updateRolePermissions;

// & Assign RBAC role to user.
// % Tetapkan role RBAC ke user.
/** Mengekspor assignUserRole untuk kebutuhan modul ini. */
export const assignUserRole = RbacService.assignUserRole;

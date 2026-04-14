// * File ini adalah facade orchestrator untuk module rbac.

import {
    assignUserRole,
    createRole,
    updateRole,
    updateRolePermissions,
} from "./create";
import { getRoleDetail, listResources, listRoles } from "./report";

export const RbacService = {
  // & List resources.
  // % Daftar resource.
  listResources,

  // & List roles.
  // % Daftar role.
  listRoles,

  // & Get role detail.
  // % Ambil detail role.
  getRoleDetail,

  // & Create role.
  // % Buat role.
  createRole,

  // & Update role.
  // % Update role.
  updateRole,

  // & Update role permissions.
  // % Update permission role.
  updateRolePermissions,

  // & Assign role to user.
  // % Tetapkan role ke user.
  assignUserRole,
};

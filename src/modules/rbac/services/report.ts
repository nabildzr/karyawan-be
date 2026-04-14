// * File ini menangani operasi baca/report untuk module rbac.

import { RbacService as LegacyRbacService } from "../legacy";

// & List RBAC resources.
// % Daftar resource RBAC.
export const listResources = LegacyRbacService.listResources;

// & List RBAC roles.
// % Daftar role RBAC.
export const listRoles = LegacyRbacService.listRoles;

// & Get RBAC role detail by id.
// % Ambil detail role RBAC berdasarkan id.
export const getRoleDetail = LegacyRbacService.getRoleDetail;

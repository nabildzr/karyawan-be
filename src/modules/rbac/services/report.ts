// * File ini menangani operasi baca/report untuk module rbac.

import { RbacService } from "../implementation";

// & List RBAC resources.
// % Daftar resource RBAC.
/** Mengekspor listResources untuk kebutuhan modul ini. */
export const listResources = RbacService.listResources;

// & List RBAC roles.
// % Daftar role RBAC.
/** Mengekspor listRoles untuk kebutuhan modul ini. */
export const listRoles = RbacService.listRoles;

// & Get RBAC role detail by id.
// % Ambil detail role RBAC berdasarkan id.
/** Mengekspor getRoleDetail untuk kebutuhan modul ini. */
export const getRoleDetail = RbacService.getRoleDetail;

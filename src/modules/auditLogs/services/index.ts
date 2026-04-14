// * File ini adalah facade orchestrator untuk module audit logs.

import { getAll } from "./report";

export const AuditLogService = {
  // & Get paginated audit logs.
  // % Ambil audit log dengan paginasi.
  getAll,
};

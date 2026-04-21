import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { checkAdmin, checkAuth } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { AuditLogListQueryDTO } from "./auditLogs.schema";
import { AuditLogService } from "./auditLogs.service";

const authGuard = checkAuth as any;

/** Mengekspor auditLogRoutes untuk kebutuhan modul ini. */
export const auditLogRoutes = new Elysia({
  prefix: "/audit-logs",
  detail: { tags: ["Audit Logs"] },
})
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await AuditLogService.getAuditLogList(query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil data audit.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [authGuard, checkAdmin],
      query: AuditLogListQueryDTO,
      detail: { summary: "Ambil Audit Log Paginated (Admin)" },
    },
  );

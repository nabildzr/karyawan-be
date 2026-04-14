import Elysia, { t } from "elysia";
import { checkAdmin, checkAuth } from "../../middleware/auth";
import { successResponse } from "../../utils/response_helper";

import { HttpStatusEnum } from "elysia-http-status-code/status";
import { mapError } from "../../utils/mapError";
import { AuditLogService } from "./service";

export const auditLogRoutes = new Elysia({
  prefix: "/audit-logs",
  detail: { tags: ["Audit Logs"] },
})
  // ──────────────────────────────────────────
  // & GET / — Ambil Audit Log Paginated (Admin)
  // ──────────────────────────────────────────
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await AuditLogService.getAll({
          page: query.page,
          limit: query.limit,
          search: query.search,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil data audit.",
        });
      } catch (error: any) {
        console.log("Error saat sedang mengambil data Audit Log: ", error);
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 10 })),
        search: t.Optional(t.String()),
      }),
      detail: { summary: "Ambil Audit Log Paginated (Admin)" },
    },
  );

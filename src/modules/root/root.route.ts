// * Backend module route: src/modules/root/root.route.ts
// & This file defines root endpoints and inline route handlers.
// % File ini mendefinisikan endpoint root dan inline route handler.

import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { RootService } from "./root.service";

/** Mengekspor RootHandler untuk kebutuhan modul ini. */
export const RootHandler = new Elysia({
  prefix: "/",
  detail: { description: "Root endpoint", tags: ["Root"] },
})
  .get(
    "/",
    async ({ set }) => {
      try {
        const data = RootService.getRootInfo();
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil mengambil informasi server.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      detail: {
        summary: "Server info",
        description: "Get server name, version, and running status.",
      },
    },
  )
  .get(
    "/health",
    async ({ set }) => {
      try {
        const data = RootService.getHealthStatus();
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil mengambil status kesehatan server.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      detail: {
        summary: "Health check",
        description: "Get server health status and uptime.",
      },
    },
  );
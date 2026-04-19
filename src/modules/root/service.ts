// * Backend module service: src/modules/root/service.ts
// & This file provides service facade and business orchestration for root module.
// % File ini menyediakan facade service dan orkestrasi business untuk module root.

import { Elysia } from "elysia";
import { constants } from "../../config/constants";
import { apiResponse, swaggerDetails } from "../../utils";

export const RootHandler = new Elysia({
  prefix: "/",
  detail: { description: "Root endpoint", tags: ["Root"] },
})
  .get(
    "/",
    () => {
      return apiResponse(
        {
          name: constants.server.name,
          version: constants.server.version,
          status: "running",
          timestamp: new Date().toISOString(),
        },
        "Server is running",
      );
    },
    {
      detail: swaggerDetails("Health Check", "Check if the server is running"),
    },
  )
  .get(
    "/health",
    () => {
      return apiResponse(
        {
          status: "healthy",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
        "Server is healthy",
      );
    },
    {
      detail: swaggerDetails("Health Status", "Get server health status"),
    },
  );

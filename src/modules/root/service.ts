import { Elysia } from "elysia";
import { apiResponse, swaggerDetails } from "../../utils";
import { constants } from "../../config/constants";

export const RootHandler = new Elysia({
  prefix: "/",
  detail: { description: "Root endpoint", tags: ["Root"] },
})
  // & PUBLIC - Health check
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

  // & PUBLIC - Health status
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

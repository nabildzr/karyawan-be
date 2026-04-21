// * Backend module service: src/modules/root/root.service.ts
// & This file provides business logic for the root module.
// % File ini menyediakan business logic untuk module root.

import { constants } from "../../config/constants";
import type { HealthStatusPayload, RootInfoPayload } from "./root.schema";

/** Mengambil metadata server untuk endpoint root. */
function getRootInfo(): RootInfoPayload {
  return {
    name: constants.server.name,
    version: constants.server.version,
    status: "running",
    timestamp: new Date().toISOString(),
  };
}

/** Mengambil status kesehatan server untuk endpoint health. */
function getHealthStatus(): HealthStatusPayload {
  return {
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/** Mengekspor RootService untuk kebutuhan modul ini. */
export const RootService = {
  getRootInfo,
  getHealthStatus,
};
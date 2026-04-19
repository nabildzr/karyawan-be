// * File server bootstrap: src/server.ts
// & This file composes API v1 routes, auth plugin, and Swagger docs.
// % File ini menyusun route API v1, plugin auth, dan dokumentasi Swagger.
import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { constants } from "./config/constants";
import { authPlugin } from "./middleware/auth";
import { assessmentCategoriesRoutes } from "./modules/assessmentCategories";
import { assessmentsRoutes } from "./modules/assessments";
import { attendanceRoutes } from "./modules/attendances";
import { auditLogRoutes } from "./modules/auditLogs";
import { authRoutes } from "./modules/auth";
import { divisionRoutes } from "./modules/divisions";
import { employeeRoutes } from "./modules/employees";
import { faceRoutes } from "./modules/faces";
import { geofenceRoutes } from "./modules/geofences";
import { holidayRoutes } from "./modules/holidays";
import { pointsRoutes } from "./modules/points";
import { positionRoutes } from "./modules/positions";
import { rbacRoutes } from "./modules/rbac";
import { RootHandler } from "./modules/root";
import { submissionRoutes } from "./modules/submissions";
import { workingScheduleRoutes } from "./modules/workingSchedules";
import { notificationRoutes } from "./modules/notifications";

// & Create versioned API server instance using configured API version.
// % Buat instance server API bertag versi menggunakan versi API pada konfigurasi.
export const server_v1 = new Elysia({
  prefix: `/v${constants.api.version}`,
});

// & Register middleware, route modules, and API docs in one pipeline.
// % Daftarkan middleware, modul route, dan dokumentasi API dalam satu pipeline.
server_v1
  // & Auth plugin derives auth context from bearer token for all routes.
  // % Plugin auth menurunkan context auth dari bearer token untuk semua route.
  .use(authPlugin)

  // & Public routes do not require authentication token.
  // % Route publik tidak memerlukan token autentikasi.
  .use(RootHandler)
  .use(authRoutes)

  // & Protected routes enforce access level using module-level beforeHandle guards.
  // % Route terproteksi menerapkan level akses lewat guard beforeHandle per modul.
  .use(holidayRoutes)
  .use(employeeRoutes)
  .use(faceRoutes)
  .use(attendanceRoutes)
  .use(pointsRoutes)
  .use(workingScheduleRoutes)
  .use(geofenceRoutes)
  .use(submissionRoutes)
  .use(auditLogRoutes)
  .use(positionRoutes)
  .use(divisionRoutes)
  .use(assessmentCategoriesRoutes)
  .use(assessmentsRoutes)
  .use(rbacRoutes)
  .use(notificationRoutes)

  // & Expose interactive Swagger documentation for API inspection.
  // % Tampilkan dokumentasi Swagger interaktif untuk inspeksi API.
  .use(
    swagger({
      autoDarkMode: true,
      documentation: {
        info: {
          title: constants.server.name,
          version: constants.server.version,
          description: `API Documentation for ${constants.server.name}`,
          contact: {
            name: constants.server.author,
            email: constants.server.email,
          },
        },
      },
      swaggerOptions: {
        syntaxHighlight: { theme: "monokai" },
      },
    }),
  );

console.debug("Loading V1 Server... Done!");

// * File server bootstrap: src/server.ts
// & This file composes API v1 routes, auth plugin, and Swagger docs.
// % File ini menyusun route API v1, plugin auth, dan dokumentasi Swagger.
import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { constants } from "./config/constants";
import { authPlugin } from "./middleware/auth";
import { assessmentCategoriesRoutes } from "./modules/assessmentCategories/assessmentCategories.route";
import { assessmentsRoutes } from "./modules/assessments/assessments.route";
import { attendanceRoutes } from "./modules/attendances/attendances.route";
import { auditLogRoutes } from "./modules/auditLogs/auditLogs.route";
import { authRoutes } from "./modules/auth/auth.route";
import { contohmoduleRoutes } from "./modules/contohmodule/contohmodule.route";
import { dashboardRoutes } from "./modules/dashboard";
import { divisionRoutes } from "./modules/divisions/divisions.route";
import { employeeRoutes } from "./modules/employees/employees.route";
import { faceRoutes } from "./modules/faces/faces.route";
import { geofenceRoutes } from "./modules/geofences/geofences.route";
import { helpdeskRoutes } from "./modules/helpdesk/helpdesk.route";
import { helpdeskWsRoute } from "./modules/helpdesk/helpdesk.ws";
import { holidayRoutes } from "./modules/holidays/holidays.route";
import { notificationRoutes } from "./modules/notifications/notifications.route";
import { pointsRoutes } from "./modules/points/points.route";
import { positionRoutes } from "./modules/positions/positions.route";
import { rbacRoutes } from "./modules/rbac/rbac.route";
import { RootHandler } from "./modules/root/root.route";
import { submissionRoutes } from "./modules/submissions/submissions.route";
import { workingScheduleRoutes } from "./modules/workingSchedules/workingSchedules.route";

// & Create versioned API server instance using configured API version.
// % Buat instance server API bertag versi menggunakan versi API pada konfigurasi.
/** Mengekspor server_v1 untuk kebutuhan modul ini. */
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
  .use(contohmoduleRoutes)

  // & Protected routes enforce access level using module-level beforeHandle guards.
  // % Route terproteksi menerapkan level akses lewat guard beforeHandle per modul.
  .use(dashboardRoutes)
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
  .use(helpdeskRoutes)
  .use(helpdeskWsRoute)

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

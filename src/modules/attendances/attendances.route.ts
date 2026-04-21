// * Backend module: karyawan-be/src/modules/attendances/index.ts
// & This file defines backend logic for index.ts.
// % File ini mendefinisikan logika backend untuk index.ts.

import { Elysia, t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import {
  authPlugin,
  checkAdmin,
  checkAuth,
  checkHR,
} from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { errorResponse, successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { AttendanceService } from "./attendances.service";

const parseOptionalCoordinate = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

/** Mengekspor attendanceRoutes untuk kebutuhan modul ini. */
export const attendanceRoutes = new Elysia({
  prefix: "/attendances",
  detail: { tags: ["Attendances"] },
})
  .use(authPlugin)
  // & ============ VERIFIKASI WAJAH TANPA SIMPAN ABSENSI ============
  .post(
    "/verify-face",
    async ({ auth, body, set }) => {
      try {
        const data = await AttendanceService.verifyFaceForAttendance(
          auth!.sub,
          body.image,
        );

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Verifikasi wajah berhasil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: t.Object({
        image: t.File({ type: ["image/jpeg", "image/png"] }),
      }),
      detail: {
        summary: "Verifikasi wajah (tanpa menyimpan data absensi)",
      },
    },
  )
  .post(
    "/blip-caption",
    async ({ body, set }) => {
      try {
        const data = await AttendanceService.generateBlipCaption(body.image);

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Caption gambar berhasil dihasilkan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: t.Object({
        image: t.File({ type: ["image/jpeg", "image/png", "image/webp"] }),
      }),
      detail: {
        summary: "Generate caption gambar via BLIP (proxy backend)",
      },
    },
  )
  // & ============ CHECK-IN DENGAN VERIFIKASI WAJAH ============
  .post(
    "/check-in",
    async ({ auth, body, set }) => {
      try {
        const data = await AttendanceService.checkIn(
          auth!.sub,
          {
            image: body.image,
            latitude: parseOptionalCoordinate(body.latitude),
            longitude: parseOptionalCoordinate(body.longitude),
            deviceInfo: body.deviceInfo,
            timezone: body.timezone,
          },
          resolveAuditActor(auth),
        );

        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({ data, message: "Check-in berhasil." });
      } catch (error: any) {
        const msg: string = error.message ?? "";
        if (msg.startsWith("Not Found"))
          set.status = HttpStatusEnum.HTTP_404_NOT_FOUND;
        else if (msg.startsWith("Bad Request"))
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        else if (msg.startsWith("Conflict"))
          set.status = HttpStatusEnum.HTTP_409_CONFLICT;
        else if (msg.startsWith("Forbidden"))
          set.status = HttpStatusEnum.HTTP_403_FORBIDDEN;
        else if (msg.startsWith("Unauthorized"))
          set.status = HttpStatusEnum.HTTP_401_UNAUTHORIZED;
        else if (msg.startsWith("Flask AI Error"))
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        else set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;

        return errorResponse(msg.split(": ")[1] || "Gagal melakukan absensi.");
      }
    },
    {
      beforeHandle: [checkAuth],
      body: t.Object({
        image: t.File({ type: ["image/jpeg", "image/png"] }),
        latitude: t.Optional(t.Numeric()),
        longitude: t.Optional(t.Numeric()),
        deviceInfo: t.Optional(t.String()),
        timezone: t.Optional(t.String({ default: "Asia/Jakarta" })),
      }),
      detail: { summary: "Check-in dengan verifikasi wajah" },
    },
  )
  // & ============ GET RIWAYAT ABSENSI DENGAN PAGINATION & FILTER ============
  .get(
    "/history",
    async ({ auth, set, query }) => {
      try {
        const data = await AttendanceService.getHistory(auth!.sub, {
          page: query.page ? Number(query.page) : 1,
          limit: query.limit ? Number(query.limit) : 10,
          period: query.period as "week" | "month" | "year" | undefined,
          filter: query.filter as
            | "late"
            | "present"
            | "absent"
            | "all"
            | undefined,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Riwayat absensi berhasil diambil.",
        });
      } catch (error: any) {
        const msg: string = error.message ?? "";
        if (msg.startsWith("Not Found"))
          set.status = HttpStatusEnum.HTTP_404_NOT_FOUND;
        else if (msg.startsWith("Bad Request"))
          set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
        else if (msg.startsWith("Forbidden"))
          set.status = HttpStatusEnum.HTTP_403_FORBIDDEN;
        else if (msg.startsWith("Unauthorized"))
          set.status = HttpStatusEnum.HTTP_401_UNAUTHORIZED;
        else set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;

        return errorResponse(
          msg.split(": ")[1] || "Gagal mengambil riwayat absensi.",
        );
      }
    },
    {
      beforeHandle: [checkAuth],
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        period: t.Optional(t.String()),
        filter: t.Optional(t.String()),
      }),
      detail: { summary: "Ambil riwayat absensi dengan pagination" },
    },
  )
  // & ============ GET DETAIL RIWAYAT ABSENSI (KARYAWAN) ============
  .get(
    "/history/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await AttendanceService.getHistoryById(
          auth!.sub,
          params.id,
        );

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Detail riwayat absensi berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: t.Object({
        id: t.String(),
      }),
      detail: { summary: "Ambil detail riwayat absensi milik sendiri" },
    },
  )
  // & ============ GET KONTEKS ABSENSI HARI INI (KARYAWAN) ============
  .get(
    "/today-context",
    async ({ auth, set, query }) => {
      try {
        const data = await AttendanceService.getTodayContext(
          auth!.sub,
          query.timezone ?? "Asia/Jakarta",
        );

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Konteks absensi hari ini berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: t.Object({
        timezone: t.Optional(t.String()),
      }),
      detail: { summary: "Ambil konteks absensi hari ini" },
    },
  )
  // & ============ CHECK-OUT DENGAN VERIFIKASI WAJAH ============
  .post(
    "/check-out",
    async ({ auth, body, set }) => {
      try {
        const data = await AttendanceService.checkOut(
          auth!.sub,
          {
            image: body.image,
            latitude: parseOptionalCoordinate(body.latitude),
            longitude: parseOptionalCoordinate(body.longitude),
            deviceInfo: body.deviceInfo,
            timezone: body.timezone,
          },
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Check-out berhasil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: t.Object({
        image: t.File({ type: ["image/jpeg", "image/png"] }),
        latitude: t.Optional(t.Numeric()),
        longitude: t.Optional(t.Numeric()),
        deviceInfo: t.Optional(t.String()),
        timezone: t.Optional(t.String({ default: "Asia/Jakarta" })),
      }),
      detail: { summary: "Check-out dengan verifikasi wajah" },
    },
  )
  // & ============ ABSENSI MANUAL (ENTRY BARU OLEH HRD) ============
  .post(
    "/manual",
    async ({ auth, body, set }) => {
      try {
        const data = await AttendanceService.manualAttendance(auth!.sub, {
          employeeId: body.employeeId,
          status: body.status,
          statusCheckOut: body.statusCheckOut,
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          shiftName: body.shiftName,
          expectedCheckIn: body.expectedCheckIn,
          expectedCheckOut: body.expectedCheckOut,
          note: body.note,
          reason: body.reason,
          forceBypassSubmission: body.forceBypassSubmission,
        });
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Absensi manual berhasil dibuat.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkHR],
      body: t.Object({
        employeeId: t.String(),
        status: t.Enum({
          late: "LATE",
          present: "PRESENT",
          absent: "ABSENT",
          leave: "LEAVE",
        }),
        statusCheckOut: t.Optional(
          t.Enum({
            late: "LATE",
            present: "PRESENT",
            absent: "ABSENT",
            leave: "LEAVE",
          }),
        ),
        checkIn: t.Optional(t.String()),
        checkOut: t.Optional(t.String()),
        shiftName: t.String(),
        expectedCheckIn: t.String(),
        expectedCheckOut: t.Optional(t.String()),
        note: t.String(),
        reason: t.String(),
        forceBypassSubmission: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "[HRD] Buat absensi manual baru untuk karyawan" },
    },
  )
  // & ============ KOREKSI ABSENSI OLEH HRD ============
  .put(
    "/admin/correct/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await AttendanceService.correctAttendance(
          auth!.sub,
          params.id,
          {
            checkIn: body.checkIn,
            checkOut: body.checkOut,
            status: body.status,
            statusCheckOut: body.statusCheckOut,
            note: body.note,
            reason: body.reason,
            forceBypassSubmission: body.forceBypassSubmission,
          },
        );
        return successResponse({
          data,
          message: "Absensi berhasil dikoreksi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkHR],
      body: t.Object({
        checkIn: t.Optional(t.String()),
        checkOut: t.Optional(t.String()),
        status: t.Optional(
          t.Enum({
            late: "LATE",
            present: "PRESENT",
            absent: "ABSENT",
            leave: "LEAVE",
          }),
        ),
        statusCheckOut: t.Optional(
          t.Enum({
            late: "LATE",
            present: "PRESENT",
            absent: "ABSENT",
            leave: "LEAVE",
          }),
        ),
        note: t.String(),
        reason: t.Optional(t.String()),
        forceBypassSubmission: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "[HRD] Koreksi data absensi yang sudah ada" },
    },
  )

  // & ============ LAPORAN: STATS SUMMARY (KARTU DASHBOARD) ============
  .get(
    "/admin/stats",
    async ({ query, set }) => {
      try {
        const data = await AttendanceService.getSummaryStats({
          startDate: query.startDate,
          endDate: query.endDate,
          divisionId: query.divisionId,
          employeeId: query.employeeId,
        });
        return successResponse({
          data,
          message: "Statistik absensi berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        divisionId: t.Optional(t.String()),
        employeeId: t.Optional(t.String()),
      }),
      detail: { summary: "[Admin] Stats ringkasan absensi (kartu dashboard)" },
    },
  )

  // & ============ LAPORAN: EXPORT XLSX / CSV ============
  .get(
    "/admin/export",
    async ({ query, set }) => {
      try {
        const result = await AttendanceService.exportAttendances({
          startDate: query.startDate,
          endDate: query.endDate,
          format: query.format as "xlsx" | "csv" | undefined,
          divisionId: query.divisionId,
          status: query.status,
          employeeId: query.employeeId,
        });
        return new Response(result.buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": result.contentType,
            "Content-Disposition": `attachment; filename="${result.filename}"`,
          },
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: t.Object({
        startDate: t.String(),
        endDate: t.String(),
        format: t.Optional(t.Union([t.Literal("xlsx"), t.Literal("csv")])),
        divisionId: t.Optional(t.String()),
        status: t.Optional(t.String()),
        employeeId: t.Optional(t.String()),
      }),
      detail: {
        summary: "[Admin] Export data absensi ke Excel/CSV (periode a–b)",
      },
    },
  )

  // & ============ LAPORAN: GET ALL ABSENSI DENGAN PAGINATION ============
  .get(
    "/admin",
    async ({ query, set }) => {
      try {
        const result = await AttendanceService.getAll({
          page: Number(query.page ?? 1),
          limit: Number(query.limit ?? 20),
          startDate: query.startDate,
          endDate: query.endDate,
          status: query.status,
          employeeId: query.employeeId,
          divisionId: query.divisionId,
          search: query.search,
          withEmployee: query.withEmployee === "true",
          isManualEntry:
            query.isManualEntry !== undefined
              ? query.isManualEntry === "true"
              : undefined,
        });
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Data absensi berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
        status: t.Optional(t.String()),
        employeeId: t.Optional(t.String()),
        divisionId: t.Optional(t.String()),
        search: t.Optional(t.String()),
        withEmployee: t.Optional(t.String()),
        isManualEntry: t.Optional(t.String()),
      }),
      detail: {
        summary: "[Admin] List semua absensi dengan pagination & filter",
      },
    },
  )

  // & ============ LAPORAN: GET BY ID (DETAIL LENGKAP) ============
  .get(
    "/admin/:id",
    async ({ params, set }) => {
      try {
        const data = await AttendanceService.getById(params.id);
        return successResponse({
          data,
          message: "Detail absensi berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      detail: { summary: "[Admin] Detail lengkap satu record absensi" },
    },
  );

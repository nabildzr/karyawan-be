import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin, checkAuth } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { resolveAuditActor } from "../../shared/audit/actor";
import {
  AssignEmployeesDTO,
  CreateScheduleDTO,
  MobileSummaryQueryDTO,
} from "./model";
import { WorkingScheduleService } from "./service";

export const workingScheduleRoutes = new Elysia({
  prefix: "/working-schedules",
  detail: { tags: ["Working Schedules"] },
})
  .use(authPlugin)

  // ──────────────────────────────────────────
  // & POST / — Buat Jadwal Kerja (Admin)
  // ──────────────────────────────────────────
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await WorkingScheduleService.create(
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Jadwal kerja berhasil dibuat.",
        });
      } catch (error: any) {
        console.log("Error creating working schedule:", error);
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: CreateScheduleDTO,
      detail: { summary: "Buat jadwal kerja baru" },
    },
  )

  // ──────────────────────────────────────────
  // & POST / — Update Jadwal Kerja (Admin)
  // ──────────────────────────────────────────
  .put(
    "/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await WorkingScheduleService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        return successResponse({
          data,
          message: "Jadwal kerja berhasil diperbarui.",
        });
      } catch (error: any) {
        console.log("Error updating working schedule:", error);
        return mapError(error, set);
      }
    },

    {
      beforeHandle: [checkAdmin],
      params: t.Object({ id: t.String() }),
      body: CreateScheduleDTO,
      detail: { summary: "Update jadwal kerja" },
    },
  )

  // ──────────────────────────────────────────
  // &  GET / — List Semua Jadwal (Admin)
  // ──────────────────────────────────────────
  .get(
    "/",
    async ({ set, query }) => {
      try {
        const result = await WorkingScheduleService.findAll({
          withDays: Boolean(query.withDays),
          withShifts: Boolean(query.withShifts),
        });
        return successResponse({
          data: result.data,
          message: "Daftar jadwal kerja berhasil diambil.",
          meta: result.stats,
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: t.Object({
        withDays: t.Optional(t.Boolean({ default: false })),
        withShifts: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "List semua jadwal kerja" },
    },
  )

  // ──────────────────────────────────────────
  // &  GET / — Detail Jadwal (Admin)
  // ──────────────────────────────────────────
  .get(
    "/:id",
    async ({ params, set, query }) => {
      try {
        const data = await WorkingScheduleService.findById(params.id);
        return successResponse({
          data,
          message: "Detail jadwal kerja berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      detail: { summary: "Detail jadwal kerja" },
    },
  )

  // ──────────────────────────────────────────
  // & GET /mobile/summary — Kalender Absen (Mobile)
  // & ⚠ Didaftarkan SEBELUM /:id supaya tidak ke-match sbg param
  // ──────────────────────────────────────────
  .get(
    "/mobile/summary",
    async ({ auth, query, set }) => {
      try {
        const userId = auth!.sub;
        const data = await WorkingScheduleService.getMobileSummary(
          userId,
          query.startDate,
          query.endDate,
          query.timezone,
        );
        return successResponse({
          data,
          message: "Ringkasan jadwal berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: MobileSummaryQueryDTO,
      detail: { summary: "Ringkasan jadwal (Mobile)" },
    },
  )

  // ──────────────────────────────────────────
  // & PUT /:id/assign — Update Karyawan (Admin)
  // ──────────────────────────────────────────
  .put(
    "/:id/assign",
    async ({ auth, params, body, set }) => {
      try {
        const data = await WorkingScheduleService.assignEmployees(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        return successResponse({
          data,
          message: "Daftar karyawan pada jadwal berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: t.Object({ id: t.String() }),
      body: AssignEmployeesDTO,
      detail: { summary: "Assign karyawan ke jadwal" },
    },
  );

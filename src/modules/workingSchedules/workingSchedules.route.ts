import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin, checkAuth } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  AssignEmployeesDTO,
  CreateScheduleDTO,
  MobileSummaryQueryDTO,
} from "./workingSchedules.schema";
import { WorkingScheduleService } from "./workingSchedules.service";

export const workingScheduleRoutes = new Elysia({
  prefix: "/working-schedules",
  detail: { tags: ["Working Schedules"] },
})
  .use(authPlugin)
  .post(
    "/",
    async ({ auth, body, set }: any) => {
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
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: CreateScheduleDTO,
      detail: { summary: "Buat jadwal kerja baru" },
    },
  )
  .put(
    "/:id",
    async ({ auth, params, body, set }: any) => {
      try {
        const data = await WorkingScheduleService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Jadwal kerja berhasil diperbarui.",
        });
      } catch (error: any) {
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
  .get(
    "/",
    async ({ set, query }: any) => {
      try {
        const result = await WorkingScheduleService.findAll({
          withDays: Boolean(query.withDays),
          withShifts: Boolean(query.withShifts),
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
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
  .get(
    "/:id",
    async ({ params, set }: any) => {
      try {
        const data = await WorkingScheduleService.findById(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;
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
  .get(
    "/mobile/summary",
    async ({ auth, query, set }: any) => {
      try {
        const data = await WorkingScheduleService.getMobileSummary(
          auth!.sub,
          query.startDate,
          query.endDate,
          query.timezone,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
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
  .put(
    "/:id/assign",
    async ({ auth, params, body, set }: any) => {
      try {
        const data = await WorkingScheduleService.assignEmployees(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
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

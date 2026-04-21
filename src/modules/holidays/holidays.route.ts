import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  HolidayCreateBodyDTO,
  HolidayIdParamsDTO,
  HolidayListQueryDTO,
  HolidayUpdateBodyDTO,
} from "./holidays.schema";
import { HolidayService } from "./holidays.service";

/** Mengekspor holidayRoutes untuk kebutuhan modul ini. */
export const holidayRoutes = new Elysia({
  prefix: "/holidays",
  detail: { tags: ["Holidays"] },
})
  .use(authPlugin)
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await HolidayService.getAll(query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          message: "Berhasil mengambil data hari libur.",
          meta: result.meta,
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      query: HolidayListQueryDTO,
      detail: {
        summary: "Ambil semua hari libur nasional (paginasi + filter)",
      },
    },
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const data = await HolidayService.getById(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil mengambil detail hari libur.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      params: HolidayIdParamsDTO,
      detail: { summary: "Ambil detail hari libur berdasarkan ID" },
    },
  )
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await HolidayService.create(body, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_201_CREATED;

        return successResponse({
          data,
          message: "Hari libur berhasil ditambahkan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: HolidayCreateBodyDTO,
      detail: { summary: "Tambah hari libur baru secara manual" },
    },
  )
  .put(
    "/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await HolidayService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Hari libur berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: HolidayIdParamsDTO,
      body: HolidayUpdateBodyDTO,
      detail: { summary: "Perbarui data hari libur berdasarkan ID" },
    },
  )
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        await HolidayService.delete(params.id, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({ message: "Hari libur berhasil dihapus." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: HolidayIdParamsDTO,
      detail: { summary: "Hapus hari libur berdasarkan ID" },
    },
  )
  .post(
    "/sync",
    async ({ auth, set }) => {
      try {
        const result = await HolidayService.syncFromExternal(resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          message: `Sinkronisasi berhasil. ${result.inserted} hari libur disimpan.`,
          meta: { inserted: result.inserted },
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      detail: {
        summary: "Sinkronisasi hari libur nasional dari API eksternal",
        description:
          "Mengambil data dari sumber publik (GitHub: guangrei/APIHariLibur_V2). " +
          "Strategi: Wipe & Replace — semua data lama dihapus, diganti data terbaru.",
      },
    },
  );

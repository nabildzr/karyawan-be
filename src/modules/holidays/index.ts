import { Elysia, t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { resolveAuditActor } from "../../shared/audit/actor";
import { HolidayService } from "./service";

export const holidayRoutes = new Elysia({
  prefix: "/holidays",
  detail: { tags: ["Holidays"] },
})
  .use(authPlugin)
  // & ====== GET ALL Public Holidays ======
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await HolidayService.getAll({
          page: query.page,
          limit: query.limit,
          year: query.year,
          search: query.search,
        });
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
      query: t.Object({
        page: t.Optional(t.Number({ default: 1, minimum: 1 })),
        limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
        year: t.Optional(
          t.Number({ description: "Filter berdasarkan tahun, misal: 2026" }),
        ),
        search: t.Optional(
          t.String({ description: "Cari berdasarkan nama hari libur" }),
        ),
      }),
      detail: {
        summary: "Ambil semua hari libur nasional (paginasi + filter)",
      },
    },
  )
  // & ====== GET BY ID ======
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
      params: t.Object({ id: t.String() }),
      detail: { summary: "Ambil detail hari libur berdasarkan ID" },
    },
  )
  // & ====== POST CREATE ======
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await HolidayService.create(
          {
            name: body.name,
            date: new Date(body.date),
          },
          resolveAuditActor(auth),
        );
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
      body: t.Object({
        name: t.String({ minLength: 1, description: "Nama hari libur" }),
        date: t.String({
          format: "date",
          description: "Tanggal dalam format YYYY-MM-DD",
        }),
      }),
      detail: { summary: "Tambah hari libur baru secara manual" },
    },
  )
  // & ====== PUT UPDATE ======
  .put(
    "/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await HolidayService.update(
          params.id,
          {
            ...(body.name && { name: body.name }),
            ...(body.date && { date: new Date(body.date) }),
          },
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
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        date: t.Optional(t.String({ format: "date" })),
      }),
      detail: { summary: "Perbarui data hari libur berdasarkan ID" },
    },
  )
  // & ====== DELETE ======
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
      params: t.Object({ id: t.String() }),
      detail: { summary: "Hapus hari libur berdasarkan ID" },
    },
  )
  // & ====== POST SYNC dari API eksternal ======
  .post(
    "/sync",
    async ({ auth, set }) => {
      try {
        const result = await HolidayService.syncFromExternal(
          resolveAuditActor(auth),
        );
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

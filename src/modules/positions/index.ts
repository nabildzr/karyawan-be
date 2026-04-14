import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { resolveAuditActor } from "../../shared/audit/actor";
import { PositionService } from "./service";

export const positionRoutes = new Elysia({
  prefix: "/positions",
  detail: { tags: ["Positions"] },
})
  .use(authPlugin)
  // & ====== GET ALL Positions ======
  .get(
    "/",
    async ({ set, query }) => {
      try {
        const data = await PositionService.getAll({
          withDivision: Boolean(query.withDivision),
          withEmployees: Boolean(query.withEmployees),
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil data posisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: t.Object({
        withDivision: t.Optional(t.Boolean({ default: false })),
        withEmployees: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "Ambil semua data posisi" },
    },
  )
  // & ====== GET BY ID Position ======
  .get(
    "/:id",
    async ({ set, query, params }) => {
      try {
        const data = await PositionService.getById(params.id, {
          withDivision: Boolean(query.withDivision),
          withEmployees: Boolean(query.withEmployees),
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil detail posisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: t.Object({ id: t.String() }),
      query: t.Object({
        withDivision: t.Optional(t.Boolean({ default: true })),
        withEmployees: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "Ambil detail posisi berdasarkan ID" },
    },
  )
  // & ====== POST CREATE Position ======
  .post(
    "/",
    async ({ auth, set, body }) => {
      try {
        const data = await PositionService.create(
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Berhasil membuat posisi baru.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: t.Object({
        name: t.String({ minLength: 1 }),
        gajiPokok: t.Number({ minimum: 0 }),
        isManagerial: t.Optional(t.Boolean({ default: false })),
        divisionId: t.Optional(t.String()),
      }),
      detail: { summary: "Buat posisi baru" },
    },
  )
  // & ====== PUT UPDATE Position ======
  .put(
    "/:id",
    async ({ auth, set, params, body }) => {
      try {
        const data = await PositionService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil memperbarui posisi.",
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
        gajiPokok: t.Optional(t.Number({ minimum: 0 })),
        isManagerial: t.Optional(t.Boolean()),
        divisionId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: { summary: "Perbarui posisi" },
    },
  )
  // & ====== DELETE Position ======
  .delete(
    "/:id",
    async ({ auth, set, params }) => {
      try {
        await PositionService.delete(params.id, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          message: "Berhasil menghapus posisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: t.Object({ id: t.String() }),
      detail: { summary: "Hapus posisi (gagal jika masih ada karyawan)" },
    },
  );

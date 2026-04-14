import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { resolveAuditActor } from "../../shared/audit/actor";
import { DivisionService } from "./service";

export const divisionRoutes = new Elysia({
  prefix: "/divisions",
  detail: { tags: ["Divisions"] },
})
  .use(authPlugin)
  // & ====== GET ALL Divisions ======
  .get(
    "/",
    async ({ set, query }) => {
      try {
        const data = await DivisionService.getAll({
          withPositions: Boolean(query.withPositions),
          withManager: Boolean(query.withManager),
          withEmployees: Boolean(query.withEmployees),
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil data divisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: t.Object({
        withPositions: t.Optional(t.Boolean({ default: false })),
        withManager: t.Optional(t.Boolean({ default: false })),
        withEmployees: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "Ambil semua data divisi" },
    },
  )
  // & ====== GET BY ID Division ======
  .get(
    "/:id",
    async ({ set, query, params }) => {
      try {
        const data = await DivisionService.getById(params.id, {
          withPositions: Boolean(query.withPositions),
          withManager: Boolean(query.withManager),
          withEmployees: Boolean(query.withEmployees),
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil detail divisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: t.Object({ id: t.String() }),
      query: t.Object({
        withPositions: t.Optional(t.Boolean({ default: true })),
        withManager: t.Optional(t.Boolean({ default: true })),
        withEmployees: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "Ambil detail divisi berdasarkan ID" },
    },
  )
  // & ====== POST CREATE Division ======
  .post(
    "/",
    async ({ auth, set, body }) => {
      try {
        const data = await DivisionService.create(
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Berhasil membuat divisi baru.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        managerId: t.Optional(t.String()),
      }),
      detail: { summary: "Buat divisi baru" },
    },
  )
  // & ====== PUT UPDATE Division ======
  .put(
    "/:id",
    async ({ auth, set, params, body }) => {
      try {
        const data = await DivisionService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil memperbarui divisi.",
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
        description: t.Optional(t.String()),
        managerId: t.Optional(t.Union([t.String(), t.Null()])),
      }),
      detail: { summary: "Perbarui divisi" },
    },
  )
  // & ====== DELETE Division ======
  .delete(
    "/:id",
    async ({ auth, set, params }) => {
      try {
        await DivisionService.delete(params.id, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          message: "Berhasil menghapus divisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: t.Object({ id: t.String() }),
      detail: { summary: "Hapus divisi (gagal jika masih ada posisi)" },
    },
  );

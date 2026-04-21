import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  DivisionCreateBodyDTO,
  DivisionDetailParamsDTO,
  DivisionDetailQueryDTO,
  DivisionListQueryDTO,
  DivisionUpdateBodyDTO,
} from "./divisions.schema";
import { DivisionService } from "./divisions.service";

/** Mengekspor divisionRoutes untuk kebutuhan modul ini. */
export const divisionRoutes = new Elysia({
  prefix: "/divisions",
  detail: { tags: ["Divisions"] },
})
  .use(authPlugin)
  .get(
    "/",
    async ({ set, query }) => {
      try {
        const result = await DivisionService.getAll(query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          message: "Berhasil mengambil data divisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: DivisionListQueryDTO,
      detail: { summary: "Ambil semua data divisi" },
    },
  )
  .get(
    "/:id",
    async ({ set, query, params }) => {
      try {
        const data = await DivisionService.getById(params.id, query);
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
      params: DivisionDetailParamsDTO,
      query: DivisionDetailQueryDTO,
      detail: { summary: "Ambil detail divisi berdasarkan ID" },
    },
  )
  .post(
    "/",
    async ({ auth, set, body }) => {
      try {
        const data = await DivisionService.create(body, resolveAuditActor(auth));
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
      body: DivisionCreateBodyDTO,
      detail: { summary: "Buat divisi baru" },
    },
  )
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
      params: DivisionDetailParamsDTO,
      body: DivisionUpdateBodyDTO,
      detail: { summary: "Perbarui divisi" },
    },
  )
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
      params: DivisionDetailParamsDTO,
      detail: { summary: "Hapus divisi (gagal jika masih ada posisi)" },
    },
  );

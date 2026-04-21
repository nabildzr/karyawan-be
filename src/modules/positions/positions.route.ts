import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  PositionCreateBodyDTO,
  PositionDetailParamsDTO,
  PositionDetailQueryDTO,
  PositionListQueryDTO,
  PositionUpdateBodyDTO,
} from "./positions.schema";
import { PositionService } from "./positions.service";

/** Mengekspor positionRoutes untuk kebutuhan modul ini. */
export const positionRoutes = new Elysia({
  prefix: "/positions",
  detail: { tags: ["Positions"] },
})
  .use(authPlugin)
  .get(
    "/",
    async ({ set, query }) => {
      try {
        const result = await PositionService.getAll(query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          message: "Berhasil mengambil data posisi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: PositionListQueryDTO,
      detail: { summary: "Ambil semua data posisi" },
    },
  )
  .get(
    "/:id",
    async ({ set, query, params }) => {
      try {
        const data = await PositionService.getById(params.id, query);
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
      params: PositionDetailParamsDTO,
      query: PositionDetailQueryDTO,
      detail: { summary: "Ambil detail posisi berdasarkan ID" },
    },
  )
  .post(
    "/",
    async ({ auth, set, body }) => {
      try {
        const data = await PositionService.create(body, resolveAuditActor(auth));
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
      body: PositionCreateBodyDTO,
      detail: { summary: "Buat posisi baru" },
    },
  )
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
      params: PositionDetailParamsDTO,
      body: PositionUpdateBodyDTO,
      detail: { summary: "Perbarui posisi" },
    },
  )
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
      params: PositionDetailParamsDTO,
      detail: { summary: "Hapus posisi (gagal jika masih ada karyawan)" },
    },
  );

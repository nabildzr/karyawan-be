import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin, checkAuth, checkHR } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  FaceAdminListQueryDTO,
  FaceAdminRegisterBodyDTO,
  FaceAdminUserParamsDTO,
  FaceRegisterBodyDTO,
} from "./faces.schema";
import { FaceService } from "./faces.service";

/** Mengekspor faceRoutes untuk kebutuhan modul ini. */
export const faceRoutes = new Elysia({
  prefix: "/faces",
  detail: { tags: ["Faces"] },
})
  .use(authPlugin)
  .post(
    "/register",
    async ({ auth, body, set }) => {
      try {
        await FaceService.registerFace(auth!.sub, body.image, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_201_CREATED;

        return successResponse({
          message: "Registrasi biometrik berhasil. Wajah Anda telah diamankan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: FaceRegisterBodyDTO,
      detail: { summary: "Registrasi wajah baru" },
    },
  )
  .put(
    "/update",
    async ({ auth, body, set }) => {
      try {
        await FaceService.updateFace(auth!.sub, body.image, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          message: "Update biometrik berhasil. Wajah Anda telah diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: FaceRegisterBodyDTO,
      detail: { summary: "Update wajah yang sudah terdaftar" },
    },
  )
  .get(
    "/check",
    async ({ auth, set }) => {
      try {
        const isRegistered = await FaceService.isFaceRegistered(auth!.sub);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: { isRegistered },
          message: "Status registrasi wajah berhasil dicek.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      detail: { summary: "Cek apakah wajah sudah terdaftar" },
    },
  )
  .get(
    "/admin",
    async ({ query, set }) => {
      try {
        const result = await FaceService.getAllFaces(query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Data wajah berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: FaceAdminListQueryDTO,
      detail: { summary: "[Admin] List semua data wajah terdaftar" },
    },
  )
  .post(
    "/admin/register",
    async ({ auth, body, set }) => {
      try {
        await FaceService.registerFace(
          body.userId,
          body.image,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;

        return successResponse({
          message: "Registrasi biometrik berhasil. Wajah Anda telah diamankan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: FaceAdminRegisterBodyDTO,
      detail: { summary: "Registrasi wajah baru" },
    },
  )
  .get(
    "/admin/:userId",
    async ({ params, set }) => {
      try {
        const face = await FaceService.getFaceByUserId(params.userId);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: face,
          message: "Data wajah berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: FaceAdminUserParamsDTO,
      detail: { summary: "[Admin] Ambil data wajah berdasarkan userId" },
    },
  )
  .put(
    "/admin/:userId",
    async ({ auth, params, body, set }) => {
      try {
        await FaceService.updateFace(
          params.userId,
          body.image,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          message: "Wajah pengguna berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkHR],
      params: FaceAdminUserParamsDTO,
      body: FaceRegisterBodyDTO,
      detail: { summary: "[HR] Update wajah pengguna tertentu" },
    },
  )
  .delete(
    "/admin/:userId",
    async ({ auth, params, set }) => {
      try {
        await FaceService.deleteFace(params.userId, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          message: "Data wajah pengguna berhasil dihapus.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkHR],
      params: FaceAdminUserParamsDTO,
      detail: { summary: "[HR] Hapus data wajah pengguna" },
    },
  );

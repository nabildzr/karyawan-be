import { Elysia, t } from "elysia";
import {
  authPlugin,
  checkAdmin,
  checkAuth,
  checkHR,
} from "../../middleware/auth";
import { mapError } from "../../utils/mapError";
import { successResponse } from "../../utils/response_helper";
import { resolveAuditActor } from "../../shared/audit/actor";
import { FaceService } from "./service";

export const faceRoutes = new Elysia({
  prefix: "/faces",
  detail: { tags: ["Faces"] },
})
  .use(authPlugin)

  // & ====== USER ROUTES ======

  // POST /faces/register — daftarkan wajah sendiri
  .post(
    "/register",
    async ({ auth, body, set }) => {
      try {
        await FaceService.registerFace(
          auth!.sub,
          body.image,
          resolveAuditActor(auth),
        );
        set.status = 201;
        return successResponse({
          message: "Registrasi biometrik berhasil. Wajah Anda telah diamankan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: t.Object({
        image: t.File({
          type: ["image/jpeg", "image/png"],
          maxSize: 5 * 1024 * 1024,
        }),
      }),
      detail: { summary: "Registrasi wajah baru" },
    },
  )

  // PUT /faces/update — perbarui wajah sendiri
  .put(
    "/update",
    async ({ auth, body, set }) => {
      try {
        await FaceService.updateFace(
          auth!.sub,
          body.image,
          resolveAuditActor(auth),
        );
        return successResponse({
          message: "Update biometrik berhasil. Wajah Anda telah diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: t.Object({
        image: t.File({
          type: ["image/jpeg", "image/png"],
          maxSize: 5 * 1024 * 1024,
        }),
      }),
      detail: { summary: "Update wajah yang sudah terdaftar" },
    },
  )

  // GET /faces/check — cek apakah wajah sendiri sudah terdaftar
  .get(
    "/check",
    async ({ auth, set }) => {
      try {
        const isRegistered = await FaceService.isFaceRegistered(auth!.sub);
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

  // & ====== ADMIN ROUTES ======

  // GET /faces/admin — list semua wajah terdaftar (Admin/HR/CEO/Manager)
  .get(
    "/admin",
    async ({ query, set }) => {
      try {
        const result = await FaceService.getAllFaces({
          page: query.page,
          limit: query.limit,
          search: query.search,
        });
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
      query: t.Object({
        page: t.Optional(t.Numeric({ default: 1 })),
        limit: t.Optional(t.Numeric({ default: 10 })),
        search: t.Optional(t.String({ default: "" })),
      }),
      detail: { summary: "[Admin] List semua data wajah terdaftar" },
    },
  )

  // POST /faces/admin/register — daftarkan wajah sendiri
  .post(
    "/admin/register",
    async ({ auth, body, set }) => {
      try {
        await FaceService.registerFace(
          body.userId,
          body.image,
          resolveAuditActor(auth),
        );
        set.status = 201;
        return successResponse({
          message: "Registrasi biometrik berhasil. Wajah Anda telah diamankan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: t.Object({
        userId: t.String(),
        image: t.File({
          type: ["image/jpeg", "image/png"],
          maxSize: 5 * 1024 * 1024,
        }),
      }),
      detail: { summary: "Registrasi wajah baru" },
    },
  )

  // GET /faces/admin/:userId — detail wajah berdasarkan userId (Admin/HR/CEO/Manager)
  .get(
    "/admin/:userId",
    async ({ params, set }) => {
      try {
        const face = await FaceService.getFaceByUserId(params.userId);
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
      detail: { summary: "[Admin] Ambil data wajah berdasarkan userId" },
    },
  )

  // PUT /faces/admin/:userId — update wajah pengguna manapun (HR & Admin saja)
  .put(
    "/admin/:userId",
    async ({ auth, params, body, set }) => {
      try {
        await FaceService.updateFace(
          params.userId,
          body.image,
          resolveAuditActor(auth),
        );
        return successResponse({
          message: "Wajah pengguna berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkHR],
      body: t.Object({
        image: t.File({
          type: ["image/jpeg", "image/png"],
          maxSize: 5 * 1024 * 1024,
        }),
      }),
      detail: { summary: "[HR] Update wajah pengguna tertentu" },
    },
  )

  // DELETE /faces/admin/:userId — hapus data wajah pengguna (HR & Admin saja)
  .delete(
    "/admin/:userId",
    async ({ auth, params, set }) => {
      try {
        await FaceService.deleteFace(params.userId, resolveAuditActor(auth));
        return successResponse({
          message: "Data wajah pengguna berhasil dihapus.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkHR],
      detail: { summary: "[HR] Hapus data wajah pengguna" },
    },
  );


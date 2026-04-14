import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { resolveAuditActor } from "../../shared/audit/actor";
import { AssessmentCategoryService } from "./service";

export const assessmentCategoriesRoutes = new Elysia({
  prefix: "/assessment-categories",
  detail: {
    tags: [
      "(Assessment Categories) Endpoints untuk mengelola kategori penilaian karyawan",
    ],
  },
})
  .use(authPlugin)

  // & --- STATS RINGKASAN KATEGORI ---
  .get(
    "/stats",
    async ({ set }) => {
      try {
        const data = await AssessmentCategoryService.getStats();
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil statistik kategori penilaian.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      detail: {
        summary: "Statistik ringkasan: total, aktif, non-aktif, lastUpdate",
      },
    },
  )

  // & --- GET ALL ASSESSMENT CATEGORIES ---
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const data = await AssessmentCategoryService.findAll(query);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil daftar kategori penilaian.",
        });
      } catch (error: any) {
        console.error("[GET_CATEGORIES] Error:", error);
        return mapError(error, set);
      }
    },
    {
      query: t.Object({
        isActive: t.Optional(t.String()),
        type: t.Optional(t.String()),
      }),
      detail: { summary: "Mengambil semua kategori penilaian" },
      beforeHandle: [checkAdmin],
    },
  )

  // & --- CREATE NEW ASSESSMENT CATEGORY ---
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await AssessmentCategoryService.create(
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Berhasil membuat kategori penilaian baru.",
        });
      } catch (error: any) {
        console.log("Error saat membuat kategori penilaian baru:", error);
        return mapError(error, set);
      }
    },
    {
      body: t.Object({
        name: t.String(),
        description: t.Optional(t.String()),
        type: t.Optional(t.String()), // cth: "Staff", "Guru"
        isVisibleToEmployee: t.Optional(t.Boolean({ default: true })),
        isActive: t.Optional(t.Boolean({ default: true })),
      }),
      detail: { summary: "Membuat kategori penilaian baru" },
      beforeHandle: [checkAdmin],
    },
  )

  // & --- PATCH, Ngedit nama kategori atau off kategori (isActive: false) ---
  .patch(
    "/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await AssessmentCategoryService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil memperbarui kategori penilaian.",
        });
      } catch (error: any) {
        console.error("[PATCH_CATEGORY] Error:", error);
        return mapError(error, set);
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        type: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        isVisibleToEmployee: t.Optional(t.Boolean()),
      }),
      detail: { summary: "Memperbarui kategori penilaian" },
      beforeHandle: [checkAdmin],
    },
  )

  // & --- DELETE ASSESSMENT CATEGORY ---
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await AssessmentCategoryService.delete(
          params.id,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil menghapus kategori penilaian.",
        });
      } catch (error: any) {
        console.error("[DELETE_CATEGORY] Error:", error);
        return mapError(error, set);
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: { summary: "Menghapus kategori penilaian" },
      beforeHandle: [checkAdmin],
    },
  );
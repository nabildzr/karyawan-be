import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  AssessmentCategoryListQueryDTO,
  AssessmentCategoryParamsDTO,
  CreateAssessmentCategoryBodyDTO,
  UpdateAssessmentCategoryBodyDTO,
} from "./assessmentCategories.schema";
import { AssessmentCategoryService } from "./assessmentCategories.service";

/** Mengekspor assessmentCategoriesRoutes untuk kebutuhan modul ini. */
export const assessmentCategoriesRoutes = new Elysia({
  prefix: "/assessment-categories",
  detail: {
    tags: [
      "(Assessment Categories) Endpoints untuk mengelola kategori penilaian karyawan",
    ],
  },
})
  .use(authPlugin)
  .get(
    "/stats",
    async ({ set }) => {
      try {
        const data = await AssessmentCategoryService.getAssessmentCategoryStats();
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
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await AssessmentCategoryService.getAssessmentCategoryList(query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          message: "Berhasil mengambil daftar kategori penilaian.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      query: AssessmentCategoryListQueryDTO,
      detail: { summary: "Mengambil semua kategori penilaian" },
    },
  )
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await AssessmentCategoryService.createAssessmentCategoryEntry(
          auth,
          body,
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;

        return successResponse({
          data,
          message: "Berhasil membuat kategori penilaian baru.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: CreateAssessmentCategoryBodyDTO,
      detail: { summary: "Membuat kategori penilaian baru" },
    },
  )
  .patch(
    "/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await AssessmentCategoryService.updateAssessmentCategoryEntry(
          auth,
          params.id,
          body,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil memperbarui kategori penilaian.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: AssessmentCategoryParamsDTO,
      body: UpdateAssessmentCategoryBodyDTO,
      detail: { summary: "Memperbarui kategori penilaian" },
    },
  )
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await AssessmentCategoryService.deleteAssessmentCategoryEntry(
          auth,
          params.id,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil menghapus kategori penilaian.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: AssessmentCategoryParamsDTO,
      detail: { summary: "Menghapus kategori penilaian" },
    },
  );

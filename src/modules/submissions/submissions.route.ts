import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin, checkAuth } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  SubmissionCreateDTO,
  SubmissionIdParamsDTO,
  SubmissionListQueryDTO,
  SubmissionMineQueryDTO,
  SubmissionStatusEnum,
  SubmissionStatusUpdateDTO,
  SubmissionTypeEnum,
} from "./submissions.schema";
import { SubmissionService } from "./submissions.service";

/** Mengekspor submissionRoutes untuk kebutuhan modul ini. */
export const submissionRoutes = new Elysia({
  prefix: "/submissions",
  detail: { tags: ["Submissions"] },
})
  .use(authPlugin)
  // ──────────────────────────────────────────
  // & GET / — Get All Submissions (Admin)
  // ──────────────────────────────────────────
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await SubmissionService.getAll({
          page: query.page,
          limit: query.limit,
          status: query.status,
          type: query.type,
          search: query.search,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil data pengajuan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      query: SubmissionListQueryDTO,
      detail: { summary: "Get all submissions (Admin)" },
    },
  )
  // ──────────────────────────────────────────
  // & GET /my — Get my submissions (Karyawan)
  // ──────────────────────────────────────────
  .get(
    "/my",
    async ({ auth, query, set }) => {
      try {
        const result = await SubmissionService.getMine(auth!.sub, {
          page: query.page,
          limit: query.limit,
          status: query.status,
          type: query.type,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil data pengajuan Anda.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: SubmissionMineQueryDTO,
      detail: { summary: "Get my submissions" },
    },
  )
  // ──────────────────────────────────────────
  // & GET /my/:id — Get my submission detail
  // ──────────────────────────────────────────
  .get(
    "/my/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await SubmissionService.getDetailById(params.id, {
          userId: auth!.sub,
          isAdmin: false,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil detail pengajuan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: SubmissionIdParamsDTO,
      detail: { summary: "Get my submission detail by id" },
    },
  )
  // ──────────────────────────────────────────
  // & GET /admin/:id — Get submission detail (Admin)
  // ──────────────────────────────────────────
  .get(
    "/admin/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await SubmissionService.getDetailById(params.id, {
          userId: auth!.sub,
          isAdmin: true,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil detail pengajuan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      params: SubmissionIdParamsDTO,
      detail: { summary: "Get submission detail by id (Admin)" },
    },
  )
  // ──────────────────────────────────────────
  // & POST / — Buat Submission Baru (Karyawan)
  // ──────────────────────────────────────────
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await SubmissionService.create(
          auth!.sub,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Berhasil membuat pengajuan baru.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: SubmissionCreateDTO,
      detail: { summary: "Create new submission" },
    },
  )

  // ──────────────────────────────────────────
  // & DELETE /:id — Hapus Submission (Admin)
  // ──────────────────────────────────────────
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        const data = await SubmissionService.deleteById(
          params.id,
          resolveAuditActor(auth),
        );

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil menghapus data pengajuan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      params: SubmissionIdParamsDTO,
      detail: { summary: "Delete submission (Admin)" },
    },
  )
  // ──────────────────────────────────────────
  // & PUT /:id/status — Approve / Reject (Admin)
  // ──────────────────────────────────────────
  .put(
    "/:id/status",
    async ({ auth, params, body, set }) => {
      try {
        const data = await SubmissionService.updateStatus(
          body,
          params.id,
          auth!.sub,
          auth!.rbacRoleKey ?? auth!.role ?? "SYSTEM",
        );

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil memperbarui status pengajuan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      body: SubmissionStatusUpdateDTO,
      beforeHandle: [checkAuth, checkAdmin],
      params: SubmissionIdParamsDTO,
      detail: { summary: "Update submission status (Admin)" },
    },
  )
  // TODO: tarik kembali pengajuan (karyawan) - endpoint baru: POST /:id/retract
  .delete(
    "/:id/retract",
    async ({ auth, params, set }) => {
      try {
        const data = await SubmissionService.retract(
          params.id,
          auth!.sub,
        );

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil menarik kembali pengajuan.",
        }); 
      } catch (error: any) {        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: SubmissionIdParamsDTO,
      detail: { summary: "Retract submission (Karyawan)" },
    },
  )

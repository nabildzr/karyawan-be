import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAuth, checkEvaluator } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  AssessmentIdParamsDTO,
  AssessmentIdRouteParamsDTO,
  CreateAssessmentBodyDTO,
  EmployeeIdParamsDTO,
  MyResultsQueryDTO,
  PeriodQueryDTO,
  ReportExportQueryDTO,
  ReportQueryDTO,
  StatsPenilaianQueryDTO,
  SubordinatesQueryDTO,
  UpdateAssessmentBodyDTO,
} from "./assessments.schema";
import { AssessmentsService } from "./assessments.service";

export const assessmentsRoutes = new Elysia({
  prefix: "/assessments",
  detail: {
    tags: [
      "(Assessments) Endpoints untuk mengelola penilaian karyawan bulanan",
    ],
  },
})
  .use(authPlugin)
  .get(
    "/stats-penilaian",
    async ({ query, auth, set }: any) => {
      try {
        const data = await AssessmentsService.getStatsForDashboard(
          auth!.sub,
          query.period,
          query.divisionId,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil statistik dashboard penilaian.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      query: StatsPenilaianQueryDTO,
      beforeHandle: [checkEvaluator],
      detail: {
        summary:
          "[Evaluator] Stats kartu dashboard: selesai, pending, rata-rata skor, deadline reset",
      },
    },
  )
  .get(
    "/report",
    async ({ query, auth, set }: any) => {
      try {
        const result = await AssessmentsService.getReport(auth!.sub, {
          period: query.period,
          page: query.page ? Number(query.page) : 1,
          limit: query.limit ? Number(query.limit) : 20,
          divisionId: query.divisionId,
          search: query.search,
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil laporan penilaian.",
          stats: result.stats,
        } as any);
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkEvaluator],
      query: ReportQueryDTO,
      detail: {
        summary:
          "[Evaluator] Laporan penilaian: list tabel + stats cards (totalPenilaian, rata-rata, tertinggi, terendah)",
      },
    },
  )
  .get(
    "/report/export",
    async ({ query, auth, set }: any) => {
      try {
        const result = await AssessmentsService.exportReport(auth!.sub, {
          period: query.period,
          divisionId: query.divisionId,
          search: query.search,
          format: query.format as "xlsx" | "pdf" | undefined,
        });
        return new Response(result.buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": result.contentType,
            "Content-Disposition": `attachment; filename="${result.filename}"`,
          },
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkEvaluator],
      query: ReportExportQueryDTO,
      detail: {
        summary: "[Evaluator] Export laporan penilaian ke Excel atau PDF",
      },
    },
  )
  .get(
    "/individual/by-employee/:employeeId",
    async ({ params, query, set }: any) => {
      try {
        const data = await AssessmentsService.getIndividualReportByEmployee(
          params.employeeId,
          query.period,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil laporan individu.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkEvaluator],
      params: EmployeeIdParamsDTO,
      query: PeriodQueryDTO,
      detail: {
        summary:
          "[Evaluator] Laporan individu per karyawan dengan period selector",
      },
    },
  )
  .get(
    "/individual/:assessmentId/export-pdf",
    async ({ params, set }: any) => {
      try {
        const buffer = await AssessmentsService.exportIndividualPDF(
          params.assessmentId,
        );
        return new Response(buffer as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="laporan_individu_${params.assessmentId}.pdf"`,
          },
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkEvaluator],
      params: AssessmentIdParamsDTO,
      detail: { summary: "[Evaluator] Download PDF laporan individu" },
    },
  )
  .get(
    "/individual/:assessmentId",
    async ({ params, set }: any) => {
      try {
        const data = await AssessmentsService.getIndividualReport(
          params.assessmentId,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil laporan individu.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkEvaluator],
      params: AssessmentIdParamsDTO,
      detail: {
        summary:
          "[Evaluator] Detail laporan individu berdasarkan assessment ID",
      },
    },
  )
  .get(
    "/subordinates",
    async ({ query, auth, set }: any) => {
      try {
        const data = await AssessmentsService.getSubordinates(
          auth!.sub,
          query.period,
          query.divisionId,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil daftar karyawan dan status review-nya.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      query: SubordinatesQueryDTO,
      beforeHandle: [checkEvaluator],
      detail: {
        summary:
          "[Evaluator] Daftar karyawan dalam scope + status sudah/belum dinilai",
      },
    },
  )
  .post(
    "/",
    async ({ body, auth, set }: any) => {
      try {
        const data = await AssessmentsService.create(auth!.sub, body);
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Berhasil menyimpan hasil evaluasi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      body: CreateAssessmentBodyDTO,
      beforeHandle: [checkEvaluator],
      detail: { summary: "[Evaluator] Submit penilaian baru untuk karyawan" },
    },
  )
  .patch(
    "/:id",
    async ({ params, body, auth, set }: any) => {
      try {
        const data = await AssessmentsService.update(
          params.id,
          body,
          auth!.sub,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil memperbarui evaluasi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      params: AssessmentIdRouteParamsDTO,
      body: UpdateAssessmentBodyDTO,
      beforeHandle: [checkEvaluator],
      detail: { summary: "[Evaluator] Update penilaian yang sudah ada" },
    },
  )
  .get(
    "/my-results",
    async ({ query, auth, set }: any) => {
      try {
        const data = await AssessmentsService.getMyResults(
          auth!.sub,
          query.period,
        );
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil rapor evaluasi Anda.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      query: MyResultsQueryDTO,
      beforeHandle: [checkAuth],
      detail: { summary: "[Mobile] Lihat hasil penilaian diri sendiri" },
    },
  );

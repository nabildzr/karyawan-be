import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAuth, checkEvaluator } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { AssessmentsService } from "./service";

export const assessmentsRoutes = new Elysia({
  prefix: "/assessments",
  detail: {
    tags: [
      "(Assessments) Endpoints untuk mengelola penilaian karyawan bulanan",
    ],
  },
})
  .use(authPlugin)

  // & --- STATS DASHBOARD PENILAIAN (kartu: selesai, pending, rata-rata, deadline) ---
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
      query: t.Object({
        period: t.Optional(t.String({ description: "Contoh: 'Maret 2026'" })),
        divisionId: t.Optional(t.String()),
      }),
      beforeHandle: [checkEvaluator],
      detail: {
        summary:
          "[Evaluator] Stats kartu dashboard: selesai, pending, rata-rata skor, deadline reset",
      },
    },
  )

  // & --- LAPORAN PENILAIAN (LIST + STATS CARDS) ---
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
      query: t.Object({
        period: t.String({ description: "Contoh: 'Maret 2026'" }),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        divisionId: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
      detail: {
        summary:
          "[Evaluator] Laporan penilaian: list tabel + stats cards (totalPenilaian, rata-rata, tertinggi, terendah)",
      },
    },
  )

  // & --- EXPORT LAPORAN PENILAIAN (PDF / EXCEL) ---
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
      query: t.Object({
        period: t.String({ description: "Contoh: 'Maret 2026'" }),
        format: t.Optional(t.Union([t.Literal("xlsx"), t.Literal("pdf")])),
        divisionId: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
      detail: {
        summary: "[Evaluator] Export laporan penilaian ke Excel atau PDF",
      },
    },
  )

  // & --- LAPORAN INDIVIDU (berdasarkan employeeId + period) ---
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
      params: t.Object({ employeeId: t.String() }),
      query: t.Object({
        period: t.String({ description: "Contoh: 'Maret 2026'" }),
      }),
      detail: {
        summary:
          "[Evaluator] Laporan individu per karyawan dengan period selector",
      },
    },
  )

  // & --- EXPORT LAPORAN INDIVIDU (PDF) ---
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
      params: t.Object({ assessmentId: t.String() }),
      detail: { summary: "[Evaluator] Download PDF laporan individu" },
    },
  )

  // & --- LAPORAN INDIVIDU (berdasarkan assessmentId langsung) ---
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
      params: t.Object({ assessmentId: t.String() }),
      detail: {
        summary:
          "[Evaluator] Detail laporan individu berdasarkan assessment ID",
      },
    },
  )

  // & --- GET DAFTAR BAWAHAN & STATUS REVIEW (UNTUK FORM PENILAIAN) ---
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
      query: t.Object({
        period: t.String({ description: "Contoh: 'Maret 2026'" }),
        divisionId: t.Optional(t.String()),
      }),
      beforeHandle: [checkEvaluator],
      detail: {
        summary:
          "[Evaluator] Daftar karyawan dalam scope + status sudah/belum dinilai",
      },
    },
  )

  // & --- CREATE ASSESSMENT (SUBMIT NILAI) ---
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
      body: t.Object({
        evaluateeId: t.String(),
        period: t.String(),
        generalNotes: t.String(),
        details: t.Array(
          t.Object({
            categoryId: t.String(),
            categoryName: t.String(),
            score: t.Numeric(),
          }),
        ),
      }),
      beforeHandle: [checkEvaluator],
      detail: { summary: "[Evaluator] Submit penilaian baru untuk karyawan" },
    },
  )

  // & --- PATCH: UPDATE NILAI ---
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
      params: t.Object({ id: t.String() }),
      body: t.Object({
        generalNotes: t.Optional(t.String()),
        details: t.Optional(
          t.Array(
            t.Object({
              categoryId: t.String(),
              categoryName: t.String(),
              score: t.Numeric(),
            }),
          ),
        ),
      }),
      beforeHandle: [checkEvaluator],
      detail: { summary: "[Evaluator] Update penilaian yang sudah ada" },
    },
  )

  // & --- GET NILAI DIRI SENDIRI (MOBILE KARYAWAN) ---
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
      query: t.Object({ period: t.String() }),
      beforeHandle: [checkAuth],
      detail: { summary: "[Mobile] Lihat hasil penilaian diri sendiri" },
    },
  );

import { t } from "elysia";

export const StatsPenilaianQueryDTO = t.Object({
  period: t.Optional(t.String({ description: "Contoh: 'Maret 2026'" })),
  divisionId: t.Optional(t.String()),
});

export const ReportQueryDTO = t.Object({
  period: t.String({ description: "Contoh: 'Maret 2026'" }),
  page: t.Optional(t.String()),
  limit: t.Optional(t.String()),
  divisionId: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const ReportExportQueryDTO = t.Object({
  period: t.String({ description: "Contoh: 'Maret 2026'" }),
  format: t.Optional(t.Union([t.Literal("xlsx"), t.Literal("pdf")])),
  divisionId: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

export const EmployeeIdParamsDTO = t.Object({ employeeId: t.String() });
export const AssessmentIdParamsDTO = t.Object({ assessmentId: t.String() });
export const AssessmentIdRouteParamsDTO = t.Object({ id: t.String() });

export const PeriodQueryDTO = t.Object({
  period: t.String({ description: "Contoh: 'Maret 2026'" }),
});

export const SubordinatesQueryDTO = t.Object({
  period: t.String({ description: "Contoh: 'Maret 2026'" }),
  divisionId: t.Optional(t.String()),
});

export const AssessmentDetailItemDTO = t.Object({
  categoryId: t.String(),
  categoryName: t.String(),
  score: t.Numeric(),
});

export const CreateAssessmentBodyDTO = t.Object({
  evaluateeId: t.String(),
  period: t.String(),
  generalNotes: t.String(),
  details: t.Array(AssessmentDetailItemDTO),
});

export const UpdateAssessmentBodyDTO = t.Object({
  generalNotes: t.Optional(t.String()),
  details: t.Optional(t.Array(AssessmentDetailItemDTO)),
});

export const MyResultsQueryDTO = t.Object({ period: t.String() });

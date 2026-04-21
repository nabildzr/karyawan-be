import { t } from "elysia";

/** Mengekspor AssessmentCategoryListQueryDTO untuk kebutuhan modul ini. */
export const AssessmentCategoryListQueryDTO = t.Object({
  isActive: t.Optional(t.String()),
  type: t.Optional(t.String()),
});

/** Mengekspor AssessmentCategoryParamsDTO untuk kebutuhan modul ini. */
export const AssessmentCategoryParamsDTO = t.Object({
  id: t.String(),
});

/** Mengekspor CreateAssessmentCategoryBodyDTO untuk kebutuhan modul ini. */
export const CreateAssessmentCategoryBodyDTO = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  type: t.Optional(t.String()),
  isVisibleToEmployee: t.Optional(t.Boolean({ default: true })),
  isActive: t.Optional(t.Boolean({ default: true })),
});

/** Mengekspor UpdateAssessmentCategoryBodyDTO untuk kebutuhan modul ini. */
export const UpdateAssessmentCategoryBodyDTO = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String()),
  type: t.Optional(t.String()),
  isActive: t.Optional(t.Boolean()),
  isVisibleToEmployee: t.Optional(t.Boolean()),
});

/** Mengekspor AssessmentCategoryDTO untuk kebutuhan modul ini. */
export const AssessmentCategoryDTO = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  type: t.Union([t.String(), t.Null()]),
  isActive: t.Boolean(),
  isVisibleToEmployee: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mengekspor AssessmentCategoryStatsDTO untuk kebutuhan modul ini. */
export const AssessmentCategoryStatsDTO = t.Object({
  totalCategories: t.Number(),
  activeIndicators: t.Number(),
  offIndicators: t.Number(),
  lastUpdate: t.Union([t.String(), t.Null()]),
});

/** Mengekspor AssessmentCategoryListSuccessDTO untuk kebutuhan modul ini. */
export const AssessmentCategoryListSuccessDTO = t.Object({
  success: t.Boolean(),
  data: t.Array(AssessmentCategoryDTO),
  message: t.String(),
  error: t.Union([t.String(), t.Null()]),
  meta: t.Optional(t.Any()),
});

/** Mengekspor AssessmentCategorySingleSuccessDTO untuk kebutuhan modul ini. */
export const AssessmentCategorySingleSuccessDTO = t.Object({
  success: t.Boolean(),
  data: AssessmentCategoryDTO,
  message: t.String(),
  error: t.Union([t.String(), t.Null()]),
  meta: t.Optional(t.Any()),
});

/** Mengekspor AssessmentCategoryStatsSuccessDTO untuk kebutuhan modul ini. */
export const AssessmentCategoryStatsSuccessDTO = t.Object({
  success: t.Boolean(),
  data: AssessmentCategoryStatsDTO,
  message: t.String(),
  error: t.Union([t.String(), t.Null()]),
  meta: t.Optional(t.Any()),
});

/** Mendefinisikan alias tipe untuk AssessmentCategoryListQueryPayload. */
export type AssessmentCategoryListQueryPayload =
  typeof AssessmentCategoryListQueryDTO.static;

/** Mendefinisikan alias tipe untuk AssessmentCategoryParamsPayload. */
export type AssessmentCategoryParamsPayload =
  typeof AssessmentCategoryParamsDTO.static;

/** Mendefinisikan alias tipe untuk CreateAssessmentCategoryBodyPayload. */
export type CreateAssessmentCategoryBodyPayload =
  typeof CreateAssessmentCategoryBodyDTO.static;

/** Mendefinisikan alias tipe untuk UpdateAssessmentCategoryBodyPayload. */
export type UpdateAssessmentCategoryBodyPayload =
  typeof UpdateAssessmentCategoryBodyDTO.static;

/** Mendefinisikan alias tipe untuk AssessmentCategoryPayload. */
export type AssessmentCategoryPayload = typeof AssessmentCategoryDTO.static;

/** Mendefinisikan alias tipe untuk AssessmentCategoryStatsPayload. */
export type AssessmentCategoryStatsPayload = typeof AssessmentCategoryStatsDTO.static;

/** Mendefinisikan alias tipe untuk AssessmentCategoryListSuccessPayload. */
export type AssessmentCategoryListSuccessPayload =
  typeof AssessmentCategoryListSuccessDTO.static;

/** Mendefinisikan alias tipe untuk AssessmentCategorySingleSuccessPayload. */
export type AssessmentCategorySingleSuccessPayload =
  typeof AssessmentCategorySingleSuccessDTO.static;

/** Mendefinisikan alias tipe untuk AssessmentCategoryStatsSuccessPayload. */
export type AssessmentCategoryStatsSuccessPayload =
  typeof AssessmentCategoryStatsSuccessDTO.static;

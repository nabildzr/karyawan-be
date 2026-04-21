import { t } from "elysia";

/** Mengekspor PositionListQueryDTO untuk kebutuhan modul ini. */
export const PositionListQueryDTO = t.Object({
  withDivision: t.Optional(t.Boolean({ default: false })),
  withEmployees: t.Optional(t.Boolean({ default: false })),
});

/** Mengekspor PositionDetailParamsDTO untuk kebutuhan modul ini. */
export const PositionDetailParamsDTO = t.Object({
  id: t.String(),
});

/** Mengekspor PositionDetailQueryDTO untuk kebutuhan modul ini. */
export const PositionDetailQueryDTO = t.Object({
  withDivision: t.Optional(t.Boolean({ default: true })),
  withEmployees: t.Optional(t.Boolean({ default: false })),
});

/** Mengekspor PositionCreateBodyDTO untuk kebutuhan modul ini. */
export const PositionCreateBodyDTO = t.Object({
  name: t.String({ minLength: 1 }),
  gajiPokok: t.Number({ minimum: 0 }),
  isManagerial: t.Optional(t.Boolean({ default: false })),
  divisionId: t.Optional(t.String()),
});

/** Mengekspor PositionUpdateBodyDTO untuk kebutuhan modul ini. */
export const PositionUpdateBodyDTO = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  gajiPokok: t.Optional(t.Number({ minimum: 0 })),
  isManagerial: t.Optional(t.Boolean()),
  divisionId: t.Optional(t.Union([t.String(), t.Null()])),
});

/** Mengekspor PositionDivisionDTO untuk kebutuhan modul ini. */
export const PositionDivisionDTO = t.Object({
  id: t.String(),
  name: t.String(),
});

/** Mengekspor PositionEmployeeDTO untuk kebutuhan modul ini. */
export const PositionEmployeeDTO = t.Object({
  id: t.String(),
  fullName: t.String(),
  email: t.Union([t.String(), t.Null()]),
  phoneNumber: t.Union([t.String(), t.Null()]),
});

/** Mengekspor PositionDTO untuk kebutuhan modul ini. */
export const PositionDTO = t.Object({
  id: t.String(),
  name: t.String(),
  gajiPokok: t.Number(),
  isManagerial: t.Boolean(),
  divisionId: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
  division: t.Optional(t.Union([PositionDivisionDTO, t.Null()])),
  employees: t.Optional(t.Array(PositionEmployeeDTO)),
});

/** Mengekspor PositionListSuccessDTO untuk kebutuhan modul ini. */
export const PositionListSuccessDTO = t.Object({
  success: t.Boolean(),
  data: t.Array(PositionDTO),
  message: t.String(),
  error: t.Union([t.String(), t.Null()]),
  meta: t.Optional(t.Any()),
});

/** Mengekspor PositionSingleSuccessDTO untuk kebutuhan modul ini. */
export const PositionSingleSuccessDTO = t.Object({
  success: t.Boolean(),
  data: PositionDTO,
  message: t.String(),
  error: t.Union([t.String(), t.Null()]),
  meta: t.Optional(t.Any()),
});

/** Mendefinisikan alias tipe untuk PositionListQueryPayload. */
export type PositionListQueryPayload = typeof PositionListQueryDTO.static;

/** Mendefinisikan alias tipe untuk PositionDetailParamsPayload. */
export type PositionDetailParamsPayload = typeof PositionDetailParamsDTO.static;

/** Mendefinisikan alias tipe untuk PositionDetailQueryPayload. */
export type PositionDetailQueryPayload = typeof PositionDetailQueryDTO.static;

/** Mendefinisikan alias tipe untuk PositionCreateBodyPayload. */
export type PositionCreateBodyPayload = typeof PositionCreateBodyDTO.static;

/** Mendefinisikan alias tipe untuk PositionUpdateBodyPayload. */
export type PositionUpdateBodyPayload = typeof PositionUpdateBodyDTO.static;

/** Mendefinisikan alias tipe untuk PositionDivisionPayload. */
export type PositionDivisionPayload = typeof PositionDivisionDTO.static;

/** Mendefinisikan alias tipe untuk PositionEmployeePayload. */
export type PositionEmployeePayload = typeof PositionEmployeeDTO.static;

/** Mendefinisikan alias tipe untuk PositionPayload. */
export type PositionPayload = typeof PositionDTO.static;

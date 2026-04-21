import { t } from "elysia";

/** Mengekspor DivisionListQueryDTO untuk kebutuhan modul ini. */
export const DivisionListQueryDTO = t.Object({
  withPositions: t.Optional(t.Boolean({ default: false })),
  withManager: t.Optional(t.Boolean({ default: false })),
  withEmployees: t.Optional(t.Boolean({ default: false })),
});

/** Mengekspor DivisionDetailParamsDTO untuk kebutuhan modul ini. */
export const DivisionDetailParamsDTO = t.Object({
  id: t.String(),
});

/** Mengekspor DivisionDetailQueryDTO untuk kebutuhan modul ini. */
export const DivisionDetailQueryDTO = t.Object({
  withPositions: t.Optional(t.Boolean({ default: true })),
  withManager: t.Optional(t.Boolean({ default: true })),
  withEmployees: t.Optional(t.Boolean({ default: false })),
});

/** Mengekspor DivisionCreateBodyDTO untuk kebutuhan modul ini. */
export const DivisionCreateBodyDTO = t.Object({
  name: t.String({ minLength: 1 }),
  description: t.Optional(t.String()),
  managerId: t.Optional(t.String()),
});

/** Mengekspor DivisionUpdateBodyDTO untuk kebutuhan modul ini. */
export const DivisionUpdateBodyDTO = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.String()),
  managerId: t.Optional(t.Union([t.String(), t.Null()])),
});

/** Mengekspor DivisionManagerRoleDTO untuk kebutuhan modul ini. */
export const DivisionManagerRoleDTO = t.Object({
  id: t.String(),
  key: t.String(),
  name: t.String(),
  isActive: t.Boolean(),
  canAccessAdmin: t.Boolean(),
});

/** Mengekspor DivisionManagerEmployeeDTO untuk kebutuhan modul ini. */
export const DivisionManagerEmployeeDTO = t.Object({
  id: t.String(),
  fullName: t.String(),
  email: t.Union([t.String(), t.Null()]),
  phoneNumber: t.Union([t.String(), t.Null()]),
});

/** Mengekspor DivisionManagerDTO untuk kebutuhan modul ini. */
export const DivisionManagerDTO = t.Object({
  id: t.String(),
  nip: t.String(),
  rbacRole: t.Union([DivisionManagerRoleDTO, t.Null()]),
  employees: t.Array(DivisionManagerEmployeeDTO),
});

/** Mengekspor DivisionPositionEmployeeDTO untuk kebutuhan modul ini. */
export const DivisionPositionEmployeeDTO = t.Object({
  id: t.String(),
  fullName: t.String(),
  email: t.Union([t.String(), t.Null()]),
  phoneNumber: t.Union([t.String(), t.Null()]),
});

/** Mengekspor DivisionPositionDTO untuk kebutuhan modul ini. */
export const DivisionPositionDTO = t.Object({
  id: t.String(),
  name: t.String(),
  gajiPokok: t.Number(),
  isManagerial: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
  employees: t.Optional(t.Array(DivisionPositionEmployeeDTO)),
});

/** Mengekspor DivisionDTO untuk kebutuhan modul ini. */
export const DivisionDTO = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Union([t.String(), t.Null()]),
  managerId: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
  manager: t.Optional(t.Union([DivisionManagerDTO, t.Null()])),
  positions: t.Optional(t.Array(DivisionPositionDTO)),
});

/** Mendefinisikan alias tipe untuk DivisionListQueryPayload. */
export type DivisionListQueryPayload = typeof DivisionListQueryDTO.static;

/** Mendefinisikan alias tipe untuk DivisionDetailParamsPayload. */
export type DivisionDetailParamsPayload = typeof DivisionDetailParamsDTO.static;

/** Mendefinisikan alias tipe untuk DivisionDetailQueryPayload. */
export type DivisionDetailQueryPayload = typeof DivisionDetailQueryDTO.static;

/** Mendefinisikan alias tipe untuk DivisionCreateBodyPayload. */
export type DivisionCreateBodyPayload = typeof DivisionCreateBodyDTO.static;

/** Mendefinisikan alias tipe untuk DivisionUpdateBodyPayload. */
export type DivisionUpdateBodyPayload = typeof DivisionUpdateBodyDTO.static;

/** Mendefinisikan alias tipe untuk DivisionManagerRolePayload. */
export type DivisionManagerRolePayload = typeof DivisionManagerRoleDTO.static;

/** Mendefinisikan alias tipe untuk DivisionManagerEmployeePayload. */
export type DivisionManagerEmployeePayload = typeof DivisionManagerEmployeeDTO.static;

/** Mendefinisikan alias tipe untuk DivisionManagerPayload. */
export type DivisionManagerPayload = typeof DivisionManagerDTO.static;

/** Mendefinisikan alias tipe untuk DivisionPositionEmployeePayload. */
export type DivisionPositionEmployeePayload =
  typeof DivisionPositionEmployeeDTO.static;

/** Mendefinisikan alias tipe untuk DivisionPositionPayload. */
export type DivisionPositionPayload = typeof DivisionPositionDTO.static;

/** Mendefinisikan alias tipe untuk DivisionPayload. */
export type DivisionPayload = typeof DivisionDTO.static;

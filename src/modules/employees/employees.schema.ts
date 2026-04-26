import { t } from "elysia";
import { EmployeeDetailsPlain } from "../../generated/prismabox/EmployeeDetails";
import { EmployeesPlain } from "../../generated/prismabox/Employees";

const EmployeeRoleDTO = t.Union([
  t.Literal("CEO"),
  t.Literal("MANAGER"),
  t.Literal("HR"),
  t.Literal("ADMIN"),
  t.Literal("USER"),
]);

const EmployeeUserInputDTO = t.Object({
  nip: t.String({ minLength: 1 }),
  role: t.Optional(EmployeeRoleDTO),
  rbacRoleId: t.Optional(t.Union([t.String(), t.Null()])),
});

const EmployeeInputDTO = t.Omit(EmployeesPlain, [
  "id",
  "createdAt",
  "updatedAt",
  "userId",
]);

const EmployeeDetailsInputDTO = t.Omit(EmployeeDetailsPlain, [
  "employeeId",
  "createdAt",
  "updatedAt",
]);

/** Mengekspor EmployeeListQueryDTO untuk kebutuhan modul ini. */
export const EmployeeListQueryDTO = t.Object({
  page: t.Optional(t.Number({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 10000 })),
  search: t.Optional(t.String({ description: "Cari by nama, NIP, atau email" })),
  positionId: t.Optional(t.String()),
  divisionId: t.Optional(t.String()),
  workingSchedulesId: t.Optional(t.String()),
  role: t.Optional(EmployeeRoleDTO),
});

/** Mengekspor EmployeeDetailParamsDTO untuk kebutuhan modul ini. */
export const EmployeeDetailParamsDTO = t.Object({
  id: t.String(),
});

/** Mengekspor EmployeeMeQueryDTO untuk kebutuhan modul ini. */
export const EmployeeMeQueryDTO = t.Object({
  withEmployee: t.Optional(
    t.Boolean({
      default: false,
      description: "Set true untuk menyertakan relasi detail employee",
    }),
  ),
});

/** Mengekspor EmployeeCreateBodyDTO untuk kebutuhan modul ini. */
export const EmployeeCreateBodyDTO = t.Object({
  user: EmployeeUserInputDTO,
  employee: EmployeeInputDTO,
  details: t.Optional(EmployeeDetailsInputDTO),
});

/** Mengekspor EmployeeUpdateBodyDTO untuk kebutuhan modul ini. */
export const EmployeeUpdateBodyDTO = t.Object({
  user: t.Optional(t.Partial(EmployeeUserInputDTO)),
  employee: t.Optional(t.Partial(EmployeeInputDTO)),
  details: t.Optional(t.Partial(EmployeeDetailsInputDTO)),
});

/** Mendefinisikan alias tipe untuk EmployeeListQueryPayload. */
export type EmployeeListQueryPayload = typeof EmployeeListQueryDTO.static;

/** Mendefinisikan alias tipe untuk EmployeeDetailParamsPayload. */
export type EmployeeDetailParamsPayload = typeof EmployeeDetailParamsDTO.static;

/** Mendefinisikan alias tipe untuk EmployeeMeQueryPayload. */
export type EmployeeMeQueryPayload = typeof EmployeeMeQueryDTO.static;

/** Mendefinisikan alias tipe untuk EmployeeCreateBodyPayload. */
export type EmployeeCreateBodyPayload = typeof EmployeeCreateBodyDTO.static;

/** Mendefinisikan alias tipe untuk EmployeeUpdateBodyPayload. */
export type EmployeeUpdateBodyPayload = typeof EmployeeUpdateBodyDTO.static;

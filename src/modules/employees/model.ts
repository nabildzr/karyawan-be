import { t } from "elysia";
import { EmployeeDetailsPlain } from "../../generated/prismabox/EmployeeDetails";
import { EmployeesPlain } from "../../generated/prismabox/Employees";

// & ============ Omit Field-field otomatis dari db ============
const UserInputDTO = t.Object({
  nip: t.String({ minLength: 1 }),
  role: t.Optional(
    t.Union([
      t.Literal("CEO"),
      t.Literal("MANAGER"),
      t.Literal("HR"),
      t.Literal("ADMIN"),
      t.Literal("USER"),
    ]),
  ),
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

export const CreateEmployeeDTO = t.Object({
  user: UserInputDTO,
  employee: EmployeeInputDTO,
  details: t.Optional(EmployeeDetailsInputDTO), // optional karena bisa dibuat terpisah
});

export const UpdateEmployeeDTO = t.Object({
  user: t.Optional(t.Partial(UserInputDTO)),
  employee: t.Optional(t.Partial(EmployeeInputDTO)),
  details: t.Optional(t.Partial(EmployeeDetailsInputDTO)),
});

export type CreateEmployeePayload = typeof CreateEmployeeDTO.static;
export type UpdateEmployeePayload = typeof UpdateEmployeeDTO.static;

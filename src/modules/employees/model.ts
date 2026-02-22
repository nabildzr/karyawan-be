import { t } from "elysia";
import { UsersPlain } from "../../generated/prismabox/Users";
import { EmployeesPlain } from "../../generated/prismabox/Employees";
import { EmployeeDetailsPlain } from "../../generated/prismabox/EmployeeDetails";


// & ============ Omit Field-field otomatis dari db ============
const UserInputDTO = t.Omit(UsersPlain, ["id", "createdAt", "updatedAt"]);
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
})


export type CreateEmployeePayload =  typeof CreateEmployeeDTO.static;


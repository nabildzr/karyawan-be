import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { EmployeeService } from "./service";
import { CreateEmployeeDTO } from "./model";

export const employeeRoutes = new Elysia({
  prefix: "/employees",
  detail: { tags: ["Employees"] },
}).post(
  "/",
  async ({ set, body }) => {
    try {
      const data = await EmployeeService.CreateEmployeeTransaction(body);

      set.status = HttpStatusEnum.HTTP_201_CREATED;
      return {
        success: true,
        message: "Data Karyawan beserta kredensial user berhasil dibuat.",
        data,
      };
    } catch (error: any) {
      // ? Basic Error Mapping berdasarkan pesan dari Service
      if (error.message.startsWith("Bad Request"))
        set.status = HttpStatusEnum.HTTP_400_BAD_REQUEST;
      else if (error.message.startsWith("Not Found"))
        set.status = HttpStatusEnum.HTTP_404_NOT_FOUND;
      else if (error.message.startsWith("Conflict"))
        set.status = HttpStatusEnum.HTTP_409_CONFLICT;
      else set.status = HttpStatusEnum.HTTP_500_INTERNAL_SERVER_ERROR;

      return {
        success: false,
        message:
          error.message.split(": ")[1] || "Terjadi kesalahan internal server.",
      };
    }
  },
  {
    body: CreateEmployeeDTO,
  },
);

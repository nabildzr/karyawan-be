import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin, checkAuth } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  EmployeeCreateBodyDTO,
  EmployeeDetailParamsDTO,
  EmployeeListQueryDTO,
  EmployeeMeQueryDTO,
  EmployeeUpdateBodyDTO,
} from "./employees.schema";
import { EmployeeService } from "./employees.service";

/** Mengekspor employeeRoutes untuk kebutuhan modul ini. */
export const employeeRoutes = new Elysia({
  prefix: "/employees",
  detail: { tags: ["Employees"] },
})
  .use(authPlugin)
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await EmployeeService.getAll(query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil data karyawan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      query: EmployeeListQueryDTO,
      detail: {
        summary: "Ambil semua data karyawan (paginasi + filter + search)",
      },
    },
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const data = await EmployeeService.getById(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil mengambil detail karyawan.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      params: EmployeeDetailParamsDTO,
      detail: { summary: "Ambil detail lengkap karyawan berdasarkan ID" },
    },
  )
  .post(
    "/",
    async ({ auth, body, set }) => {
      try {
        const data = await EmployeeService.create(body, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_201_CREATED;

        return successResponse({
          data,
          message: "Data karyawan beserta kredensial user berhasil dibuat.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: EmployeeCreateBodyDTO,
      detail: { summary: "Buat karyawan baru beserta akun user" },
    },
  )
  .get(
    "/me",
    async ({ auth, query, set }) => {
      try {
        const data = await EmployeeService.getMe(auth!.sub, {
          withEmployee: query.withEmployee === true,
        });
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Data profil karyawan berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: EmployeeMeQueryDTO,
      detail: { summary: "Ambil data karyawan saat ini" },
    },
  )
  .put(
    "/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await EmployeeService.update(
          params.id,
          body,
          resolveAuditActor(auth),
        );
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Data karyawan berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: EmployeeDetailParamsDTO,
      body: EmployeeUpdateBodyDTO,
      detail: { summary: "Perbarui data karyawan berdasarkan ID" },
    },
  )
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        await EmployeeService.delete(params.id, resolveAuditActor(auth));
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          message: "Karyawan berhasil dihapus.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: EmployeeDetailParamsDTO,
      detail: { summary: "Hapus karyawan beserta akun user berdasarkan ID" },
    },
  );

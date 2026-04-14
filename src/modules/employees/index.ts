import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { AuthService } from "../auth/service";
import { CreateEmployeeDTO, UpdateEmployeeDTO } from "./model";
import { EmployeeService } from "./services";

export const employeeRoutes = new Elysia({
  prefix: "/employees",
  detail: { tags: ["Employees"] },
})
  .use(authPlugin)
  // & ====== GET ALL Employees ======
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const result = await EmployeeService.GetAllEmployees({
          page: query.page,
          limit: query.limit,
          search: query.search,
          positionId: query.positionId,
          workingSchedulesId: query.workingSchedulesId,
          role: query.role,
          divisionId: query.divisionId,
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          message: "Berhasil mengambil data karyawan.",
          meta: result.meta,
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ default: 1, minimum: 1 })),
        limit: t.Optional(t.Number({ default: 10, minimum: 1, maximum: 100 })),
        search: t.Optional(
          t.String({ description: "Cari by nama, NIP, atau email" }),
        ),
        positionId: t.Optional(t.String()),
        divisionId: t.Optional(t.String()),
        workingSchedulesId: t.Optional(t.String()),
        role: t.Optional(
          t.Union([
            t.Literal("CEO"),
            t.Literal("MANAGER"),
            t.Literal("HR"),
            t.Literal("ADMIN"),
            t.Literal("USER"),
          ]),
        ),
      }),
      detail: {
        summary: "Ambil semua data karyawan (paginasi + filter + search)",
      },
    },
  )
  // & ====== GET BY ID Employee (DEEP) ======
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const data = await EmployeeService.GetById(params.id);
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
      params: t.Object({ id: t.String() }),
      detail: { summary: "Ambil detail lengkap karyawan berdasarkan ID" },
    },
  )
  // & ====== POST CREATE Employee ======
  .post(
    "/",
    async ({ auth, set, body }) => {
      try {
        const data = await EmployeeService.CreateEmployeeTransaction(
          body,
          resolveAuditActor(auth),
        );

        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Data Karyawan beserta kredensial user berhasil dibuat.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      body: CreateEmployeeDTO,
      detail: { summary: "Buat karyawan baru beserta akun user" },
    },
  )
  .get(
    "/me",
    async ({ auth, query, set }) => {
      try {
        // 2. Ekstraksi ID secara aman.
        // Karena udah lewat checkAuth, auth pasti terdefinisi (bisa pakai non-null assertion '!')
        const userId = auth!.sub as string;

        // 3. Normalisasi Query Parameter
        // Walaupun Elysia bisa auto-coerce, konversi eksplisit ini mencegah bug siluman
        // kalau client ngirim string "true" vs boolean true
        const isWithEmployee = query.withEmployee === true;

        // 4. Panggil layer Service
        const userData = await AuthService.me(userId, {
          withEmployee: isWithEmployee,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: userData,
          message: "Data profil karyawan berhasil diekstraksi.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      // 5. The Guard: Cegat eksekusi kalau token absen atau invalid
      // beforeHandle: [checkAuth],

      // 6. Validasi Skema Input
      query: t.Object({
        withEmployee: t.Optional(
          t.Boolean({
            default: false,
            description: "Set true untuk menyertakan relasi detail employee",
          }),
        ),
      }),
      detail: { summary: "Ambil data karyawan saat ini" },
    },
  )
  .put(
    "/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await EmployeeService.UpdateEmployee(
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
      params: t.Object({ id: t.String() }),
      body: UpdateEmployeeDTO,
      detail: { summary: "Perbarui data karyawan berdasarkan ID" },
    },
  )
  .delete(
    "/:id",
    async ({ auth, params, set }) => {
      try {
        await EmployeeService.DeleteEmployee(
          params.id,
          resolveAuditActor(auth),
        );

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ message: "Karyawan berhasil dihapus." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAdmin],
      params: t.Object({ id: t.String() }),
      detail: { summary: "Hapus karyawan beserta akun user berdasarkan ID" },
    },
  );
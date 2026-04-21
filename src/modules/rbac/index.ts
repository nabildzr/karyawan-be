import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAuth, checkSuperAdmin } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
    AssignUserRoleDTO,
    RbacRoleCreateDTO,
    RbacRolePermissionBulkUpdateDTO,
    RbacRoleUpdateDTO,
} from "./model";
import { RbacService } from "./service";

/** Mengekspor rbacRoutes untuk kebutuhan modul ini. */
export const rbacRoutes = new Elysia({
  prefix: "/rbac",
  detail: { tags: ["RBAC"] },
})
  .use(authPlugin)
  .get(
    "/resources",
    async ({ query, set }) => {
      try {
        const data = await RbacService.listResources(Boolean(query.includeInactive));
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil katalog permission resource.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkSuperAdmin],
      query: t.Object({
        includeInactive: t.Optional(t.Boolean({ default: false })),
      }),
      detail: { summary: "List permission resources" },
    },
  )
  .get(
    "/roles",
    async ({ query, set }) => {
      try {
        const result = await RbacService.listRoles({
          page: query.page,
          limit: query.limit,
          search: query.search,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil daftar role.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkSuperAdmin],
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
        search: t.Optional(t.String()),
      }),
      detail: { summary: "List RBAC roles" },
    },
  )
  .get(
    "/roles/:id",
    async ({ params, set }) => {
      try {
        const data = await RbacService.getRoleDetail(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil detail role.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkSuperAdmin],
      params: t.Object({ id: t.String() }),
      detail: { summary: "Get role detail with permission matrix" },
    },
  )
  .post(
    "/roles",
    async ({ auth, body, set }) => {
      try {
        const data = await RbacService.createRole(body, {
          id: auth!.sub,
          role: auth!.rbacRoleKey || "SYSTEM",
        });

        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({
          data,
          message: "Role RBAC berhasil dibuat.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkSuperAdmin],
      body: RbacRoleCreateDTO,
      detail: { summary: "Create new RBAC role" },
    },
  )
  .put(
    "/roles/:id",
    async ({ auth, params, body, set }) => {
      try {
        const data = await RbacService.updateRole(params.id, body, {
          id: auth!.sub,
          role: auth!.rbacRoleKey || "SYSTEM",
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Role RBAC berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkSuperAdmin],
      params: t.Object({ id: t.String() }),
      body: RbacRoleUpdateDTO,
      detail: { summary: "Update RBAC role metadata" },
    },
  )
  .put(
    "/roles/:id/permissions",
    async ({ auth, params, body, set }) => {
      try {
        const data = await RbacService.updateRolePermissions(params.id, body, {
          id: auth!.sub,
          role: auth!.rbacRoleKey || "SYSTEM",
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Permission role berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkSuperAdmin],
      params: t.Object({ id: t.String() }),
      body: RbacRolePermissionBulkUpdateDTO,
      detail: { summary: "Bulk update role permissions" },
    },
  )
  .patch(
    "/users/:userId/role",
    async ({ auth, params, body, set }) => {
      try {
        const data = await RbacService.assignUserRole(params.userId, body, {
          id: auth!.sub,
          role: auth!.rbacRoleKey || "SYSTEM",
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Role user berhasil diperbarui.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkSuperAdmin],
      params: t.Object({ userId: t.String() }),
      body: AssignUserRoleDTO,
      detail: { summary: "Assign RBAC role to user" },
    },
  );

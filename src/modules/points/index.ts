// * Point wallet routes: src/modules/points/index.ts
// & REST endpoints for point rules, ledgers, marketplace, and token inventory.
// % Endpoint REST untuk aturan poin, ledger, marketplace, dan inventory token.

import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAdmin, checkAuth } from "../../middleware/auth";
import { resolveAuditActor } from "../../shared/audit/actor";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  AdminLedgerQueryModel,
  CreateFlexibilityItemPayload,
  CreatePointRulePayload,
  InventoryQueryModel,
  PaginationQueryModel,
  PointRulesQueryModel,
  UpdateFlexibilityItemPayload,
  UpdatePointRulePatchPayload,
} from "./model";
import { PointsService } from "./service";

// & Register points route plugin with admin and authenticated user endpoints.
// % Daftarkan plugin route points untuk endpoint admin dan user terautentikasi.
export const pointsRoutes = new Elysia({
  prefix: "/points",
  detail: { tags: ["Points"] },
})
  .use(authPlugin)
  // & ========================
  // & ADMIN ENDPOINTS
  // & ========================
  // % ========================
  // % ENDPOINT ADMIN
  // % ========================
  .post(
    "/admin/point-rules",
    async ({ body, set }) => {
      try {
        const data = await PointsService.rules.create(body);
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({ data, message: "Rule poin berhasil dibuat." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      body: CreatePointRulePayload,
      detail: { summary: "[Admin] Buat aturan poin" },
    },
  )
  .get(
    "/admin/point-rules",
    async ({ query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const normalizedTargetRole = String(query.targetRole ?? "")
          .trim()
          .toUpperCase();

        const where =
          normalizedTargetRole && normalizedTargetRole !== "*"
            ? {
                OR: [
                  { targetRole: normalizedTargetRole },
                  { targetRole: "*" },
                ],
              }
            : undefined;

        const data = await PointsService.rules.list(skip, limit, where);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Daftar aturan poin berhasil diambil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      query: PointRulesQueryModel,
      detail: { summary: "[Admin] Ambil daftar aturan poin" },
    },
  )
  .put(
    "/admin/point-rules/:id",
    async ({ params, body, set }) => {
      try {
        const data = await PointsService.rules.update(params.id, body);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Rule poin berhasil diperbarui." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      params: t.Object({ id: t.String() }),
      body: UpdatePointRulePatchPayload,
      detail: { summary: "[Admin] Update aturan poin" },
    },
  )
  .delete(
    "/admin/point-rules/:id",
    async ({ params, set }) => {
      try {
        const data = await PointsService.rules.delete(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Rule poin berhasil dinonaktifkan." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      params: t.Object({ id: t.String() }),
      detail: { summary: "[Admin] Nonaktifkan aturan poin" },
    },
  )
  .post(
    "/admin/flexibility-items",
    async ({ body, set }) => {
      try {
        const data = await PointsService.marketplace.items.create(body);
        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({ data, message: "Item marketplace berhasil dibuat." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      body: CreateFlexibilityItemPayload,
      detail: { summary: "[Admin] Buat item marketplace" },
    },
  )
  .get(
    "/admin/flexibility-items",
    async ({ query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const data = await PointsService.marketplace.items.list(skip, limit, {
          includeExpired: true,
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Daftar item marketplace berhasil diambil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      query: PaginationQueryModel,
      detail: { summary: "[Admin] Ambil item marketplace" },
    },
  )
  .put(
    "/admin/flexibility-items/:id",
    async ({ params, body, set }) => {
      try {
        const data = await PointsService.marketplace.items.update(params.id, body);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Item marketplace berhasil diperbarui." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      params: t.Object({ id: t.String() }),
      body: UpdateFlexibilityItemPayload,
      detail: { summary: "[Admin] Update item marketplace" },
    },
  )
  .delete(
    "/admin/flexibility-items/:id",
    async ({ params, set }) => {
      try {
        const data = await PointsService.marketplace.items.delete(params.id);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Item marketplace berhasil dinonaktifkan." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      params: t.Object({ id: t.String() }),
      detail: { summary: "[Admin] Nonaktifkan item marketplace" },
    },
  )
  .get(
    "/admin/analytics/leaderboard",
    async ({ query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        // & Allow explicit offset for advanced pagination use-cases.
        // % Izinkan offset eksplisit untuk kebutuhan paginasi lanjutan.
        const skip = query.skip ?? (page - 1) * limit;
        const data = await PointsService.analytics.leaderboard({ skip, take: limit });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Leaderboard integritas berhasil diambil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      query: PaginationQueryModel,
      detail: { summary: "[Admin] Leaderboard integritas" },
    },
  )
  .get(
    "/admin/point-ledgers",
    async ({ query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const data = await PointsService.ledger.adminHistory({
          skip,
          take: limit,
          transactionType: query.transactionType,
          userId: query.userId,
          referenceEntity: query.referenceEntity,
          startDate: query.startDate,
          endDate: query.endDate,
          search: query.search,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Riwayat ledger integritas berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth, checkAdmin],
      query: AdminLedgerQueryModel,
      detail: { summary: "[Admin] Ambil ledger poin lintas user" },
    },
  )
  // & ========================
  // & USER ENDPOINTS
  // & ========================
  // % ========================
  // % ENDPOINT USER
  // % ========================
  .get(
    "/my/wallet",
    async ({ auth, set }) => {
      try {
        const data = await PointsService.ledger.getBalance(auth!.sub);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Dompet integritas berhasil diambil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      detail: { summary: "[Authenticated] Ambil dompet poin saya" },
    },
  )
  .get(
    "/my/ledgers",
    async ({ auth, query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const data = await PointsService.ledger.history(auth!.sub, skip, limit);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Riwayat poin berhasil diambil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: PaginationQueryModel,
      detail: { summary: "[Authenticated] Ambil riwayat ledger saya" },
    },
  )
  .get(
    "/my/inventory",
    async ({ auth, query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const data = await PointsService.tokens.inventory(auth!.sub, {
          skip,
          take: limit,
          status: query.status,
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Inventory token berhasil diambil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: InventoryQueryModel,
      detail: { summary: "[Authenticated] Ambil inventory token saya" },
    },
  )
  .get(
    "/my/leaderboard",
    async ({ query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = query.skip ?? (page - 1) * limit;

        const data = await PointsService.analytics.employeeLeaderboard({
          skip,
          take: limit,
        });

        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Leaderboard karyawan berhasil diambil.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: PaginationQueryModel,
      detail: { summary: "[Authenticated] Ambil leaderboard karyawan" },
    },
  )
  .get(
    "/marketplace",
    async ({ auth, query, set }) => {
      try {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const data = await PointsService.marketplace.items.list(skip, limit, {
          includeExpired: false,
          userId: auth!.sub,
        });
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({ data, message: "Marketplace poin berhasil diambil." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: PaginationQueryModel,
      detail: { summary: "[Authenticated] Ambil marketplace poin" },
    },
  )
  .post(
    "/marketplace/:itemId/buy",
    async ({ auth, params, set }) => {
      try {
        const data = await PointsService.marketplace.buyToken(
          auth!.sub,
          params.itemId,
          resolveAuditActor(auth),
          PointsService.ledger,
        );

        if (!data.success) {
          throw new Error(`Bad Request: ${data.error || "Gagal membeli token."}`);
        }

        set.status = HttpStatusEnum.HTTP_201_CREATED;
        return successResponse({ data, message: "Token berhasil ditukar." });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: t.Object({ itemId: t.String() }),
      detail: { summary: "[Authenticated] Tukar token marketplace" },
    },
  );

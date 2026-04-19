// * Backend module controller: src/modules/notifications/index.ts
// & This file defines Elysia routes for notifications module.
// % File ini mendefinisikan route Elysia untuk module notifications.

import Elysia, { t } from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import { authPlugin, checkAuth } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import { NotificationCategoryEnum, PushSubscriptionDTO } from "./model";
import { NotificationService } from "./service";

export const notificationRoutes = new Elysia({
  prefix: "/notifications",
  detail: { tags: ["Notifications"] },
})
  .use(authPlugin)
  .get(
    "/push-public-key",
    async ({ set }) => {
      try {
        const data = NotificationService.getPublicVapidKey();
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil VAPID public key",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      detail: { summary: "Get VAPID public key for Web Push" },
    },
  )
  // GET /v1/notifications/my
  .get(
    "/my",
    async ({ auth, query, set }) => {
      try {
        const result = await NotificationService.getMyNotifications(auth!.sub, query);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil notifikasi",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
        category: t.Optional(NotificationCategoryEnum),
        isRead: t.Optional(t.Union([t.Boolean(), t.String()])),
      }),
      detail: { summary: "Get my notifications" },
    }
  )

  // GET /v1/notifications/my/unread-count
  .get(
    "/my/unread-count",
    async ({ auth, set }) => {
      try {
        const data = await NotificationService.getUnreadCount(auth!.sub);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mengambil jumlah notifikasi belum dibaca",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      detail: { summary: "Get count of unread notifications" },
    }
  )

  // PUT /v1/notifications/my/read-all
  .put(
    "/my/read-all",
    async ({ auth, set }) => {
      try {
        await NotificationService.markAllAsRead(auth!.sub);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: null,
          message: "Semua notifikasi ditandai dibaca",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      detail: { summary: "Mark all notifications as read" },
    }
  )

  // PUT /v1/notifications/my/:id/read
  .put(
    "/my/:id/read",
    async ({ auth, params, set }) => {
      try {
        const data = await NotificationService.markAsRead(params.id, auth!.sub);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Notifikasi ditandai dibaca",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      params: t.Object({ id: t.String() }),
      detail: { summary: "Mark notification as read" },
    }
  )

  // POST /v1/notifications/subscribe
  .post(
    "/subscribe",
    async ({ auth, body, set }) => {
      try {
        const data = await NotificationService.subscribeForWebPush(auth!.sub, body);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data,
          message: "Berhasil mendaftar push notification",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: PushSubscriptionDTO,
      detail: { summary: "Subscribe Web Push Notification" },
    }
  )

  // DELETE /v1/notifications/unsubscribe
  .delete(
    "/unsubscribe",
    async ({ auth, body, set }) => {
      try {
        await NotificationService.unsubscribeWebPush(auth!.sub, body.endpoint);
        set.status = HttpStatusEnum.HTTP_200_OK;
        return successResponse({
          data: null,
          message: "Berhasil berhenti dari push notification",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: [checkAuth],
      body: t.Object({ endpoint: t.String() }),
      detail: { summary: "Unsubscribe Web Push Notification" },
    }
  );

// * Backend module route: src/modules/notifications/notifications.route.ts
// & This file defines endpoints and inline route handlers for notifications module.
// % File ini mendefinisikan endpoint dan inline route handler untuk module notifications.

import Elysia from "elysia";
import { HttpStatusEnum } from "elysia-http-status-code/status";
import type { JWTPayload } from "../../middleware/auth";
import { authPlugin, checkAuth } from "../../middleware/auth";
import { successResponse } from "../../utils";
import { mapError } from "../../utils/mapError";
import {
  NotificationListQueryDTO,
  NotificationReadParamsDTO,
  NotificationUnsubscribeDTO,
  PushSubscriptionDTO,
} from "./notifications.schema";
import { NotificationService } from "./notifications.service";

const authGuard = checkAuth as any;

function getAuthenticatedUserId(auth: JWTPayload | null): string {
  if (!auth?.sub) {
    throw new Error("Forbidden: Token diperlukan.");
  }

  return auth.sub;
}

/** Mengekspor notificationRoutes untuk kebutuhan modul ini. */
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
          message: "Berhasil mengambil VAPID public key.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: authGuard,
      detail: { summary: "Get VAPID public key for Web Push" },
    },
  )
  .get(
    "/my",
    async ({ auth, query, set }) => {
      try {
        const userId = getAuthenticatedUserId(auth);
        const result = await NotificationService.getMyNotifications(userId, query);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: result.data,
          meta: result.meta,
          message: "Berhasil mengambil notifikasi saya.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: authGuard,
      query: NotificationListQueryDTO,
      detail: { summary: "Get my notifications" },
    },
  )
  .get(
    "/my/unread-count",
    async ({ auth, set }) => {
      try {
        const userId = getAuthenticatedUserId(auth);
        const data = await NotificationService.getUnreadCount(userId);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil mengambil jumlah notifikasi belum dibaca.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: authGuard,
      detail: { summary: "Get count of unread notifications" },
    },
  )
  .put(
    "/my/read-all",
    async ({ auth, set }) => {
      try {
        const userId = getAuthenticatedUserId(auth);
        await NotificationService.markAllAsRead(userId);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: null,
          message: "Berhasil menandai semua notifikasi sebagai sudah dibaca.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: authGuard,
      detail: { summary: "Mark all notifications as read" },
    },
  )
  .put(
    "/my/:id/read",
    async ({ auth, params, set }) => {
      try {
        const userId = getAuthenticatedUserId(auth);
        const data = await NotificationService.markAsRead(params.id, userId);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil menandai notifikasi sebagai sudah dibaca.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: authGuard,
      params: NotificationReadParamsDTO,
      detail: { summary: "Mark notification as read" },
    },
  )
  .post(
    "/subscribe",
    async ({ auth, body, set }) => {
      try {
        const userId = getAuthenticatedUserId(auth);
        const data = await NotificationService.subscribeForWebPush(userId, body);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data,
          message: "Berhasil subscribe Web Push Notification.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: authGuard,
      body: PushSubscriptionDTO,
      detail: { summary: "Subscribe Web Push Notification" },
    },
  )
  .delete(
    "/unsubscribe",
    async ({ auth, body, set }) => {
      try {
        const userId = getAuthenticatedUserId(auth);
        await NotificationService.unsubscribeWebPush(userId, body.endpoint);
        set.status = HttpStatusEnum.HTTP_200_OK;

        return successResponse({
          data: null,
          message: "Berhasil unsubscribe Web Push Notification.",
        });
      } catch (error: any) {
        return mapError(error, set);
      }
    },
    {
      beforeHandle: authGuard,
      body: NotificationUnsubscribeDTO,
      detail: { summary: "Unsubscribe Web Push Notification" },
    },
  );
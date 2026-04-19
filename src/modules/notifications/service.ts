// * Backend module service: src/modules/notifications/service.ts
// & This file provides service facade and business orchestration for notifications module.
// % File ini menyediakan facade service dan orkestrasi business untuk module notifications.

import { NotificationCategory } from "../../generated/prisma/enums";
import { PushService } from "./push.service";
import { NotificationRepository } from "./repository";

export class NotificationService {
  static getPublicVapidKey() {
    const publicKey = String(process.env.VAPID_PUBLIC_KEY ?? "").trim();
    if (!publicKey) {
      throw new Error("Not Found: VAPID public key belum dikonfigurasi di server.");
    }

    return { publicKey };
  }

  static async createAndPush(data: {
    userId: string;
    title: string;
    body: string;
    category: NotificationCategory;
    referenceEntity?: string;
    referenceId?: string;
  }) {
    const notification = await NotificationRepository.create(data);
    const subscriptions = await NotificationRepository.getSubscriptions(data.userId);

    if (subscriptions.length > 0) {
      Promise.all(
        subscriptions.map(async (sub) => {
          const result = await PushService.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            {
              title: data.title,
              body: data.body,
              url: `/karyawan/notifikasi`,
              tag: data.category.toLowerCase(),
            },
          );

          if (result === "expired") {
            await NotificationRepository.deleteSubscription(sub.id).catch(() => {});
          }
        }),
      ).catch((err) => console.error("Push batch error:", err));
    }

    return notification;
  }

  static async getMyNotifications(userId: string, query: any) {
    return NotificationRepository.findMine(userId, {
      page: query.page,
      limit: query.limit,
      category: query.category as NotificationCategory,
      isRead:
        query.isRead !== undefined
          ? query.isRead === "true" || query.isRead === true
          : undefined,
    });
  }

  static async getUnreadCount(userId: string) {
    const count = await NotificationRepository.countUnread(userId);
    return { count };
  }

  static async markAsRead(id: string, userId: string) {
    return NotificationRepository.markAsRead(id, userId);
  }

  static async markAllAsRead(userId: string) {
    return NotificationRepository.markAllAsRead(userId);
  }

  static async subscribeForWebPush(userId: string, body: any) {
    const { endpoint, keys } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error("Invalid push subscription data");
    }

    return NotificationRepository.upsertSubscription({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: body.userAgent,
    });
  }

  static async unsubscribeWebPush(userId: string, endpoint: string) {
    return NotificationRepository.deleteSubscriptionByEndpoint(userId, endpoint);
  }
}

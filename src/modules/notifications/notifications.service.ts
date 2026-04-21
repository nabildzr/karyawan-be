// * Backend module service: src/modules/notifications/notifications.service.ts
// & This file provides business logic for notifications module.
// % File ini menyediakan business logic untuk module notifications.

import webpush from "web-push";
import {
  countUnreadNotifications,
  createNotification,
  deletePushSubscriptionByEndpoint,
  deletePushSubscriptionById,
  findNotificationByIdForUser,
  findNotificationsByUser,
  findPushSubscriptionsByUserId,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationDbRecord,
  type PushSubscriptionDbRecord,
  upsertPushSubscription,
} from "./notifications.repository";
import type {
  NotificationCategoryPayload,
  NotificationCreatePayload,
  NotificationListQueryPayload,
  NotificationListResponsePayload,
  NotificationResponsePayload,
  PublicVapidKeyPayload,
  PushSubscriptionPayload,
  PushSubscriptionRecordPayload,
  UnreadCountPayload,
} from "./notifications.schema";

const vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY ?? "").trim();
const vapidPrivateKey = String(process.env.VAPID_PRIVATE_KEY ?? "").trim();

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:nabildzikrika@gmail.com",
    vapidPublicKey,
    vapidPrivateKey,
  );
} else {
  console.warn(
    "⚠️  VAPID keys not set in .env. Web Push notifications will not work.",
  );
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function mapNotificationRecord(
  record: NotificationDbRecord,
): NotificationResponsePayload {
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    category: record.category,
    isRead: record.isRead,
    readAt: toIsoString(record.readAt),
    referenceEntity: record.referenceEntity,
    referenceId: record.referenceId,
    createdAt: record.createdAt.toISOString(),
  };
}

function mapPushSubscriptionRecord(
  record: PushSubscriptionDbRecord,
): PushSubscriptionRecordPayload {
  return {
    id: record.id,
    userId: record.userId,
    endpoint: record.endpoint,
    p256dh: record.p256dh,
    auth: record.auth,
    userAgent: record.userAgent,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function sendPushNotification(
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  payload: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    tag?: string;
  },
) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured, skipping push notification.");
    return false;
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/favicon.png",
        url: payload.url || "/karyawan/notifikasi",
        tag: payload.tag,
      }),
      {
        TTL: 86400,
      },
    );
    return true;
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.warn("Push subscription expired/gone:", subscription.endpoint);
      return "expired";
    }

    console.error("Error sending push notification:", error.message);
    return false;
  }
}

/** Mengambil VAPID public key untuk web push. */
export function getPublicVapidKey(): PublicVapidKeyPayload {
  if (!vapidPublicKey) {
    throw new Error(
      "Not Found: VAPID public key belum dikonfigurasi di server.",
    );
  }

  return { publicKey: vapidPublicKey };
}

/** Membuat notifikasi dan men-trigger push delivery. */
export async function createAndPush(data: NotificationCreatePayload) {
  const notification = await createNotification(data);
  const subscriptions = await findPushSubscriptionsByUserId(data.userId);

  if (subscriptions.length > 0) {
    void Promise.all(
      subscriptions.map(async (sub) => {
        const result = await sendPushNotification(
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
          await deletePushSubscriptionById(sub.id).catch(() => {});
        }
      }),
    ).catch((error) => console.error("Push batch error:", error));
  }

  return notification;
}

/** Mengambil notifikasi milik user dengan pagination dan filter. */
export async function getMyNotifications(
  userId: string,
  query: NotificationListQueryPayload,
): Promise<NotificationListResponsePayload> {
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;
  const category = query.category as NotificationCategoryPayload | undefined;
  const isRead =
    query.isRead !== undefined
      ? query.isRead === "true" || query.isRead === true
      : undefined;

  const { data, total } = await findNotificationsByUser(userId, {
    page,
    limit,
    category,
    isRead,
  });

  return {
    data: data.map(mapNotificationRecord),
    meta: {
      totalItems: total,
      itemsPerPage: limit,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** Mengambil jumlah notifikasi yang belum dibaca. */
export async function getUnreadCount(userId: string): Promise<UnreadCountPayload> {
  const count = await countUnreadNotifications(userId);
  return { count };
}

/** Menandai satu notifikasi sebagai sudah dibaca. */
export async function markAsRead(
  id: string,
  userId: string,
): Promise<NotificationResponsePayload> {
  const notification = await findNotificationByIdForUser(id, userId);

  if (!notification) {
    throw new Error("Not Found: Notifikasi tidak ditemukan.");
  }

  const updated = await markNotificationAsRead(id);
  return mapNotificationRecord(updated as NotificationDbRecord);
}

/** Menandai semua notifikasi milik user sebagai sudah dibaca. */
export async function markAllAsRead(userId: string): Promise<null> {
  await markAllNotificationsAsRead(userId);
  return null;
}

/** Mendaftarkan push subscription web. */
export async function subscribeForWebPush(
  userId: string,
  body: PushSubscriptionPayload,
): Promise<PushSubscriptionRecordPayload> {
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    throw new Error("Invalid push subscription data");
  }

  const subscription = await upsertPushSubscription(userId, body);
  return mapPushSubscriptionRecord(subscription as PushSubscriptionDbRecord);
}

/** Menghapus push subscription web milik user. */
export async function unsubscribeWebPush(
  userId: string,
  endpoint: string,
): Promise<null> {
  await deletePushSubscriptionByEndpoint(userId, endpoint);
  return null;
}

/** Mengekspor NotificationService untuk kebutuhan modul ini. */
export const NotificationService = {
  getPublicVapidKey,
  createAndPush,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  subscribeForWebPush,
  unsubscribeWebPush,
};
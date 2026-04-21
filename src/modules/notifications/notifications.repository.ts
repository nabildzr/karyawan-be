// * Backend module repository: src/modules/notifications/notifications.repository.ts
// & This file provides raw database access for notifications module.
// % File ini menyediakan akses database mentah untuk module notifications.

import prisma from "../../config/prisma";
import type { NotificationCategoryPayload, NotificationCreatePayload, PushSubscriptionPayload } from "./notifications.schema";

/** Mendefinisikan alias tipe untuk NotificationDbRecord. */
export type NotificationDbRecord = {
  id: string;
  title: string;
  body: string;
  category: NotificationCategoryPayload;
  isRead: boolean;
  readAt: Date | null;
  referenceEntity: string | null;
  referenceId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Mendefinisikan alias tipe untuk PushSubscriptionDbRecord. */
export type PushSubscriptionDbRecord = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Membuat notifikasi baru di database. */
export async function createNotification(data: NotificationCreatePayload) {
  return prisma.notifications.create({ data });
}

/** Mengambil daftar notifikasi mentah milik user. */
export async function findNotificationsByUser(
  userId: string,
  params: {
    page: number;
    limit: number;
    category?: NotificationCategoryPayload;
    isRead?: boolean;
  },
) {
  const skip = (params.page - 1) * params.limit;
  const where: Record<string, unknown> = { userId };

  if (params.category) where.category = params.category;
  if (params.isRead !== undefined) where.isRead = params.isRead;

  const [data, total] = await Promise.all([
    prisma.notifications.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.limit,
    }),
    prisma.notifications.count({ where }),
  ]);

  return {
    data: data as NotificationDbRecord[],
    total,
  };
}

/** Menghitung jumlah notifikasi belum dibaca. */
export async function countUnreadNotifications(userId: string) {
  return prisma.notifications.count({
    where: { userId, isRead: false },
  });
}

/** Mengambil satu notifikasi milik user berdasarkan id. */
export async function findNotificationByIdForUser(
  id: string,
  userId: string,
) {
  return prisma.notifications.findFirst({
    where: { id, userId },
  });
}

/** Menandai notifikasi sebagai sudah dibaca. */
export async function markNotificationAsRead(id: string) {
  return prisma.notifications.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
}

/** Menandai seluruh notifikasi user sebagai sudah dibaca. */
export async function markAllNotificationsAsRead(userId: string) {
  return prisma.notifications.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

/** Membuat atau memperbarui push subscription berdasarkan endpoint. */
export async function upsertPushSubscription(
  userId: string,
  body: PushSubscriptionPayload,
) {
  return prisma.pushSubscriptions.upsert({
    where: { endpoint: body.endpoint },
    update: {
      userId,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent ?? null,
    },
    create: {
      userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent ?? null,
    },
  });
}

/** Mengambil semua push subscription milik user. */
export async function findPushSubscriptionsByUserId(userId: string) {
  return prisma.pushSubscriptions.findMany({
    where: { userId },
  });
}

/** Menghapus push subscription berdasarkan id. */
export async function deletePushSubscriptionById(id: string) {
  return prisma.pushSubscriptions.delete({
    where: { id },
  });
}

/** Menghapus push subscription berdasarkan endpoint dan user. */
export async function deletePushSubscriptionByEndpoint(
  userId: string,
  endpoint: string,
) {
  return prisma.pushSubscriptions.deleteMany({
    where: { userId, endpoint },
  });
}
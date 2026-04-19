import prisma from "../../config/prisma";
import { NotificationCategory } from "../../generated/prisma/enums";

export class NotificationRepository {
  static async create(data: {
    userId: string;
    title: string;
    body: string;
    category: NotificationCategory;
    referenceEntity?: string;
    referenceId?: string;
  }) {
    return prisma.notifications.create({
      data,
    });
  }

  static async findMine(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      category?: NotificationCategory;
      isRead?: boolean;
    }
  ) {
    const { page = 1, limit = 20, category, isRead } = params;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (category) where.category = category;
    if (isRead !== undefined) where.isRead = isRead;

    const [data, total] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notifications.count({ where }),
    ]);

    return {
      data,
      meta: {
        totalItems: total,
        itemsPerPage: limit,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async countUnread(userId: string) {
    return prisma.notifications.count({
      where: { userId, isRead: false },
    });
  }

  static async markAsRead(id: string, userId: string) {
    return prisma.notifications.update({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notifications.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  static async delete(id: string, userId: string) {
    return prisma.notifications.delete({
      where: { id, userId },
    });
  }

  // ─── Push Subscription Methods ────────────────────────────────────────────

  static async upsertSubscription(data: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }) {
    return prisma.pushSubscriptions.upsert({
      where: { endpoint: data.endpoint },
      update: {
        userId: data.userId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent,
      },
      create: {
        userId: data.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent,
      },
    });
  }

  static async getSubscriptions(userId: string) {
    return prisma.pushSubscriptions.findMany({
      where: { userId },
    });
  }

  /** Hapus subscription berdasarkan ID (misal kalau expired 410) */
  static async deleteSubscription(id: string) {
    return prisma.pushSubscriptions.delete({ where: { id } });
  }

  /** Hapus subscription berdasarkan endpoint + userId (untuk unsubscribe manual) */
  static async deleteSubscriptionByEndpoint(userId: string, endpoint: string) {
    return prisma.pushSubscriptions.deleteMany({
      where: { userId, endpoint },
    });
  }
}

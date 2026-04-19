// * Point wallet repository: karyawan-be/src/modules/points/repository.ts
// & Database abstraction layer for point operations with consistent error handling.
// % Layer abstraksi database untuk operasi poin dengan penanganan error konsisten.

import { PrismaClient } from "../../generated/prisma/client";
import { DEFAULT_TIMEZONE, JAKARTA_UTC_OFFSET } from "../../config/timezone";

const getBusinessDayStart = (date = new Date(), timezone = DEFAULT_TIMEZONE) => {
  const dayKey = date.toLocaleDateString("sv-SE", { timeZone: timezone });
  return new Date(`${dayKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
};

// & Build repository object that encapsulates all point-related DB queries.
// % Bentuk objek repository yang membungkus semua query database terkait poin.
export const createPointsRepository = (db: PrismaClient) => ({
  // & ========================
  // & Point Rules Repository
  // & ========================
  // % ========================
  // % Repository Aturan Poin
  // % ========================
  rules: {
    async create(data: any) {
      return db.pointRules.create({ data });
    },

    async findById(id: string) {
      return db.pointRules.findUnique({ where: { id } });
    },

    async findAll(options?: { skip?: number; take?: number; where?: any }) {
      return db.pointRules.findMany({
        skip: options?.skip,
        take: options?.take,
        where: { ...options?.where, isActive: true },
        orderBy: { createdAt: "desc" },
      });
    },

    async findByRole(targetRole: string) {
      const normalizedRole = String(targetRole ?? "")
        .trim()
        .toUpperCase();

      return db.pointRules.findMany({
        where: {
          isActive: true,
          OR: [
            { targetRole: normalizedRole },
            { targetRole: "*" },
            { targetRole: "ALL" },
            { targetRole: "SEMUA" },
          ],
        },
        orderBy: { createdAt: "desc" },
      });
    },

    async findAllActive(where?: any) {
      return db.pointRules.findMany({
        where: { ...where, isActive: true },
        orderBy: { createdAt: "desc" },
      });
    },

    async update(id: string, data: any) {
      return db.pointRules.update({ where: { id }, data });
    },

    async delete(id: string) {
      return db.pointRules.update({
        where: { id },
        data: { isActive: false },
      });
    },

    async count(where?: any) {
      return db.pointRules.count({ where: { ...where, isActive: true } });
    },
  },

  // & ========================
  // & Point Ledgers Repository
  // & ========================
  // % ========================
  // % Repository Ledger Poin
  // % ========================
  ledgers: {
    async create(data: any) {
      return db.pointLedgers.create({ data });
    },

    async findAll(options?: { skip?: number; take?: number; where?: any }) {
      return db.pointLedgers.findMany({
        where: options?.where,
        orderBy: { createdAt: "desc" },
        skip: options?.skip,
        take: options?.take,
        include: {
          user: {
            select: {
              id: true,
              nip: true,
              currentPoints: true,
              rbacRole: {
                select: {
                  key: true,
                },
              },
              employees: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
            },
          },
        },
      });
    },

    async countAll(where?: any) {
      return db.pointLedgers.count({ where });
    },

    async findByUserId(userId: string, options?: { skip?: number; take?: number }) {
      return db.pointLedgers.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: options?.skip,
        take: options?.take,
      });
    },

    async getLatestBalance(userId: string) {
      const latest = await db.pointLedgers.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { balanceAfter: true },
      });
      return latest?.balanceAfter ?? 0;
    },

    async countUserTransactions(userId: string, startDate?: Date) {
      return db.pointLedgers.count({
        where: {
          userId,
          ...(startDate && { createdAt: { gte: startDate } }),
        },
      });
    },

    async findByReference(
      userId: string,
      referenceEntity: string,
      referenceId: string,
    ) {
      return db.pointLedgers.findFirst({
        where: {
          userId,
          referenceEntity,
          referenceId,
        },
        orderBy: { createdAt: "desc" },
      });
    },
  },

  // & ========================
  // & Flexibility Items Repository
  // & ========================
  // % ========================
  // % Repository Item Fleksibilitas
  // % ========================
  flexibilityItems: {
    async create(data: any) {
      return db.flexibilityItems.create({ data });
    },

    async findById(id: string) {
      return db.flexibilityItems.findUnique({ where: { id } });
    },

    async findAll(options?: { skip?: number; take?: number; where?: any }) {
      return db.flexibilityItems.findMany({
        where: {
          ...(options?.where ?? {}),
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip,
        take: options?.take,
      });
    },

    async count(where?: any) {
      return db.flexibilityItems.count({
        where: {
          ...(where ?? {}),
          isActive: true,
        },
      });
    },

    async update(id: string, data: any) {
      return db.flexibilityItems.update({ where: { id }, data });
    },

    async delete(id: string) {
      return db.flexibilityItems.update({
        where: { id },
        data: { isActive: false },
      });
    },
  },

  // & ========================
  // & User Tokens Repository
  // & ========================
  // % ========================
  // % Repository Token Pengguna
  // % ========================
  userTokens: {
    async create(data: any) {
      return db.userTokens.create({
        data,
        include: { item: true },
      });
    },

    async findById(id: string) {
      return db.userTokens.findUnique({
        where: { id },
        include: { item: true },
      });
    },

    async findByUserId(userId: string, options?: { status?: string; skip?: number; take?: number }) {
      return db.userTokens.findMany({
        where: {
          userId,
          ...(options?.status && { status: options.status }),
        },
        include: {
          item: true,
          attendance: {
            select: {
              id: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: options?.skip,
        take: options?.take,
      });
    },

    async findAvailable(userId: string) {
      return db.userTokens.findMany({
        where: {
          userId,
          status: "AVAILABLE",
          // & Valid through the end of the business day on expiresAt date.
          // % Berlaku sampai akhir hari bisnis pada tanggal expiresAt.
          expiresAt: { gte: getBusinessDayStart() },
        },
        include: { item: true },
        orderBy: { createdAt: "asc" },
      });
    },

    async update(id: string, data: any) {
      return db.userTokens.update({
        where: { id },
        data,
        include: { item: true },
      });
    },

    async expireTokens(beforeDate: Date) {
      return db.userTokens.updateMany({
        where: {
          status: "AVAILABLE",
          expiresAt: { lt: beforeDate },
        },
        data: { status: "EXPIRED", remainingDays: 0 },
      });
    },

    async countUserTokens(userId: string, status?: string) {
      return db.userTokens.count({
        where: {
          userId,
          ...(status && { status }),
        },
      });
    },
  },

  // & ========================
  // & Users Point Fields Repository
  // & ========================
  // % ========================
  // % Repository Field Poin Pengguna
  // % ========================
  users: {
    async updatePoints(userId: string, currentPoints: number) {
      return db.users.update({
        where: { id: userId },
        data: {
          currentPoints,
        },
      });
    },

    async getPoints(userId: string) {
      const user = await db.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          currentPoints: true,
        },
      });
      return user;
    },
  },
});

export type PointsRepository = ReturnType<typeof createPointsRepository>;

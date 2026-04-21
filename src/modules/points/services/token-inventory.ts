

// * Token inventory service: src/modules/points/services/token-inventory.ts
// & User token inventory management with pagination and summary.
// % Manajemen inventory token user dengan paginasi dan ringkasan.

import { DEFAULT_TIMEZONE } from "../../../config/timezone";
import { TransactionType } from "../../../generated/prisma/enums";
import { getDayRangeByTimezone } from "../../../shared/attendances/schedules";
import type { AuditActor } from "../../../shared/audit/actor";
import { writeAuditLog } from "../../../shared/audit/writeAudit";
import { NotificationService } from "../../notifications/notifications.service";
import {
  INTEGRITY_THRESHOLDS,
  getIntegrityLevel,
  getNextIntegrityLevel,
} from "../utils/levels";

type PointsRepository = any;



/** Mengekspor createAnalyticsService untuk kebutuhan modul ini. */
export const createAnalyticsService = (repo: PointsRepository, db: any) => ({
  // & Build paginated leaderboard enriched with total earned points per user.
  // % Bangun leaderboard terpaginasi dengan tambahan total poin yang pernah didapat user.
  async getLeaderboard(options?: { skip?: number; take?: number }) {
    const skip = Number(options?.skip || 0);
    const take = Number(options?.take || 100);

    const [users, total] = await Promise.all([
      db.users.findMany({
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
        orderBy: { currentPoints: "desc" },
        skip,
        take,
      }),
      db.users.count(),
    ]);

    const earnedByUser = await db.pointLedgers.groupBy({
      by: ["userId"],
      where: {
        userId: { in: users.map((user: any) => user.id) },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });

    const totalEarnedMap = new Map(
      earnedByUser.map((row: any) => [row.userId, Number(row._sum?.amount || 0)]),
    );

    return {
      data: users.map((row: any, index: number) => ({
        rank: skip + index + 1,
        userId: row.id,
        employeeId: row.employees?.id ?? undefined,
        role: row.rbacRole?.key ?? "USER",
        name: row.employees?.fullName ?? `User ${row.nip ?? row.id}`,
        userName: row.employees?.fullName ?? `User ${row.nip ?? row.id}`,
        balance: Number(row.currentPoints || 0),
        currentPoints: row.currentPoints,
        totalEarned: totalEarnedMap.get(row.id) ?? 0,
        level: getIntegrityLevel(Number(row.currentPoints || 0)),
        integrityLevel: getIntegrityLevel(Number(row.currentPoints || 0)),
      })),
      pagination: {
        total,
        skip,
        take,
        pages: Math.ceil(total / Math.max(take, 1)),
      },
    };
  },

  // & Build a lightweight paginated leaderboard for employee portal.
  // % Bangun leaderboard terpaginasi yang ringan untuk portal karyawan.
  async getEmployeeLeaderboard(options?: { skip?: number; take?: number }) {
    const skip = Number(options?.skip || 0);
    const take = Number(options?.take || 20);

    const employeeScopeWhere = {
      employees: {
        isNot: null,
      },
    };

    const [users, total] = await Promise.all([
      db.users.findMany({
        where: employeeScopeWhere,
        select: {
          id: true,
          nip: true,
          currentPoints: true,
          employees: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: { currentPoints: "desc" },
        skip,
        take,
      }),
      db.users.count({ where: employeeScopeWhere }),
    ]);

    return {
      data: users.map((row: any, index: number) => ({
        rank: skip + index + 1,
        userId: row.id,
        name: row.employees?.fullName ?? `User ${row.nip ?? row.id}`,
        balance: Number(row.currentPoints || 0),
        level: getIntegrityLevel(Number(row.currentPoints || 0)),
      })),
      pagination: {
        total,
        skip,
        take,
        pages: Math.ceil(total / Math.max(take, 1)),
      },
    };
  },

  // & Return one user summary stats used by dashboard widgets.
  // % Kembalikan ringkasan statistik satu user untuk widget dashboard.
  async getUserStats(userId: string) {
    const user = await repo.users.getPoints(userId);
    if (!user) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [transactionsToday, transactionsThisWeek] = await Promise.all([
      repo.ledgers.countUserTransactions(userId, today),
      repo.ledgers.countUserTransactions(
        userId,
        new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      ),
    ]);

    return {
      userId,
      balance: Number(user.currentPoints || 0),
      currentPoints: user.currentPoints,
      level: getIntegrityLevel(Number(user.currentPoints || 0)),
      integrityLevel: getIntegrityLevel(user.currentPoints),
      transactionsToday,
      transactionsThisWeek,
    };
  },

  // & Aggregate high-level system metrics for admin overview.
  // % Agregasi metrik level sistem untuk ringkasan admin.
  async getSystemStats() {
    const [activeUsers, totalTransactions, issuedAgg, spentAgg] = await Promise.all([
      db.users.count({ where: { currentPoints: { gt: 0 } } }),
      db.pointLedgers.count(),
      db.pointLedgers.aggregate({
        where: { transactionType: TransactionType.EARN },
        _sum: { amount: true },
      }),
      db.pointLedgers.aggregate({
        where: { transactionType: TransactionType.SPEND },
        _sum: { amount: true },
      }),
    ]);

    return {
      activeUsers,
      totalTransactions,
      totalPointsIssued: Number(issuedAgg?._sum?.amount || 0),
      totalPointsSpent: Math.abs(Number(spentAgg?._sum?.amount || 0)),
    };
  },
});



/** Mendefinisikan alias tipe untuk TransactionTypeValue. */
export type TransactionTypeValue =
  (typeof TransactionType)[keyof typeof TransactionType];



/** Mengekspor toPercentage untuk kebutuhan modul ini. */
export const toPercentage = (value: number) =>
  Math.min(100, Math.max(0, Number(value.toFixed(2))));



/** Mengekspor createLedgerService untuk kebutuhan modul ini. */
export const createLedgerService = (repo: PointsRepository, db: any) => ({
  // & Record a point transaction and update denormalized user wallet fields.
  // % Catat transaksi poin dan update field dompet denormalized pada user.
  async recordLedgerEntry(
    params: {
      userId: string;
      transactionType: TransactionTypeValue;
      amount: number;
      description: string;
      referenceEntity?: string;
      referenceId?: string;
      actor?: AuditActor;
    },
    dbClient?: any,
  ) {
    const runWrite = async (dbRuntime: any) => {
      const [latestLedger, user] = await Promise.all([
        dbRuntime.pointLedgers.findFirst({
          where: { userId: params.userId },
          orderBy: { createdAt: "desc" },
          select: { balanceAfter: true },
        }),
        dbRuntime.users.findUnique({
          where: { id: params.userId },
          select: { id: true, currentPoints: true },
        }),
      ]);

      if (!user) {
        throw new Error("Not Found: User tidak ditemukan.");
      }

      const balanceBefore =
        latestLedger?.balanceAfter ?? Number(user.currentPoints || 0);
      const balanceAfter = balanceBefore + Number(params.amount || 0);

      const ledgerEntry = await dbRuntime.pointLedgers.create({
        data: {
          userId: params.userId,
          transactionType: params.transactionType,
          amount: params.amount,
          balanceBefore,
          balanceAfter,
          description: params.description,
          referenceEntity: params.referenceEntity,
          referenceId: params.referenceId,
        },
      });

      await dbRuntime.users.update({
        where: { id: params.userId },
        data: {
          currentPoints: balanceAfter,
        },
      });

      if (params.actor) {
        await writeAuditLog({
          actor: params.actor,
          action: "POINT_TRANSACTION",
          entity: "PointLedgers",
          entityId: ledgerEntry.id,
          changes: {
            transactionType: params.transactionType,
            amount: params.amount,
            balanceBefore,
            balanceAfter,
          },
          reason: params.description,
          db: dbRuntime,
        });
      }

      return {
        ...ledgerEntry,
        currentBalance: ledgerEntry.balanceAfter,
      };
    };

    const persistedLedgerEntry = dbClient
      ? await runWrite(dbClient)
      : await db.$transaction(async (tx: any) => runWrite(tx));

    if (params.amount !== 0) {
      NotificationService.createAndPush({
        userId: params.userId,
        title: params.amount > 0 ? "Poin Bertambah!" : "Poin Berkurang",
        body:
          params.description ||
          `Saldo poin kamu ${params.amount > 0 ? "bertambah" : "berkurang"} ${Math.abs(params.amount)} poin.`,
        category: "POINTS",
        referenceEntity: params.referenceEntity ?? "PointLedgers",
        referenceId: params.referenceId ?? persistedLedgerEntry.id,
      }).catch((error) => {
        console.warn(
          "[NOTIF] Failed to push notification for point ledger entry:",
          error,
        );
      });
    }

    return persistedLedgerEntry;
  },

  // & Read wallet summary with backward-compatible aliases.
  // % Baca ringkasan dompet dengan alias kompatibel mundur.
  async getUserWallet(userId: string) {
    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        currentPoints: true,
      },
    });

    if (!user) return null;

    const currentPoints = Number(user.currentPoints || 0);
    const [earnedAgg, spentAgg, higherRankCount] = await Promise.all([
      db.pointLedgers.aggregate({
        where: { userId, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      db.pointLedgers.aggregate({
        where: { userId, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      db.users.count({
        where: { currentPoints: { gt: currentPoints } },
      }),
    ]);

    const totalEarned = Number(earnedAgg._sum.amount || 0);
    const totalSpent = Math.abs(Number(spentAgg._sum.amount || 0));
    const level = getIntegrityLevel(currentPoints);
    const nextLevel = getNextIntegrityLevel(level);
    const currentThreshold = INTEGRITY_THRESHOLDS[level];
    const nextThreshold = INTEGRITY_THRESHOLDS[nextLevel];
    const thresholdDelta = Math.max(nextThreshold - currentThreshold, 1);
    const rawProgress =
      level === "PLATINUM"
        ? 100
        : ((currentPoints - currentThreshold) / thresholdDelta) * 100;
    const percentageToNextLevel = toPercentage(rawProgress);
    const rank = currentPoints > 0 ? higherRankCount + 1 : 0;

    return {
      userId,
      balance: currentPoints,
      currentPoints,
      totalEarned,
      totalSpent,
      level,
      integrityLevel: level,
      rank,
      nextLevel,
      nextLevelThreshold: nextThreshold,
      percentageToNextLevel,
    };
  },

  // & Get paginated ledger history for one user.
  // % Ambil riwayat ledger terpaginasi untuk satu user.
  async getUserLedgerHistory(userId: string, skip: number = 0, take: number = 20) {
    const [entries, total] = await Promise.all([
      repo.ledgers.findByUserId(userId, { skip, take }),
      db.pointLedgers.count({ where: { userId } }),
    ]);

    const normalizedEntries = entries.map((entry: any) => ({
      ...entry,
      currentBalance: entry.balanceAfter,
    }));

    return {
      data: normalizedEntries,
      pagination: {
        total,
        skip,
        take,
        pages: Math.ceil(total / Math.max(take, 1)),
      },
    };
  },

  // & Get paginated ledger history for admin across all users.
  // % Ambil riwayat ledger terpaginasi untuk admin lintas user.
  async getSystemLedgerHistory(
    params?: {
      skip?: number;
      take?: number;
      transactionType?: TransactionTypeValue;
      userId?: string;
      referenceEntity?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    const where: Record<string, any> = {};
    if (params?.transactionType) where.transactionType = params.transactionType;
    if (params?.userId) where.userId = params.userId;
    if (params?.referenceEntity) where.referenceEntity = params.referenceEntity;

    if (params?.startDate || params?.endDate) {
      const createdAtFilter: Record<string, Date> = {};

      if (params?.startDate) {
        const startDate = new Date(params.startDate);
        if (Number.isNaN(startDate.getTime())) {
          throw new Error("Bad Request: startDate tidak valid.");
        }
        createdAtFilter.gte = startDate;
      }

      if (params?.endDate) {
        const endDate = new Date(params.endDate);
        if (Number.isNaN(endDate.getTime())) {
          throw new Error("Bad Request: endDate tidak valid.");
        }
        createdAtFilter.lte = endDate;
      }

      if (
        createdAtFilter.gte &&
        createdAtFilter.lte &&
        createdAtFilter.gte > createdAtFilter.lte
      ) {
        throw new Error(
          "Bad Request: startDate tidak boleh lebih besar dari endDate.",
        );
      }

      where.createdAt = createdAtFilter;
    }

    const keyword = String(params?.search || "").trim();
    if (keyword) {
      where.OR = [
        { description: { contains: keyword, mode: "insensitive" } },
        { referenceEntity: { contains: keyword, mode: "insensitive" } },
        { referenceId: { contains: keyword, mode: "insensitive" } },
        { user: { nip: { contains: keyword, mode: "insensitive" } } },
        {
          user: {
            employees: {
              is: {
                id: { contains: keyword, mode: "insensitive" },
              },
            },
          },
        },
        {
          user: {
            employees: {
              is: {
                fullName: { contains: keyword, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    const [entries, total] = await Promise.all([
      repo.ledgers.findAll({
        skip: params?.skip,
        take: params?.take,
        where,
      }),
      repo.ledgers.countAll(where),
    ]);

    const normalizedEntries = entries.map((entry: any) => ({
      ...entry,
      currentBalance: entry.balanceAfter,
      user: entry.user
        ? {
            id: entry.user.id,
            employeeId: entry.user.employees?.id ?? entry.user.nip,
            name: entry.user.employees?.fullName ?? entry.user.nip,
            role: entry.user.rbacRole?.key,
            balance: entry.user.currentPoints,
          }
        : undefined,
    }));

    const take = Number(params?.take || 20);
    const skip = Number(params?.skip || 0);

    return {
      data: normalizedEntries,
      pagination: {
        total,
        skip,
        take,
        pages: Math.ceil(total / Math.max(take, 1)),
      },
    };
  },
});



/** Mengekspor MS_PER_DAY untuk kebutuhan modul ini. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;



/** Mengekspor SUPPORTED_ITEM_CONDITION_FIELDS untuk kebutuhan modul ini. */
export const SUPPORTED_ITEM_CONDITION_FIELDS = [
  "attendance.status",
  "attendance.lateMinutes",
] as const;



/** Mengekspor FALLBACK_ITEM_TYPE_CONDITIONS untuk kebutuhan modul ini. */
export const FALLBACK_ITEM_TYPE_CONDITIONS: Record<
  string,
  {
    conditionField: (typeof SUPPORTED_ITEM_CONDITION_FIELDS)[number];
    conditionValue: string;
  }
> = {
  late_allowance_15m: {
    conditionField: "attendance.lateMinutes",
    conditionValue: "15",
  },
  late_allowance_30m: {
    conditionField: "attendance.lateMinutes",
    conditionValue: "30",
  },
  late_allowance_60m: {
    conditionField: "attendance.lateMinutes",
    conditionValue: "60",
  },
  absence_excuse: {
    conditionField: "attendance.status",
    conditionValue: "ABSENT",
  },
  wfh_allowance: {
    conditionField: "attendance.status",
    conditionValue: "LATE,ABSENT",
  },
};



/** Mengekspor normalizeOptionalString untuk kebutuhan modul ini. */
export const normalizeOptionalString = (value: unknown): string | null => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};



/** Mengekspor parseDateOrNull untuk kebutuhan modul ini. */
export const parseDateOrNull = (value: unknown, fieldName: string): Date | null => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Bad Request: ${fieldName} tidak valid.`);
  }

  return parsed;
};



/** Mengekspor normalizeMaxPerMonth untuk kebutuhan modul ini. */
export const normalizeMaxPerMonth = (value: unknown): number | null => {
  if (value == null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Bad Request: maxPerMonth harus angka bulat lebih dari 0.");
  }

  return parsed;
};



/** Mengekspor normalizeConditionValue untuk kebutuhan modul ini. */
export const normalizeConditionValue = (
  conditionField: (typeof SUPPORTED_ITEM_CONDITION_FIELDS)[number],
  rawValue: string,
): string => {
  if (conditionField === "attendance.lateMinutes") {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        "Bad Request: conditionValue untuk attendance.lateMinutes harus angka bulat > 0.",
      );
    }

    return String(parsed);
  }

  const statuses = rawValue
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (!statuses.length) {
    throw new Error(
      "Bad Request: conditionValue untuk attendance.status wajib diisi.",
    );
  }

  const allowed = new Set(["LATE", "ABSENT"]);
  for (const status of statuses) {
    if (!allowed.has(status)) {
      throw new Error(
        "Bad Request: attendance.status hanya mendukung nilai LATE atau ABSENT.",
      );
    }
  }

  return Array.from(new Set(statuses)).join(",");
};



/** Mengekspor resolveNormalizedCondition untuk kebutuhan modul ini. */
export const resolveNormalizedCondition = (params: {
  payload: any;
  itemType: string;
  existing?: {
    conditionField?: string | null;
    conditionValue?: string | null;
  };
}): { conditionField: string | null; conditionValue: string | null } => {
  const { payload, itemType, existing } = params;

  const hasConditionField = Object.prototype.hasOwnProperty.call(
    payload,
    "conditionField",
  );
  const hasConditionValue = Object.prototype.hasOwnProperty.call(
    payload,
    "conditionValue",
  );

  const candidateField = hasConditionField
    ? normalizeOptionalString(payload.conditionField)
    : normalizeOptionalString(existing?.conditionField);

  const candidateValue = hasConditionValue
    ? normalizeOptionalString(payload.conditionValue)
    : normalizeOptionalString(existing?.conditionValue);

  if (!candidateField) {
    if (hasConditionField || hasConditionValue) {
      return {
        conditionField: null,
        conditionValue: null,
      };
    }

    const fallback = FALLBACK_ITEM_TYPE_CONDITIONS[itemType] ?? null;
    return fallback
      ? {
          conditionField: fallback.conditionField,
          conditionValue: fallback.conditionValue,
        }
      : { conditionField: null, conditionValue: null };
  }

  if (!SUPPORTED_ITEM_CONDITION_FIELDS.includes(candidateField as any)) {
    throw new Error(
      `Bad Request: conditionField tidak valid. Gunakan salah satu: ${SUPPORTED_ITEM_CONDITION_FIELDS.join(
        ", ",
      )}.`,
    );
  }

  if (!candidateValue) {
    throw new Error("Bad Request: conditionValue wajib diisi jika conditionField dipakai.");
  }

  const normalizedValue = normalizeConditionValue(
    candidateField as (typeof SUPPORTED_ITEM_CONDITION_FIELDS)[number],
    candidateValue,
  );

  return {
    conditionField: candidateField,
    conditionValue: normalizedValue,
  };
};



/** Mengekspor calculateRemainingDays untuk kebutuhan modul ini. */
export const calculateRemainingDays = (expiresAt: Date, now = new Date()) => {
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
};



/** Mengekspor getMonthRange untuk kebutuhan modul ini. */
export const getMonthRange = (sourceDate = new Date()) => {
  const start = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(sourceDate.getFullYear(), sourceDate.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
};



/** Mengekspor createMarketplaceService untuk kebutuhan modul ini. */
export const createMarketplaceService = (repo: PointsRepository, db: any) => {
  const broadcastNewMarketplaceItem = (item: {
    id: string;
    itemName: string;
    isActive?: boolean;
  }) => {
    if (!item?.isActive) {
      return;
    }

    void (async () => {
      try {
        // & Target employee accounts so newly created items are announced to karyawan portal users.
        // % Target akun karyawan agar item baru diumumkan ke user portal karyawan.
        const employees = await db.employees.findMany({
          select: { userId: true },
        });

        const recipientUserIds = Array.from(
          new Set<string>(
            employees
              .map((employee: { userId?: string | null }) => employee.userId)
              .filter(
                (userId: string | null | undefined): userId is string =>
                  Boolean(userId),
              ),
          ),
        );

        if (!recipientUserIds.length) {
          return;
        }

        const title = "Item Marketplace Baru";
        const body = `${item.itemName} sekarang tersedia di Marketplace Dompet Integritas.`;

        const results = await Promise.allSettled(
          recipientUserIds.map((userId) =>
            NotificationService.createAndPush({
              userId,
              title,
              body,
              category: "POINTS",
              referenceEntity: "FlexibilityItems",
              referenceId: item.id,
            }),
          ),
        );

        const failedCount = results.filter(
          (result) => result.status === "rejected",
        ).length;

        if (failedCount > 0) {
          console.warn("[MARKETPLACE] Some item announcement notifications failed:", {
            itemId: item.id,
            totalRecipients: recipientUserIds.length,
            failedCount,
          });
        }
      } catch (error) {
        console.warn("[MARKETPLACE] Failed to broadcast new marketplace item:", {
          itemId: item.id,
          error,
        });
      }
    })();
  };

  const normalizeItemPayload = (
    data: any,
    options?: {
      existing?: {
        conditionField?: string | null;
        conditionValue?: string | null;
      };
      allowPastExpiredAt?: boolean;
    },
  ) => {
    const itemName = String(data.itemName ?? "").trim();
    if (!itemName) {
      throw new Error("Bad Request: itemName wajib diisi.");
    }

    const itemType = String(data.itemType ?? "").trim();
    if (!itemType) {
      throw new Error("Bad Request: itemType wajib diisi.");
    }

    const pointCost = Number(data.pointCost);
    if (!Number.isInteger(pointCost) || pointCost <= 0) {
      throw new Error("Bad Request: pointCost harus angka bulat lebih dari 0.");
    }

    const durationDays = Number(data.durationDays);
    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      throw new Error("Bad Request: durationDays harus angka bulat lebih dari 0.");
    }

    const maxPerMonth = normalizeMaxPerMonth(data.maxPerMonth);
    const description = normalizeOptionalString(data.description);
    const iconUrl = normalizeOptionalString(data.iconUrl);
    const expiredAt = parseDateOrNull(data.expiredAt, "expiredAt");

    if (
      expiredAt &&
      !options?.allowPastExpiredAt &&
      expiredAt.getTime() <= Date.now()
    ) {
      throw new Error("Bad Request: expiredAt harus tanggal di masa depan.");
    }

    const condition = resolveNormalizedCondition({
      payload: data,
      itemType,
      existing: options?.existing,
    });

    return {
      itemName,
      pointCost,
      itemType,
      durationDays,
      maxPerMonth,
      conditionField: condition.conditionField,
      conditionValue: condition.conditionValue,
      expiredAt,
      description,
      iconUrl,
      isActive: data.isActive == null ? true : Boolean(data.isActive),
    };
  };

  return {

  async createItem(data: any) {
    const normalized = normalizeItemPayload(data);
    const createdItem = await repo.flexibilityItems.create(normalized);
    broadcastNewMarketplaceItem(createdItem);
    return createdItem;
  },

  async getItems(
    skip: number = 0,
    take: number = 20,
    options?: {
      includeExpired?: boolean;
    },
  ) {
    const now = new Date();
    const where = options?.includeExpired
      ? undefined
      : {
          OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
        };

    const [items, total] = await Promise.all([
      repo.flexibilityItems.findAll({ skip, take, where }),
      repo.flexibilityItems.count(where),
    ]);

    return {
      data: items,
      pagination: {
        total,
        skip,
        take,
        pages: Math.ceil(total / Math.max(take, 1)),
      },
    };
  },

  async getItem(id: string) {
    return repo.flexibilityItems.findById(id);
  },

  async updateItem(id: string, data: any) {
    const existing = await repo.flexibilityItems.findById(id);
    if (!existing) {
      throw new Error("Not Found: Item marketplace tidak ditemukan.");
    }

    const existingItem = existing as any;

    const normalized = normalizeItemPayload(
      {
        ...existingItem,
        ...data,
      },
      {
        existing: {
          conditionField: existingItem.conditionField,
          conditionValue: existingItem.conditionValue,
        },
        allowPastExpiredAt: true,
      },
    );

    return repo.flexibilityItems.update(id, normalized);
  },

  async deleteItem(id: string) {
    return repo.flexibilityItems.delete(id);
  },

  // & Buy a token from the marketplace for a specific user.
  // % Beli token dari marketplace untuk user tertentu.
  async buyToken(
    userId: string,
    itemId: string,
    actor: AuditActor | undefined,
    ledgerService: any,
  ): Promise<{ success: boolean; token?: any; error?: string; retroactiveApplied?: boolean }> {
    try {
      const token = await db.$transaction(async (tx: any) => {
        const item = await tx.flexibilityItems.findUnique({
          where: { id: itemId },
        });

        if (!item || !item.isActive) {
          throw new Error("Bad Request: Item tidak tersedia.");
        }

        if (item.expiredAt && item.expiredAt <= new Date()) {
          throw new Error("Bad Request: Item marketplace sudah kedaluwarsa.");
        }

        if (Number(item.pointCost || 0) <= 0) {
          throw new Error("Bad Request: Konfigurasi point cost item tidak valid.");
        }

        if (item.maxPerMonth && item.maxPerMonth > 0) {
          const { start, end } = getMonthRange(new Date());
          const monthlyPurchaseCount = await tx.userTokens.count({
            where: {
              userId,
              itemId,
              createdAt: {
                gte: start,
                lt: end,
              },
            },
          });

          if (monthlyPurchaseCount >= Number(item.maxPerMonth)) {
            throw new Error(
              `Bad Request: Batas pembelian item ini ${item.maxPerMonth} kali per bulan.`,
            );
          }
        }

        const user = await tx.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            currentPoints: true,
          },
        });

        if (!user) {
          throw new Error("Not Found: User tidak ditemukan.");
        }

        const currentPoints = Number(user.currentPoints || 0);
        if (currentPoints < Number(item.pointCost)) {
          throw new Error("Bad Request: Poin tidak mencukupi.");
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number(item.durationDays || 0));
        const remainingDays = calculateRemainingDays(expiresAt);

        const createdToken = await tx.userTokens.create({
          data: {
            userId,
            itemId,
            status: "AVAILABLE",
            expiresAt,
            remainingDays,
          },
          include: {
            item: true,
            attendance: {
              select: { id: true },
            },
          },
        });

        await ledgerService.recordLedgerEntry(
          {
            userId,
            transactionType: TransactionType.SPEND,
            amount: -Math.abs(Number(item.pointCost)),
            description: `Pembelian token: ${item.itemName}`,
            referenceEntity: "token_purchase",
            referenceId: createdToken.id,
            actor,
          },
          tx,
        );

        return {
          ...createdToken,
          usedAtAttendanceId: createdToken.attendance?.id ?? null,
        };
      });

      // & Retroactive apply: if user has today's LATE attendance without token, apply the new token.
      // % Retroaktif: jika user punya absensi LATE hari ini tanpa token, terapkan token baru ini.
      let retroactiveApplied = false;
      try {
        retroactiveApplied = await applyTokenRetroactiveToToday(
          token,
          userId,
          actor,
          ledgerService,
          db,
        );
      } catch (retroErr) {
        console.warn("[MARKETPLACE] Retroactive token apply failed (non-critical):", retroErr);
      }

      return { success: true, token, retroactiveApplied };
    } catch (error: any) {
      const message = String(error?.message || "Gagal membeli token.");
      if (message.startsWith("Bad Request:") || message.startsWith("Not Found:")) {
        return { success: false, error: message.split(":").slice(1).join(":").trim() };
      }

      return { success: false, error: "Terjadi kesalahan saat membeli token." };
    }
  },
  };
};

/**
 * Menjalankan tanggung jawab utama fungsi applyTokenRetroactiveToToday.
 * @param token Parameter yang digunakan dalam proses ini.
 * @param userId Parameter yang digunakan dalam proses ini.
 * @param actor Parameter yang digunakan dalam proses ini.
 * @param ledgerService Parameter yang digunakan dalam proses ini.
 * @param db Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export async function applyTokenRetroactiveToToday(
  token: any,
  userId: string,
  actor: AuditActor | undefined,
  ledgerService: any,
  db: any,
): Promise<boolean> {
  const item = token.item;
  if (!item) return false;

  // & Determine if this token can cover LATE status (only late-allowance type tokens are retroactive).
  // % Periksa apakah token ini bisa menutup status LATE (hanya token izin keterlambatan yang retroaktif).
  const conditionField = String(item.conditionField ?? "").trim().toLowerCase();
  const conditionValue = String(item.conditionValue ?? "").trim();
  const itemType = String(item.itemType ?? "").trim().toLowerCase();
  const itemName = String(item.itemName ?? "").trim().toLowerCase();

  // & Extract threshold: from conditionField, itemType, or itemName.
  // % Ambil batas menit: dari conditionField, itemType, atau itemName.
  let threshold: number | null = null;

  if (conditionField === "attendance.lateminutes" && conditionValue) {
    const parsed = Number(conditionValue);
    if (Number.isInteger(parsed) && parsed > 0) threshold = parsed;
  }

  if (threshold == null) {
    const lateTypeMatch = itemType.match(/late_allowance_(\d+)m/i);
    if (lateTypeMatch?.[1]) {
      const parsed = Number(lateTypeMatch[1]);
      if (Number.isInteger(parsed) && parsed > 0) threshold = parsed;
    }
  }

  if (threshold == null) {
    const nameMatch =
      itemName.match(/(?:bebas\s+)?(?:telat|terlambat)\s+(\d+)\s*(?:menit|m)/i) ??
      itemName.match(/(\d+)\s*(?:menit|m)\s+(?:late|bebas|grace|toleransi)/i);
    if (nameMatch?.[1]) {
      const parsed = Number(nameMatch[1]);
      if (Number.isInteger(parsed) && parsed > 0) threshold = parsed;
    }
  }

  // & Only proceed for late-allowance tokens with a known threshold.
  // % Lanjutkan hanya untuk token izin telat dengan batas menit yang diketahui.
  if (threshold == null) return false;

  // & Find today's LATE attendance (without usedTokenId) for this user.
  // % Cari absensi hari ini dengan status LATE yang belum memakai token untuk user ini.
  const { dayStart, dayEnd } = getDayRangeByTimezone(new Date(), "Asia/Jakarta");

  const employee = await db.employees.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!employee) return false;

  const attendance = await db.attendances.findFirst({
    where: {
      employeeId: employee.id,
      status: "LATE",
      usedTokenId: null,
      checkIn: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { checkIn: "desc" },
    select: {
      id: true,
      checkIn: true,
      expectedCheckInSnapshot: true,
      status: true,
    },
  });

  if (!attendance) return false;

  // & Calculate how late the user actually was for this attendance.
  // % Hitung berapa menit keterlambatan aktual untuk absensi ini.
  let lateMinutes = 0;
  if (attendance.checkIn && attendance.expectedCheckInSnapshot) {
    const diffMs = attendance.checkIn.getTime() - attendance.expectedCheckInSnapshot.getTime();
    lateMinutes = Math.max(0, Math.floor(diffMs / 60000));
  }

  // & Token only covers lateness up to threshold minutes.
  // % Token hanya menanggung keterlambatan sampai batas menit threshold.
  if (lateMinutes > threshold) {
    console.log(
      `[MARKETPLACE] Retroactive skipped: lateMinutes=${lateMinutes} > threshold=${threshold} for attendance ${attendance.id}`,
    );
    return false;
  }

  console.log(
    `[MARKETPLACE] Retroactive apply: token ${token.id} → attendance ${attendance.id} (lateMinutes=${lateMinutes} <= ${threshold})`,
  );

  // & Mark token as USED and link it to the attendance.
  // % Tandai token sebagai USED dan hubungkan ke absensi.
  await db.userTokens.update({
    where: { id: token.id },
    data: { status: "USED", usedAt: new Date() },
  });

  await db.attendances.update({
    where: { id: attendance.id },
    data: { usedTokenId: token.id, status: "PRESENT" },
  });

  // & Write audit trail for retroactive token application.
  // % Tulis jejak audit untuk penerapan token secara retroaktif.
  const auditActor = actor ?? { id: "SYSTEM", role: "SYSTEM" };
  await writeAuditLog({
    actor: auditActor,
    action: "AUTO_APPLY_ATTENDANCE_TOKEN",
    entity: "Attendances",
    entityId: attendance.id,
    changes: {
      source: "TOKEN_PURCHASE_RETROACTIVE",
      tokenId: token.id,
      tokenItemId: token.itemId,
      tokenItemName: item.itemName ?? null,
      beforeStatus: "LATE",
      afterStatus: "PRESENT",
      lateMinutes,
      lateThreshold: threshold,
    },
    reason: `Token ${item.itemName} diterapkan retroaktif saat pembelian untuk absensi hari ini (terlambat ${lateMinutes} menit, batas ${threshold} menit).`,
    db,
  });

  // & Record token-used mutation in point ledger so employee history shows usage events.
  // % Catat mutasi token terpakai di ledger poin agar riwayat karyawan menampilkan event penggunaan.
  const tokenUsageReferenceEntity = "ATTENDANCE_TOKEN_OVERRIDE";
  const tokenUsageReferenceId = `${attendance.id}:${token.id}`;

  const existingTokenUsageLog = await db.pointLedgers.findFirst({
    where: {
      userId,
      referenceEntity: tokenUsageReferenceEntity,
      referenceId: tokenUsageReferenceId,
    },
    select: { id: true },
  });

  if (!existingTokenUsageLog) {
    await ledgerService.recordLedgerEntry(
      {
        userId,
        transactionType: TransactionType.ADJUSTMENT,
        amount: 0,
        description: `[TOKEN_PURCHASE_RETROACTIVE] Token telah digunakan untuk absensi ${attendance.id} (token ${token.id})`,
        referenceEntity: tokenUsageReferenceEntity,
        referenceId: tokenUsageReferenceId,
        actor: auditActor,
      },
      db,
    );

    console.log("[MARKETPLACE] Token usage ledger mutation created:", {
      attendanceId: attendance.id,
      tokenId: token.id,
      referenceEntity: tokenUsageReferenceEntity,
      referenceId: tokenUsageReferenceId,
    });
  } else {
    console.log("[MARKETPLACE] Token usage ledger mutation already exists:", {
      attendanceId: attendance.id,
      tokenId: token.id,
      referenceEntity: tokenUsageReferenceEntity,
      referenceId: tokenUsageReferenceId,
    });
  }

  // & Reimburse point deductions from rules applied to this attendance today.
  // % Kembalikan potongan poin dari rule yang sudah diterapkan ke absensi ini hari ini.
  const penaltyLedgers = await db.pointLedgers.findMany({
    where: {
      userId,
      referenceEntity: "ATTENDANCE_RULE",
      referenceId: { startsWith: `${attendance.id}:` },
      amount: { lt: 0 },
    },
  });

  // % Proses pengembalian untuk setiap ledger penalti yang terkait dengan absensi ini. Log setiap pengembalian yang berhasil. maksud dari pengembalian ini adalah untuk memastikan bahwa pengguna mendapatkan kembali poin yang seharusnya tidak dipotong karena token retroaktif ini menutup status LATE mereka.
  for (const ledger of penaltyLedgers) {
    const refundAmount = Math.abs(Number(ledger.amount));
    if (refundAmount <= 0) continue;

    await ledgerService.recordLedgerEntry(
      {
        userId,
        transactionType: TransactionType.EARN,
        amount: refundAmount,
        description: `[TOKEN_RETROACTIVE] Reimbursement rule ${ledger.description ?? ledger.referenceId} akibat token ${item.itemName} diterapkan retroaktif`,
        referenceEntity: "token_retroactive_refund",
        referenceId: `${token.id}:${ledger.id}`,
        actor: auditActor,
      },
      db,
    );

    console.log(`[MARKETPLACE] Reimbursed ${refundAmount} pts for ledger ${ledger.id}`);
  }

  return true;
}



/** Mendefinisikan alias tipe untuk AttendanceStatus. */
export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "LEAVE"
  | "OFF"
  | string;



/** Mendefinisikan kontrak data untuk interface AttendanceContext. */
export interface AttendanceContext {
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  attendanceStatus?: AttendanceStatus | null;
  statusCheckOut?: AttendanceStatus | null;
  lateMinutes?: number;
  minutesEarly?: number;
  monthlyCount?: number;
  isLate?: boolean;
  isAbsent?: boolean;
}



/** Mendefinisikan alias tipe untuk MatchedRule. */
export type MatchedRule = {
  id: string;
  ruleName: string;
  pointModifier: number;
  conditionField: string;
  conditionOp: string;
  conditionValue: string;
};



/** Mengekspor createRuleEngineService untuk kebutuhan modul ini. */
export const createRuleEngineService = (repo: PointsRepository) => ({
  // & Evaluate active rules for a user role and attendance context.
  // % Evaluasi aturan aktif untuk role user dan konteks absensi.
  async evaluatePointsFromAttendance(
    userId: string,
    userRole: string,
    context: AttendanceContext,
  ): Promise<{
    pointModifier: number;
    rulesApplied: string[];
    matchedRules: MatchedRule[];
  }> {
    try {
      void userId;

      const rules = await repo.rules.findByRole(userRole);
      let totalPointModifier = 0;
      const rulesApplied: string[] = [];
// & Resolve left-side value from attendance context based on normalized field key.
// % Ambil nilai sisi kiri dari konteks absensi berdasarkan key field yang dinormalisasi.
      const matchedRules: MatchedRule[] = [];

      for (const rule of rules) {
        if (!matchesRule(rule, context)) {
          continue;
        }

        const pointModifier = Number(rule.pointModifier || 0);
        totalPointModifier += pointModifier;
        rulesApplied.push(
          `${rule.ruleName} (${pointModifier >= 0 ? "+" : ""}${pointModifier})`,
        );

        matchedRules.push({
          id: String(rule.id),
          ruleName: String(rule.ruleName),
          pointModifier,
          conditionField: String(rule.conditionField || ""),
          conditionOp: String(rule.conditionOp || ""),
          conditionValue: String(rule.conditionValue || ""),
        });
      }

      return {
        pointModifier: totalPointModifier,
        rulesApplied,
        matchedRules,
      };
    } catch (error) {
      console.error("[RuleEngine] Failed to evaluate rules:", error);
      return { pointModifier: 0, rulesApplied: [], matchedRules: [] };
    }
  },
});

/**
 * Menjalankan tanggung jawab utama fungsi matchesRule.
 * @param rule Parameter yang digunakan dalam proses ini.
 * @param context Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function matchesRule(rule: any, context: AttendanceContext) {
  const field = normalizeField(String(rule.conditionField || ""));
  const op = normalizeOperator(String(rule.conditionOp || ""));
  const rawValue = String(rule.conditionValue || "");

  const left = getLeftValue(field, context);
  if (left === undefined || left === null) {
    return false;
  }

  if (typeof left === "boolean") {
    return compareBoolean(left, op, rawValue);
  }

  if (typeof left === "number") {
    return compareNumber(left, op, rawValue);
  }

  if (field === "attendance.checkintime" || field === "check_in_time") {
    return compareTime(left, op, rawValue);
  }

  return compareString(String(left), op, rawValue);
}



/**
 * Menjalankan tanggung jawab utama fungsi getLeftValue.
 * @param field Parameter yang digunakan dalam proses ini.
 * @param context Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function getLeftValue(field: string, context: AttendanceContext) {
  const normalizedStatus = context.attendanceStatus?.toUpperCase();
  const normalizedCheckOutStatus = context.statusCheckOut?.toUpperCase();
  const isAbsentContext =
    context.isAbsent === true ||
    normalizedStatus === "ABSENT" ||
    normalizedCheckOutStatus === "ABSENT";
  const isLateContext =
    context.isLate === true ||
    normalizedStatus === "LATE" ||
    normalizedCheckOutStatus === "LATE";
  const isPresentContext =
    normalizedStatus === "PRESENT" ||
    normalizedCheckOutStatus === "PRESENT";

  if (field === "attendance.islate") {
    if (typeof context.isLate === "boolean") return context.isLate;
    if (normalizedStatus) return normalizedStatus === "LATE";
    if (normalizedCheckOutStatus) return normalizedCheckOutStatus === "LATE";
    return undefined;
  }

  if (field === "attendance.isabsent") {
    if (typeof context.isAbsent === "boolean") return context.isAbsent;
    if (normalizedStatus) return normalizedStatus === "ABSENT";
    return undefined;
  }

  if (field === "attendance.lateminutes" || field === "late_minutes") {
    // & Late-minutes rules must not run for absent records.
    // % Rule menit telat tidak boleh dieksekusi untuk data alpa.
    if (isAbsentContext || !isLateContext) return undefined;

    return Number.isFinite(context.lateMinutes)
      ? Number(context.lateMinutes)
      : undefined;
  }

  if (
    field === "attendance.minutesearly" ||
    field === "attendance.earlyminutes"
  ) {
    // & Early-arrival rules must not run for absent records.
    // % Rule datang lebih awal tidak boleh dieksekusi untuk data alpa.
    if (isAbsentContext || !isPresentContext) return undefined;

    return Number.isFinite(context.minutesEarly)
      ? Number(context.minutesEarly)
      : undefined;
  }

  if (field === "attendance.monthlycount") {
    return Number.isFinite(context.monthlyCount)
      ? Number(context.monthlyCount)
      : undefined;
  }

  if (field === "attendance.checkintime" || field === "check_in_time") {
    // & Check-in time is not meaningful for absent records.
    // % Waktu check-in tidak relevan untuk data alpa.
    if (isAbsentContext) return undefined;

    if (!context.checkInTime) return undefined;
    return toHHMM(context.checkInTime);
  }

  if (field === "attendance.status" || field === "attendance_status") {
    return normalizedStatus;
  }

  return undefined;
}

/**
 * Menjalankan tanggung jawab utama fungsi normalizeField.
 * @param field Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function normalizeField(field: string) {
  return field.trim().toLowerCase();
}

/**
 * Menjalankan tanggung jawab utama fungsi normalizeOperator.
 * @param op Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function normalizeOperator(op: string) {
  const normalized = op.trim().toLowerCase();
  // ? eq = equals
  if (normalized === "eq") return "==";
  // ? ne = not equals
  if (normalized === "ne") return "!=";
  return normalized;
}

/**
 * Menjalankan tanggung jawab utama fungsi compareBoolean.
 * @param left Parameter yang digunakan dalam proses ini.
 * @param op Parameter yang digunakan dalam proses ini.
 * @param right Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function compareBoolean(left: boolean, op: string, right: string) {
  const normalizedRight = parseBoolean(right);
  if (normalizedRight == null) return false;

  if (op === "==") return left === normalizedRight;
  if (op === "!=") return left !== normalizedRight;

  return false;
}

/**
 * Menjalankan tanggung jawab utama fungsi compareString.
 * @param left Parameter yang digunakan dalam proses ini.
 * @param op Parameter yang digunakan dalam proses ini.
 * @param right Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function compareString(left: string, op: string, right: string) {
  const l = left.trim().toUpperCase();
  const r = right.trim().toUpperCase();

  if (op === "==") return l === r;
  if (op === "!=") return l !== r;
  if (op === "in") {
    return right
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .includes(l);
  }

  return false;
}

/**
 * Menjalankan tanggung jawab utama fungsi compareNumber.
 * @param left Parameter yang digunakan dalam proses ini.
 * @param op Parameter yang digunakan dalam proses ini.
 * @param right Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function compareNumber(left: number, op: string, right: string) {
  if (op === "between") {
    const [minRaw, maxRaw] = splitRangeValue(right);
    const min = Number(minRaw);
    const max = Number(maxRaw);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
    return left >= min && left <= max;
  }

  const parsed = Number(right);
  if (!Number.isFinite(parsed)) return false;
  if (op === "<") return left < parsed;
  if (op === "<=") return left <= parsed;
  if (op === ">") return left > parsed;
  if (op === ">=") return left >= parsed;
  if (op === "==") return left === parsed;
  if (op === "!=") return left !== parsed;

  return false;
}

/**
 * Menjalankan tanggung jawab utama fungsi compareTime.
 * @param left Parameter yang digunakan dalam proses ini.
 * @param op Parameter yang digunakan dalam proses ini.
 * @param right Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function compareTime(left: string, op: string, right: string) {
  const leftMin = hhmmToMinute(left);
  const rightMin = hhmmToMinute(right);
  if (leftMin == null || rightMin == null) return false;

  if (op === "between") {
    const [minRaw, maxRaw] = splitRangeValue(right);
    const min = hhmmToMinute(minRaw);
    const max = hhmmToMinute(maxRaw);
    if (min == null || max == null) return false;
    return leftMin >= min && leftMin <= max;
  }

  if (op === "<") return leftMin < rightMin;
  if (op === "<=") return leftMin <= rightMin;
  if (op === ">") return leftMin > rightMin;
  if (op === ">=") return leftMin >= rightMin;
  if (op === "==") return leftMin === rightMin;
  if (op === "!=") return leftMin !== rightMin;

  return false;
}

/**
 * Menjalankan tanggung jawab utama fungsi splitRangeValue.
 * @param value Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function splitRangeValue(value: string): [string, string] {
  if (value.includes(",")) {
    const [minRaw = "", maxRaw = ""] = value.split(",");
    return [minRaw.trim(), maxRaw.trim()];
  }

  const [minRaw = "", maxRaw = ""] = value.split("-");
  return [minRaw.trim(), maxRaw.trim()];
}

/**
 * Menjalankan tanggung jawab utama fungsi toHHMM.
 * @param date Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function toHHMM(date: Date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Menjalankan tanggung jawab utama fungsi hhmmToMinute.
 * @param value Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function hhmmToMinute(value: string) {
  const parts = value.split(":").map((v) => v.trim());
  const h = parts[0];
  const m = parts[1];
  const hour = Number(h);
  const minute = Number(m);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return hour * 60 + minute;
}

/**
 * Menjalankan tanggung jawab utama fungsi parseBoolean.
 * @param value Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function parseBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "ya"].includes(normalized)) return true;
  if (["false", "0", "no", "tidak"].includes(normalized)) return false;
  return null;
}



/** Mengekspor SYSTEM_ACTOR untuk kebutuhan modul ini. */
export const SYSTEM_ACTOR: AuditActor = {
  id: "SYSTEM",
  role: "SYSTEM",
};



/** Mendefinisikan alias tipe untuk AttendanceCondition. */
export type AttendanceCondition = {
  status: string;
  lateMinutes?: number | null;
  source?: "CHECK_IN" | "CRON_ABSENT";
};



/** Mendefinisikan alias tipe untuk TokenMatchResult. */
export type TokenMatchResult = {
  statusOverride: "PRESENT" | "LEAVE";
  reason: string;
  // & The late-allowance threshold this token covers (minutes). Null for non-late tokens.
  // % Batas menit telat yang dicakup token ini. Null untuk token bukan keterlambatan.
  lateThreshold: number | null;
};



/** Mendefinisikan alias tipe untuk TokenItemSnapshot. */
export type TokenItemSnapshot = {
  itemType?: string | null;
  itemName?: string | null;
  conditionField?: string | null;
  conditionValue?: string | null;
};



/** Mendefinisikan alias tipe untuk TokenMatchTraceMeta. */
export type TokenMatchTraceMeta = {
  tokenId?: string;
  itemType?: string | null;
  conditionField?: string | null;
  conditionValue?: string | null;
};



/** Mengekspor logTokenMatchTrace untuk kebutuhan modul ini. */
export const logTokenMatchTrace = (
  step: string,
  payload: Record<string, unknown>,
  meta?: TokenMatchTraceMeta,
) => {
  if (!meta) return;
  console.log(`[TOKEN][MATCH] ${step}:`, {
    ...meta,
    ...payload,
  });
};



/** Mengekspor LATE_ALLOWANCE_TYPE_REGEX untuk kebutuhan modul ini. */
export const LATE_ALLOWANCE_TYPE_REGEX = /late_allowance_(\d+)m/i;


/** Mengekspor LATE_ALLOWANCE_NAME_REGEX untuk kebutuhan modul ini. */
export const LATE_ALLOWANCE_NAME_REGEX = /(\d+)\s*menit/i;


/** Mengekspor ATTENDANCE_LOOKUP_RETRY_DELAYS_MS untuk kebutuhan modul ini. */
export const ATTENDANCE_LOOKUP_RETRY_DELAYS_MS = [0, 50, 125] as const;



/** Mendefinisikan alias tipe untuk AttendanceLookupSnapshot. */
export type AttendanceLookupSnapshot = {
  id: string;
  employee: {
    userId: string | null;
  } | null;
  status: string | null;
  usedTokenId: string | null;
  checkIn: Date | null;
  expectedCheckInSnapshot: Date | null;
};



/** Mengekspor wait untuk kebutuhan modul ini. */
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));



/** Mengekspor normalizeStatus untuk kebutuhan modul ini. */
export const normalizeStatus = (value: unknown) =>
  String(value ?? "").trim().toUpperCase();



/** Mengekspor parseLateMinutes untuk kebutuhan modul ini. */
export const parseLateMinutes = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  return Math.floor(parsed);
};



/** Mengekspor getLateMinutesFromAttendance untuk kebutuhan modul ini. */
export const getLateMinutesFromAttendance = (
  attendance: Pick<
    AttendanceLookupSnapshot,
    "checkIn" | "expectedCheckInSnapshot"
  > | null,
) => {
  if (!attendance?.checkIn || !attendance.expectedCheckInSnapshot) {
    return null;
  }

  const diffMs =
    attendance.checkIn.getTime() - attendance.expectedCheckInSnapshot.getTime();

  return Math.max(0, Math.floor(diffMs / 60000));
};



/** Mengekspor resolveLateMinutesForMatching untuk kebutuhan modul ini. */
export const resolveLateMinutesForMatching = (
  condition: AttendanceCondition,
  attendance: Pick<
    AttendanceLookupSnapshot,
    "id" | "checkIn" | "expectedCheckInSnapshot"
  > | null,
) => {
  const fromCondition = parseLateMinutes(condition.lateMinutes);
  if (fromCondition != null) {
    console.log("[TOKEN] lateMinutes resolved from context:", {
      requestedLateMinutes: condition.lateMinutes ?? null,
      resolvedLateMinutes: fromCondition,
    });
    return {
      lateMinutes: fromCondition,
      source: "context",
    } as const;
  }

  const fromAttendance = getLateMinutesFromAttendance(attendance);
  if (fromAttendance != null) {
    console.log("[TOKEN] lateMinutes resolved from attendance snapshot:", {
      attendanceId: attendance?.id ?? null,
      checkIn: attendance?.checkIn?.toISOString?.() ?? null,
      expectedCheckInSnapshot:
        attendance?.expectedCheckInSnapshot?.toISOString?.() ?? null,
      resolvedLateMinutes: fromAttendance,
    });
    return {
      lateMinutes: fromAttendance,
      source: "attendance_snapshot",
    } as const;
  }

  if (normalizeStatus(condition.status) === "LATE") {
    console.warn("[TOKEN] lateMinutes unresolved for LATE status; using MAX_SAFE_INTEGER fallback.", {
      requestedLateMinutes: condition.lateMinutes ?? null,
      conditionStatus: condition.status,
    });
    return {
      lateMinutes: Number.MAX_SAFE_INTEGER,
      source: "fallback_unknown_late",
    } as const;
  }

  console.log("[TOKEN] lateMinutes unresolved for non-late status; using 0 fallback.", {
    requestedLateMinutes: condition.lateMinutes ?? null,
    conditionStatus: condition.status,
  });
  return {
    lateMinutes: 0,
    source: "fallback_non_late",
  } as const;
};



/** Mengekspor isTokenStillValidUntilEndOfDay untuk kebutuhan modul ini. */
export const isTokenStillValidUntilEndOfDay = (expiresAt: Date, now: Date) => {
  const { dayEnd } = getDayRangeByTimezone(expiresAt, DEFAULT_TIMEZONE);
  return dayEnd.getTime() > now.getTime();
};



/** Mengekspor parsePositiveInteger untuk kebutuhan modul ini. */
export const parsePositiveInteger = (raw: string): number | null => {
  const normalized = raw.trim().replace(/^['\"]|['\"]$/g, "");
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};



/** Mengekspor resolveLateAllowanceThreshold untuk kebutuhan modul ini. */
export const resolveLateAllowanceThreshold = (
  item: TokenItemSnapshot | undefined,
): number | null => {
  const fromType = String(item?.itemType ?? "").match(LATE_ALLOWANCE_TYPE_REGEX);
  if (fromType?.[1]) {
    const parsed = parsePositiveInteger(fromType[1]);
    if (parsed != null) return parsed;
  }

  const fromName = String(item?.itemName ?? "").match(LATE_ALLOWANCE_NAME_REGEX);
  if (fromName?.[1]) {
    const parsed = parsePositiveInteger(fromName[1]);
    if (parsed != null) return parsed;
  }

  return null;
};



// & Build token interceptor service used by attendance rule flow.
// % Bangun service interceptor token yang dipakai alur rule absensi.
/** Mengekspor createTokenInterceptorService untuk kebutuhan modul ini. */
export const createTokenInterceptorService = (repo: PointsRepository, db: any) => ({
  // & Apply best matched token and mark token as used. Also exposes matched late threshold.
  // % Terapkan token paling cocok lalu tandai token sebagai terpakai. Ekspor juga batas menit telat yang cocok.
  async checkAndApplyToken(
    userId: string,
    attendanceId: string,
    condition: AttendanceCondition,
    actor?: AuditActor,
    dbClient?: any,
  ): Promise<{ tokenUsed?: any; statusOverride?: string; attendance?: any; lateThreshold?: number | null }> {
    const dbRuntime = dbClient ?? db;
    const runTokenMutationTransaction = async <T>(
      operation: (tx: any) => Promise<T>,
    ): Promise<T> => {
      if (dbClient) {
        return operation(dbClient);
      }

      return db.$transaction(async (tx: any) => operation(tx));
    };

    let attendance: AttendanceLookupSnapshot | null = null;
    for (let index = 0; index < ATTENDANCE_LOOKUP_RETRY_DELAYS_MS.length; index += 1) {
      const waitMs = ATTENDANCE_LOOKUP_RETRY_DELAYS_MS[index];
      if (waitMs > 0) {
        await wait(waitMs);
      }

      attendance = await dbRuntime.attendances.findUnique({
        where: { id: attendanceId },
        select: {
          id: true,
          employee: {
            select: {
              userId: true,
            },
          },
          status: true,
          usedTokenId: true,
          checkIn: true,
          expectedCheckInSnapshot: true,
        },
      });

      if (attendance) {
        if (index > 0) {
          console.warn("[TOKEN] Attendance lookup recovered after retry:", {
            attendanceId,
            attempt: index + 1,
            maxAttempts: ATTENDANCE_LOOKUP_RETRY_DELAYS_MS.length,
          });
        }
        break;
      }

      console.warn("[TOKEN] Attendance lookup miss, retrying...", {
        attendanceId,
        attempt: index + 1,
        maxAttempts: ATTENDANCE_LOOKUP_RETRY_DELAYS_MS.length,
      });
    }

    if (!attendance) {
      console.warn("[TOKEN] Attendance still missing after retries; proceed with optimistic re-check at write phase.", {
        attendanceId,
        attempts: ATTENDANCE_LOOKUP_RETRY_DELAYS_MS.length,
      });
    } else if (attendance.employee?.userId !== userId || attendance.usedTokenId) {
      console.log("[TOKEN] checkAndApplyToken skipped:", {
        attendanceNotFound: false,
        userMismatch: attendance.employee?.userId !== userId,
        alreadyUsed: !!attendance.usedTokenId,
      });
      return {};
    }

    const normalizedConditionStatus = normalizeStatus(condition.status);
    const normalizedAttendanceStatus = normalizeStatus(attendance?.status);
    const conditionStatusUsable = ["LATE", "ABSENT", "PRESENT", "LEAVE", "OFF"].includes(
      normalizedConditionStatus,
    );
    const lateMinutesHint = parseLateMinutes(condition.lateMinutes);
    const inferredStatusFromCondition =
      condition.source === "CRON_ABSENT"
        ? "ABSENT"
        : lateMinutesHint != null && lateMinutesHint > 0
          ? "LATE"
          : "";
    const effectiveStatus = conditionStatusUsable
      ? normalizedConditionStatus
      : normalizedAttendanceStatus || inferredStatusFromCondition;
    const lateMinutesResult = resolveLateMinutesForMatching(condition, attendance);

    const effectiveCondition: AttendanceCondition = {
      status: effectiveStatus,
      lateMinutes: lateMinutesResult.lateMinutes,
      source: condition.source,
    };

    console.log("[TOKEN] Condition pipeline:", {
      attendanceId,
      requestedStatus: normalizedConditionStatus || null,
      conditionStatusUsable,
      attendanceStatus: normalizedAttendanceStatus || null,
      inferredStatusFromCondition: inferredStatusFromCondition || null,
      effectiveStatus,
      requestedLateMinutes: condition.lateMinutes ?? null,
      lateMinutesHint,
      effectiveLateMinutes: effectiveCondition.lateMinutes,
      lateMinutesSource: lateMinutesResult.source,
      source: condition.source ?? null,
    });

    if (!effectiveStatus) {
      console.warn("[TOKEN] Missing effective status. Token interceptor aborted.", {
        attendanceId,
        condition,
      });
      return {};
    }

    const now = new Date();
    const { dayStart, dayEnd } = getDayRangeByTimezone(now, DEFAULT_TIMEZONE);
    console.log("[TOKEN] Expiry window for active token query:", {
      now: now.toISOString(),
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      note: "Token berlaku sampai akhir hari bisnis pada tanggal expiresAt.",
    });

    const queriedTokens = await dbRuntime.userTokens.findMany({
      where: {
        userId,
        status: "AVAILABLE",
        // & Include tokens with the same expiry date for the current business day.
        // % Sertakan token dengan tanggal kedaluwarsa hari ini (valid sampai akhir hari).
        expiresAt: { gte: dayStart },
      },
      include: {
        item: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const availableTokens = queriedTokens.filter((token: { expiresAt: Date }) =>
      isTokenStillValidUntilEndOfDay(token.expiresAt, now),
    );

    if (!availableTokens.length) {
      console.log("[TOKEN] No available tokens for user:", userId, {
        queriedCount: queriedTokens.length,
      });
      return {};
    }

    console.log("[TOKEN] Checking", availableTokens.length, "available tokens for condition:", effectiveCondition);

    for (const token of availableTokens) {
      const traceMeta: TokenMatchTraceMeta = {
        tokenId: token.id,
        itemType: token.item?.itemType ?? null,
        conditionField: token.item?.conditionField ?? null,
        conditionValue: token.item?.conditionValue ?? null,
      };

      logTokenMatchTrace(
        "begin_evaluation",
        {
          normalizedStatus: normalizeStatus(effectiveCondition.status),
          lateMinutes: effectiveCondition.lateMinutes ?? null,
          source: effectiveCondition.source ?? null,
        },
        traceMeta,
      );

      const thresholdCandidate = resolveLateAllowanceThreshold(token.item);
      const match = matchTokenToCondition(token.item, effectiveCondition, traceMeta);

      console.log("[TOKEN] matchTokenToCondition result:", {
        tokenId: token.id,
        itemType: token.item?.itemType ?? null,
        conditionField: token.item?.conditionField ?? null,
        conditionValue: token.item?.conditionValue ?? null,
        normalizedStatus: normalizeStatus(effectiveCondition.status),
        lateMinutes: effectiveCondition.lateMinutes ?? null,
        thresholdCandidate,
        matched: Boolean(match),
        matchReason: match?.reason ?? null,
      });

      if (
        !match &&
        normalizeStatus(effectiveCondition.status) === "LATE" &&
        thresholdCandidate != null &&
        Number(effectiveCondition.lateMinutes) > thresholdCandidate
      ) {
        console.log("[TOKEN] Token rejected: late minutes exceed threshold", {
          tokenId: token.id,
          lateMinutes: effectiveCondition.lateMinutes,
          threshold: thresholdCandidate,
        });
      }

      if (!match) continue;

      const applied = await runTokenMutationTransaction(async (tx: any) => {
        const attendanceForWrite = await tx.attendances.findUnique({
          where: { id: attendanceId },
          select: {
            id: true,
            employee: {
              select: {
                userId: true,
              },
            },
            status: true,
            usedTokenId: true,
          },
        });

        if (!attendanceForWrite) {
          return null;
        }

        if (attendanceForWrite.employee?.userId !== userId) {
          return null;
        }

        if (attendanceForWrite.usedTokenId) {
          return null;
        }

        const attendancePatch = await tx.attendances.updateMany({
          where: {
            id: attendanceForWrite.id,
            usedTokenId: null,
          },
          data: {
            usedTokenId: token.id,
            status: match.statusOverride,
          },
        });

        if (!attendancePatch.count) {
          return null;
        }

        const tokenPatch = await tx.userTokens.updateMany({
          where: {
            id: token.id,
            userId,
            status: "AVAILABLE",
          },
          data: {
            status: "USED",
            usedAt: new Date(),
          },
        });

        if (!tokenPatch.count) {
          throw new Error("Conflict: Token sudah tidak AVAILABLE saat akan dipakai.");
        }

        const [updatedToken, updatedAttendance] = await Promise.all([
          tx.userTokens.findUnique({
            where: { id: token.id },
            include: {
              item: true,
              attendance: {
                select: {
                  id: true,
                },
              },
            },
          }),
          tx.attendances.findUnique({
            where: { id: attendanceForWrite.id },
            select: {
              id: true,
              status: true,
              usedTokenId: true,
            },
          }),
        ]);

        if (!updatedToken || !updatedAttendance) {
          throw new Error("Conflict: Gagal membaca ulang data token/attendance setelah apply token.");
        }

        return {
          updatedToken,
          updatedAttendance,
          beforeStatus: attendanceForWrite.status,
        };
      });

      if (!applied) {
        console.warn("[TOKEN] Match found but attendance/token no longer writable. Skipping token apply.", {
          attendanceId,
          tokenId: token.id,
        });
        continue;
      }

      const { updatedToken, updatedAttendance, beforeStatus } = applied;

      console.log("[TOKEN] Token applied successfully. New attendance status:", updatedAttendance.status, "usedTokenId:", updatedAttendance.usedTokenId);

      const auditActor = actor ?? SYSTEM_ACTOR;
      const reason =
        beforeStatus === "ABSENT" && match.statusOverride === "LEAVE"
          ? "System override status ABSENT menjadi LEAVE via token kelonggaran."
          : `System auto-apply token attendance: ${match.reason}`;

      await writeAuditLog({
        actor: auditActor,
        action: "AUTO_APPLY_ATTENDANCE_TOKEN",
        entity: "Attendances",
        entityId: updatedAttendance.id,
        changes: {
          source: condition.source ?? "CHECK_IN",
          tokenId: token.id,
          tokenItemId: token.itemId,
          tokenItemName: token.item?.itemName ?? null,
          beforeStatus,
          afterStatus: updatedAttendance.status,
          usedTokenId: updatedAttendance.usedTokenId,
          lateMinutes: effectiveCondition.lateMinutes ?? 0,
          lateThreshold: match.lateThreshold,
        },
        reason,
        db: dbRuntime,
      });

    

      const tokenUsed = {
        ...updatedToken,
        usedAtAttendanceId:
          updatedToken.attendance?.id ?? updatedAttendance.id ?? null,
        lateThreshold: match.lateThreshold,
      };

      return {
        tokenUsed,
        statusOverride: match.statusOverride,
        attendance: updatedAttendance,
        lateThreshold: match.lateThreshold,
      };
    }

    console.log("[TOKEN] No matching token found for condition:", effectiveCondition);
    return {};
  },

  // & Find one usable token without mutating data.
  // % Cari satu token yang bisa dipakai tanpa mengubah data.
  async findBestMatchingToken(userId: string, condition: AttendanceCondition) {
    const availableTokens = await repo.userTokens.findAvailable(userId);
    return (
      availableTokens.find((token: { item?: TokenItemSnapshot }) =>
        Boolean(matchTokenToCondition(token.item, condition)),
      ) ?? null
    );
  },
});

/**
 * Menjalankan tanggung jawab utama fungsi matchTokenToCondition.
 * @param item Parameter yang digunakan dalam proses ini.
 * @param condition Parameter yang digunakan dalam proses ini.
 * @param traceMeta Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function matchTokenToCondition(
  item: TokenItemSnapshot | undefined,
  condition: AttendanceCondition,
  traceMeta?: TokenMatchTraceMeta,
): TokenMatchResult | null {
  const dynamicMatch = matchTokenByConditionField(item, condition, traceMeta);
  if (dynamicMatch) {
    logTokenMatchTrace(
      "stage_dynamic_match",
      {
        matched: true,
        reason: dynamicMatch.reason,
      },
      traceMeta,
    );
    return dynamicMatch;
  }

  logTokenMatchTrace(
    "stage_dynamic_match",
    {
      matched: false,
    },
    traceMeta,
  );

  // & Try legacy itemType match first, then itemName-based inference.
  // % Coba match itemType lama terlebih dahulu, lalu inferensi dari itemName.
  const legacyMatch = matchLegacyItemType(item?.itemType, condition, traceMeta);
  if (legacyMatch) {
    logTokenMatchTrace(
      "stage_legacy_match",
      {
        matched: true,
        reason: legacyMatch.reason,
      },
      traceMeta,
    );
    return legacyMatch;
  }

  logTokenMatchTrace(
    "stage_legacy_match",
    {
      matched: false,
    },
    traceMeta,
  );

  const itemNameMatch = matchByItemName(item?.itemName, condition, traceMeta);
  if (itemNameMatch) {
    logTokenMatchTrace(
      "stage_item_name_match",
      {
        matched: true,
        reason: itemNameMatch.reason,
      },
      traceMeta,
    );
  } else {
    logTokenMatchTrace(
      "stage_item_name_match",
      {
        matched: false,
        reason: "no_match",
      },
      traceMeta,
    );
  }

  return itemNameMatch;
}

/**
 * Menjalankan tanggung jawab utama fungsi matchTokenByConditionField.
 * @param item Parameter yang digunakan dalam proses ini.
 * @param condition Parameter yang digunakan dalam proses ini.
 * @param traceMeta Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function matchTokenByConditionField(
  item: TokenItemSnapshot | undefined,
  condition: AttendanceCondition,
  traceMeta?: TokenMatchTraceMeta,
): TokenMatchResult | null {
  const field = String(item?.conditionField ?? "").trim().toLowerCase();
  const value = String(item?.conditionValue ?? "").trim();
  if (!field || !value) {
    logTokenMatchTrace(
      "condition_field_missing",
      {
        field: field || null,
        value: value || null,
      },
      traceMeta,
    );
    return null;
  }

  const normalizedStatus = String(condition.status ?? "").toUpperCase();

  // & attendance.lateMinutes: token hanya cocok jika status LATE dan lateMinutes <= threshold.
  // % Berlaku jika status LATE dan menit keterlambatan tidak melebihi nilai token.
  if (field === "attendance.lateminutes") {
    if (normalizedStatus !== "LATE") {
      logTokenMatchTrace(
        "condition_late_minutes_status_mismatch",
        {
          normalizedStatus,
          requiredStatus: "LATE",
        },
        traceMeta,
      );
      return null;
    }

    const threshold = parsePositiveInteger(value);
    if (threshold == null) {
      logTokenMatchTrace(
        "condition_late_minutes_invalid_threshold",
        {
          rawThreshold: value,
        },
        traceMeta,
      );
      return null;
    }

    const lateMinutes = parseLateMinutes(condition.lateMinutes);
    if (lateMinutes == null) {
      logTokenMatchTrace(
        "condition_late_minutes_missing_context",
        {
          providedLateMinutes: condition.lateMinutes ?? null,
          threshold,
        },
        traceMeta,
      );
      return null;
    }

    if (lateMinutes <= threshold) {
      logTokenMatchTrace(
        "condition_late_minutes_match",
        {
          lateMinutes,
          threshold,
        },
        traceMeta,
      );
      return {
        statusOverride: "PRESENT",
        reason: `lateMinutes ${lateMinutes} <= ${threshold}`,
        lateThreshold: threshold,
      };
    }

    logTokenMatchTrace(
      "condition_late_minutes_exceeded",
      {
        lateMinutes,
        threshold,
      },
      traceMeta,
    );

    return null;
  }

  if (field === "attendance.status") {
    // & Accept comma, plus, slash, and pipe separators for status list config.
    // % Terima pemisah koma, plus, slash, dan pipe untuk konfigurasi daftar status.
    const statuses = value
      .split(/[,+|/;]/)
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean);

    if (!statuses.includes(normalizedStatus)) {
      logTokenMatchTrace(
        "condition_status_not_in_allowed_list",
        {
          normalizedStatus,
          allowedStatuses: statuses,
        },
        traceMeta,
      );
      return null;
    }

    if (normalizedStatus === "LATE") {
      // & Keep legacy compatibility: status-based late token can carry implicit minute cap in itemType/itemName.
      // % Jaga kompatibilitas lama: token telat berbasis status bisa punya batas menit implisit dari itemType/itemName.
      const threshold = resolveLateAllowanceThreshold(item);
      if (threshold != null) {
        const lateMinutes = parseLateMinutes(condition.lateMinutes);
        if (lateMinutes == null || lateMinutes > threshold) {
          logTokenMatchTrace(
            "condition_status_late_threshold_failed",
            {
              lateMinutes: lateMinutes ?? null,
              threshold,
            },
            traceMeta,
          );
          return null;
        }

        logTokenMatchTrace(
          "condition_status_late_threshold_match",
          {
            lateMinutes,
            threshold,
          },
          traceMeta,
        );

        return {
          statusOverride: "PRESENT",
          reason: `attendance.status LATE with legacy limit <= ${threshold}`,
          lateThreshold: threshold,
        };
      }
    }

    if (normalizedStatus === "ABSENT") {
      logTokenMatchTrace(
        "condition_status_absent_match",
        {
          normalizedStatus,
        },
        traceMeta,
      );
      return {
        statusOverride: "LEAVE",
        reason: "attendance.status ABSENT -> LEAVE",
        lateThreshold: null,
      };
    }

    logTokenMatchTrace(
      "condition_status_generic_match",
      {
        normalizedStatus,
      },
      traceMeta,
    );

    return {
      statusOverride: "PRESENT",
      reason: `attendance.status ${normalizedStatus} -> PRESENT`,
      lateThreshold: null,
    };
  }

  logTokenMatchTrace(
    "condition_field_unsupported",
    {
      field,
    },
    traceMeta,
  );
  return null;
}

/**
 * Menjalankan tanggung jawab utama fungsi matchLegacyItemType.
 * @param itemType Parameter yang digunakan dalam proses ini.
 * @param condition Parameter yang digunakan dalam proses ini.
 * @param traceMeta Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function matchLegacyItemType(
  itemType: string | null | undefined,
  condition: AttendanceCondition,
  traceMeta?: TokenMatchTraceMeta,
): TokenMatchResult | null {
  if (!itemType) {
    logTokenMatchTrace(
      "legacy_missing_item_type",
      {
        itemType: null,
      },
      traceMeta,
    );
    return null;
  }

  const lateMinutes = parseLateMinutes(condition.lateMinutes);
  const normalizedStatus = String(condition.status ?? "").toUpperCase();
  const normalizedType = itemType.trim().toLowerCase();

  if (normalizedStatus === "LATE" && lateMinutes == null) {
    logTokenMatchTrace(
      "legacy_missing_late_minutes",
      {
        normalizedStatus,
        providedLateMinutes: condition.lateMinutes ?? null,
      },
      traceMeta,
    );
    return null;
  }

  if (normalizedType === "late_allowance_15m" && normalizedStatus === "LATE" && lateMinutes != null && lateMinutes <= 15) {
    logTokenMatchTrace(
      "legacy_exact_type_match",
      {
        normalizedType,
        lateMinutes,
        threshold: 15,
      },
      traceMeta,
    );
    return { statusOverride: "PRESENT", reason: "legacy late_allowance_15m", lateThreshold: 15 };
  }

  if (normalizedType === "late_allowance_30m" && normalizedStatus === "LATE" && lateMinutes != null && lateMinutes <= 30) {
    logTokenMatchTrace(
      "legacy_exact_type_match",
      {
        normalizedType,
        lateMinutes,
        threshold: 30,
      },
      traceMeta,
    );
    return { statusOverride: "PRESENT", reason: "legacy late_allowance_30m", lateThreshold: 30 };
  }

  if (normalizedType === "late_allowance_60m" && normalizedStatus === "LATE" && lateMinutes != null && lateMinutes <= 60) {
    logTokenMatchTrace(
      "legacy_exact_type_match",
      {
        normalizedType,
        lateMinutes,
        threshold: 60,
      },
      traceMeta,
    );
    return { statusOverride: "PRESENT", reason: "legacy late_allowance_60m", lateThreshold: 60 };
  }

  // & Flexible itemType matching: extract minute threshold from late_allowance_Xm pattern.
  // % Pencocokan itemType fleksibel: ekstrak batas menit dari pola late_allowance_Xm.
  const lateTypeMatch = normalizedType.match(LATE_ALLOWANCE_TYPE_REGEX);
  if (lateTypeMatch?.[1] && normalizedStatus === "LATE") {
    const threshold = parsePositiveInteger(lateTypeMatch[1]);
    if (threshold != null && lateMinutes != null && lateMinutes <= threshold) {
      logTokenMatchTrace(
        "legacy_dynamic_type_match",
        {
          normalizedType,
          lateMinutes,
          threshold,
        },
        traceMeta,
      );
      return { statusOverride: "PRESENT", reason: `legacy ${normalizedType} (dynamic)`, lateThreshold: threshold };
    }
  }

  if (normalizedType === "absence_excuse" && normalizedStatus === "ABSENT") {
    logTokenMatchTrace(
      "legacy_absence_excuse_match",
      {
        normalizedType,
        normalizedStatus,
      },
      traceMeta,
    );
    return { statusOverride: "LEAVE", reason: "legacy absence_excuse", lateThreshold: null };
  }

  if (normalizedType === "wfh_allowance" && normalizedStatus === "ABSENT") {
    logTokenMatchTrace(
      "legacy_wfh_absent_match",
      {
        normalizedType,
        normalizedStatus,
      },
      traceMeta,
    );
    return { statusOverride: "LEAVE", reason: "legacy wfh_allowance absent", lateThreshold: null };
  }

  if (normalizedType === "wfh_allowance" && normalizedStatus === "LATE") {
    logTokenMatchTrace(
      "legacy_wfh_late_match",
      {
        normalizedType,
        normalizedStatus,
      },
      traceMeta,
    );
    return { statusOverride: "PRESENT", reason: "legacy wfh_allowance late", lateThreshold: null };
  }

  // & Generic flexibility_token or unknown types: match LATE status using itemName-based threshold.
  // % Token fleksibilitas generik atau tipe tak dikenal: match status LATE via threshold dari nama item.
  if (normalizedStatus === "LATE" || normalizedStatus === "ABSENT") {
    const threshold = resolveLateAllowanceThreshold({ itemType });
    if (threshold != null && normalizedStatus === "LATE" && lateMinutes != null && lateMinutes <= threshold) {
      logTokenMatchTrace(
        "legacy_resolved_threshold_match",
        {
          normalizedType,
          normalizedStatus,
          lateMinutes,
          threshold,
        },
        traceMeta,
      );
      return { statusOverride: "PRESENT", reason: `${itemType} resolved threshold ${threshold}`, lateThreshold: threshold };
    }
  }

  logTokenMatchTrace(
    "legacy_no_match",
    {
      normalizedType,
      normalizedStatus,
      lateMinutes: lateMinutes ?? null,
    },
    traceMeta,
  );

  return null;
}

/**
 * Menjalankan tanggung jawab utama fungsi matchByItemName.
 * @param itemName Parameter yang digunakan dalam proses ini.
 * @param condition Parameter yang digunakan dalam proses ini.
 * @param traceMeta Parameter yang digunakan dalam proses ini.
 * @returns Nilai hasil dari proses fungsi ini.
 */
export function matchByItemName(
  itemName: string | null | undefined,
  condition: AttendanceCondition,
  traceMeta?: TokenMatchTraceMeta,
): TokenMatchResult | null {
  if (!itemName) {
    logTokenMatchTrace(
      "item_name_missing",
      {
        itemName: null,
      },
      traceMeta,
    );
    return null;
  }

  const normalizedStatus = String(condition.status ?? "").toUpperCase();
  const lateMinutes = parseLateMinutes(condition.lateMinutes);

  if (normalizedStatus === "LATE" && lateMinutes == null) {
    logTokenMatchTrace(
      "item_name_missing_late_minutes",
      {
        itemName,
        normalizedStatus,
        providedLateMinutes: condition.lateMinutes ?? null,
      },
      traceMeta,
    );
    return null;
  }

  const name = itemName.trim().toLowerCase();

  // & Pattern: 'bebas telat N menit' | 'bebas terlambat N menit' | 'telat N menit' | 'terlambat N menit'
  // % Pola: Berbagai variasi nama token keterlambatan dalam bahasa Indonesia.
  const LATE_NAME_PATTERNS = [
    /(?:bebas\s+)?(?:telat|terlambat)\s+(\d+)\s*(?:menit|m)/i,
    /(\d+)\s*(?:menit|m)\s+(?:late|bebas|grace|toleransi)/i,
    /(?:grace|toleransi)\s+(\d+)\s*(?:menit|m)/i,
  ];

  for (const pattern of LATE_NAME_PATTERNS) {
    const match = name.match(pattern);
    if (match?.[1] && normalizedStatus === "LATE") {
      const threshold = parsePositiveInteger(match[1]);
      if (threshold != null && lateMinutes != null && lateMinutes <= threshold) {
        logTokenMatchTrace(
          "item_name_threshold_match",
          {
            itemName,
            lateMinutes,
            threshold,
          },
          traceMeta,
        );
        return {
          statusOverride: "PRESENT",
          reason: `itemName inferred threshold ${threshold} from '${itemName}'`,
          lateThreshold: threshold,
        };
      }

      logTokenMatchTrace(
        "item_name_threshold_failed",
        {
          itemName,
          lateMinutes: lateMinutes ?? null,
          threshold,
        },
        traceMeta,
      );
    }
  }

  // & Pattern: 'bebas absen' | 'bebas alpa' — converts ABSENT to LEAVE
  // % Pola: Token untuk mengkonversi ABSENT ke LEAVE.
  if (normalizedStatus === "ABSENT" && /bebas\s+(?:absen|alpa|alpha)/i.test(name)) {
    logTokenMatchTrace(
      "item_name_absent_match",
      {
        itemName,
        normalizedStatus,
      },
      traceMeta,
    );
    return {
      statusOverride: "LEAVE",
      reason: `itemName inferred ABSENT->LEAVE from '${itemName}'`,
      lateThreshold: null,
    };
  }

  logTokenMatchTrace(
    "item_name_no_match",
    {
      itemName,
      normalizedStatus,
      lateMinutes: lateMinutes ?? null,
    },
    traceMeta,
  );

  return null;
}

// & Build token inventory service for listing and summary operations.
// % Bangun service inventory token untuk operasi listing dan ringkasan.
/** Mengekspor createTokenInventoryService untuk kebutuhan modul ini. */
export const createTokenInventoryService = (repo: PointsRepository, db: any) => ({
  // & Return paginated inventory while reconciling stale AVAILABLE tokens.
  // % Kembalikan inventory terpaginasi sambil sinkronisasi token AVAILABLE yang sudah kedaluwarsa.
  async getUserInventory(
    userId: string,
    options?: { status?: "AVAILABLE" | "USED" | "EXPIRED"; skip?: number; take?: number },
  ) {
    const skip = Number(options?.skip || 0);
    const take = Number(options?.take || 20);

    const [tokens, total] = await Promise.all([
      repo.userTokens.findByUserId(userId, { status: options?.status, skip, take }),
      db.userTokens.count({
        where: {
          userId,
          ...(options?.status ? { status: options.status } : {}),
        },
      }),
    ]);

    const now = new Date();
    const staleAvailableTokenIds = tokens
      .filter(
        (token: any) =>
          token.status === "AVAILABLE" &&
          token.expiresAt &&
          new Date(token.expiresAt).getTime() <= now.getTime(),
      )
      .map((token: any) => token.id);

    if (staleAvailableTokenIds.length) {
      await db.userTokens.updateMany({
        where: {
          id: { in: staleAvailableTokenIds },
        },
        data: {
          status: "EXPIRED",
          remainingDays: 0,
        },
      });
    }

    const normalizedTokens = tokens.map((token: any) => ({
      ...token,
      status:
        token.status === "AVAILABLE" &&
        token.expiresAt &&
        new Date(token.expiresAt).getTime() <= now.getTime()
          ? "EXPIRED"
          : token.status,
      remainingDays:
        token.status === "USED"
          ? Number(token.remainingDays ?? 0)
          : calculateRemainingDays(new Date(token.expiresAt), now),
      usedAtAttendanceId: token.attendance?.id ?? null,
    }));

    const filteredTokens = options?.status
      ? normalizedTokens.filter((token: any) => token.status === options.status)
      : normalizedTokens;

    const adjustedTotal = options?.status === "AVAILABLE"
      ? Math.max(0, total - staleAvailableTokenIds.length)
      : total;

    return {
      data: filteredTokens,
      pagination: {
        total: adjustedTotal,
        skip,
        take,
        pages: Math.ceil(adjustedTotal / Math.max(take, 1)),
      },
    };
  },

  // & Return currently usable tokens only.
  // % Kembalikan token yang masih bisa dipakai saat ini.
  async getAvailableTokens(userId: string) {
    return repo.userTokens.findAvailable(userId);
  },

  // & Get one token detail by token id.
  // % Ambil detail satu token berdasarkan id token.
  async getToken(tokenId: string) {
    return repo.userTokens.findById(tokenId);
  },

  // & Count token totals by status filter.
  // % Hitung total token berdasarkan filter status.
  async countTokensByStatus(userId: string, status?: string) {
    return repo.userTokens.countUserTokens(userId, status);
  },

  // & Build compact summary used by inventory dashboard cards.
  // % Bentuk ringkasan singkat untuk kartu dashboard inventory.
  async getInventorySummary(userId: string) {
    const [available, used, expired] = await Promise.all([
      repo.userTokens.countUserTokens(userId, "AVAILABLE"),
      repo.userTokens.countUserTokens(userId, "USED"),
      repo.userTokens.countUserTokens(userId, "EXPIRED"),
    ]);

    return {
      available,
      used,
      expired,
      total: available + used + expired,
    };
  },
});
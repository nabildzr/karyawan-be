// * Backend module service: src/modules/points/service.ts
// & This file aggregates repository, feature services, and the public points facade.
// % File ini mengagregasi repository, feature service, dan facade points publik.

import { DEFAULT_TIMEZONE, JAKARTA_UTC_OFFSET } from "../../config/timezone";
import type { PrismaClient } from "../../generated/prisma/client";
import { TransactionType } from "../../generated/prisma/enums";
import type { AuditActor } from "../../shared/audit/actor";
import {
  createAnalyticsService,
  createLedgerService,
  createMarketplaceService,
  createRuleEngineService,
  createTokenInterceptorService,
  createTokenInventoryService,
  type AttendanceContext,
} from "./services/token-inventory";
import { PointsRepository } from "./points.repository";

const prisma = PointsRepository.db;

type RuleValueType = "number" | "boolean" | "time" | "string";

type RuleFieldConfig = {
  canonical: string;
  aliases: string[];
  valueType: RuleValueType;
  allowedOps: string[];
};

const toLedgerTransactionType = (amount: number) => {
  if (amount > 0) return TransactionType.EARN;
  if (amount < 0) return TransactionType.PENALTY;
  return TransactionType.ADJUSTMENT;
};

const toSignedPointLabel = (amount: number) =>
  `${amount >= 0 ? "+" : ""}${amount}`;

const normalizeAttendanceStatus = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const parseLateMinutesSafely = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  return Math.floor(parsed);
};

const getBusinessDayStart = (
  date = new Date(),
  timezone = DEFAULT_TIMEZONE,
) => {
  const dayKey = date.toLocaleDateString("sv-SE", { timeZone: timezone });
  return new Date(`${dayKey}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
};

// & Build helper object that encapsulates point-related DB queries.
// % Bentuk helper object yang membungkus query database terkait poin.
const createPointsRepository = (db: PrismaClient) => ({
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

    async findByUserId(
      userId: string,
      options?: { skip?: number; take?: number },
    ) {
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

    async findByUserId(
      userId: string,
      options?: { status?: string; skip?: number; take?: number },
    ) {
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

const RULE_FIELD_CONFIGS: RuleFieldConfig[] = [
  {
    canonical: "attendance.isLate",
    aliases: ["attendance.islate"],
    valueType: "boolean",
    allowedOps: ["==", "!="],
  },
  {
    canonical: "attendance.isAbsent",
    aliases: ["attendance.isabsent"],
    valueType: "boolean",
    allowedOps: ["==", "!="],
  },
  {
    canonical: "attendance.lateMinutes",
    aliases: ["attendance.lateminutes", "late_minutes"],
    valueType: "number",
    allowedOps: ["<", "<=", ">", ">=", "==", "!=", "between"],
  },
  {
    canonical: "attendance.minutesEarly",
    aliases: ["attendance.minutesearly", "attendance.earlyminutes"],
    valueType: "number",
    allowedOps: ["<", "<=", ">", ">=", "==", "!=", "between"],
  },
  {
    canonical: "attendance.monthlyCount",
    aliases: ["attendance.monthlycount"],
    valueType: "number",
    allowedOps: ["<", "<=", ">", ">=", "==", "!=", "between"],
  },
  {
    canonical: "attendance.status",
    aliases: ["attendance_status"],
    valueType: "string",
    allowedOps: ["==", "!=", "in"],
  },
  {
    canonical: "attendance.checkInTime",
    aliases: ["attendance.checkintime", "check_in_time"],
    valueType: "time",
    allowedOps: ["<", "<=", ">", ">=", "==", "!=", "between"],
  },
];

const FIELD_LOOKUP = RULE_FIELD_CONFIGS.reduce(
  (acc, field) => {
    acc[field.canonical.toLowerCase()] = field;
    for (const alias of field.aliases) {
      acc[alias.toLowerCase()] = field;
    }
    return acc;
  },
  {} as Record<string, RuleFieldConfig>,
);

const OPERATOR_LOOKUP: Record<string, string> = {
  "<": "<",
  "<=": "<=",
  ">": ">",
  ">=": ">=",
  "==": "==",
  "!=": "!=",
  eq: "==",
  ne: "!=",
  between: "between",
  in: "in",
};

const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIME_HH_MM_SS_REGEX = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

const normalizeConditionField = (field: string): RuleFieldConfig | null => {
  const normalizedField = field.trim().toLowerCase();
  return FIELD_LOOKUP[normalizedField] ?? null;
};

const normalizeConditionOperator = (op: string): string | null => {
  const normalizedOp = op.trim().toLowerCase();
  return OPERATOR_LOOKUP[normalizedOp] ?? null;
};

const splitRangeValue = (value: string): [string, string] => {
  if (value.includes(",")) {
    const [minRaw = "", maxRaw = ""] = value.split(",");
    return [minRaw.trim(), maxRaw.trim()];
  }

  const [minRaw = "", maxRaw = ""] = value.split("-");
  return [minRaw.trim(), maxRaw.trim()];
};

const parseBooleanValue = (value: string): "true" | "false" | null => {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "ya"].includes(normalized)) return "true";
  if (["false", "0", "no", "tidak"].includes(normalized)) return "false";
  return null;
};

const normalizeTimeValue = (value: string): string | null => {
  const trimmed = value.trim();
  if (TIME_HH_MM_REGEX.test(trimmed)) return trimmed;
  if (TIME_HH_MM_SS_REGEX.test(trimmed)) return trimmed.slice(0, 5);
  return null;
};

const toMinute = (value: string): number | null => {
  const [hh, mm] = value.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const normalizeConditionValue = (
  field: RuleFieldConfig,
  conditionOp: string,
  rawValue: string,
) => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error("Bad Request: conditionValue wajib diisi.");
  }

  if (field.valueType === "boolean") {
    const parsedBoolean = parseBooleanValue(trimmed);
    if (parsedBoolean == null) {
      throw new Error("Bad Request: conditionValue boolean harus true/false.");
    }

    return parsedBoolean;
  }

  if (field.valueType === "number") {
    if (conditionOp === "between") {
      const [minRaw, maxRaw] = splitRangeValue(trimmed);
      const min = Number(minRaw);
      const max = Number(maxRaw);

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error(
          "Bad Request: conditionValue number dengan operator between harus berformat min,max.",
        );
      }

      if (min > max) {
        throw new Error(
          "Bad Request: Rentang conditionValue tidak valid, nilai awal harus <= nilai akhir.",
        );
      }

      return `${min},${max}`;
    }

    const numericValue = Number(trimmed);
    if (!Number.isFinite(numericValue)) {
      throw new Error("Bad Request: conditionValue number harus berupa angka.");
    }

    return `${numericValue}`;
  }

  if (field.valueType === "time") {
    if (conditionOp === "between") {
      const [minRaw, maxRaw] = splitRangeValue(trimmed);
      const min = normalizeTimeValue(minRaw);
      const max = normalizeTimeValue(maxRaw);

      if (!min || !max) {
        throw new Error(
          "Bad Request: conditionValue time dengan operator between harus berformat HH:mm,HH:mm.",
        );
      }

      const minMinute = toMinute(min);
      const maxMinute = toMinute(max);
      if (minMinute == null || maxMinute == null || minMinute > maxMinute) {
        throw new Error(
          "Bad Request: Rentang time tidak valid, nilai awal harus <= nilai akhir.",
        );
      }

      return `${min},${max}`;
    }

    const normalizedTime = normalizeTimeValue(trimmed);
    if (!normalizedTime) {
      throw new Error("Bad Request: conditionValue time harus berformat HH:mm.");
    }

    return normalizedTime;
  }

  if (conditionOp === "in") {
    const values = trimmed
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);

    if (!values.length) {
      throw new Error(
        "Bad Request: conditionValue operator in harus memiliki minimal 1 nilai.",
      );
    }

    return values.join(",");
  }

  return trimmed.toUpperCase();
};

const validateAndNormalizeRulePayload = (payload: any) => {
  const ruleName = String(payload.ruleName ?? "").trim();
  if (!ruleName) {
    throw new Error("Bad Request: ruleName wajib diisi.");
  }

  const targetRole = String(payload.targetRole ?? "*").trim().toUpperCase() || "*";

  const fieldConfig = normalizeConditionField(String(payload.conditionField ?? ""));
  if (!fieldConfig) {
    throw new Error(
      `Bad Request: conditionField tidak valid. Gunakan salah satu: ${RULE_FIELD_CONFIGS.map((field) => field.canonical).join(", ")}.`,
    );
  }

  const normalizedOperator = normalizeConditionOperator(
    String(payload.conditionOp ?? ""),
  );
  if (!normalizedOperator) {
    throw new Error("Bad Request: conditionOp tidak valid.");
  }

  if (!fieldConfig.allowedOps.includes(normalizedOperator)) {
    throw new Error(
      `Bad Request: Operator ${normalizedOperator} tidak valid untuk field ${fieldConfig.canonical}.`,
    );
  }

  const conditionValue = normalizeConditionValue(
    fieldConfig,
    normalizedOperator,
    String(payload.conditionValue ?? ""),
  );

  const pointModifier = Number(payload.pointModifier);
  if (!Number.isFinite(pointModifier) || !Number.isInteger(pointModifier)) {
    throw new Error("Bad Request: pointModifier harus berupa integer.");
  }

  const descriptionRaw = payload.description;
  const description =
    descriptionRaw == null || String(descriptionRaw).trim() === ""
      ? null
      : String(descriptionRaw).trim();

  return {
    ruleName,
    targetRole,
    conditionField: fieldConfig.canonical,
    conditionOp: normalizedOperator,
    conditionValue,
    pointModifier,
    description,
    isActive: payload.isActive == null ? true : Boolean(payload.isActive),
  };
};

// & Compose all points sub-services using one shared repository instance.
// % Susun semua sub-service points memakai satu instance repository bersama.
/** Mengekspor createPointsServices untuk kebutuhan modul ini. */
export const createPointsServices = (db: any) => {
  const repository = createPointsRepository(db);

  return {
    repository,
    ruleEngine: createRuleEngineService(repository),
    ledger: createLedgerService(repository, db),
    tokenInterceptor: createTokenInterceptorService(repository, db),
    marketplace: createMarketplaceService(repository, db),
    tokenInventory: createTokenInventoryService(repository, db),
    analytics: createAnalyticsService(repository, db),
  };
};

/** Mengekspor createPointsService untuk kebutuhan modul ini. */
export const createPointsService = (db: any) => {
  const services = createPointsServices(db);

  return {
    rules: {
      create: (data: any) => {
        const normalized = validateAndNormalizeRulePayload(data);
        return services.repository.rules.create(normalized);
      },
      list: async (skip: number = 0, take: number = 20, where?: any) => {
        const [rules, total] = await Promise.all([
          services.repository.rules.findAll({ skip, take, where }),
          services.repository.rules.count(where),
        ]);

        return {
          data: rules,
          pagination: {
            total,
            skip,
            take,
            pages: Math.ceil(total / Math.max(take, 1)),
          },
        };
      },
      get: (id: string) => services.repository.rules.findById(id),
      update: async (id: string, data: any) => {
        const currentRule = await services.repository.rules.findById(id);
        if (!currentRule) {
          throw new Error("Not Found: Rule poin tidak ditemukan.");
        }

        const merged = {
          ...currentRule,
          ...data,
        };

        const normalizedMerged = validateAndNormalizeRulePayload(merged);
        const patch: Record<string, unknown> = {};
        const updatableFields = [
          "ruleName",
          "targetRole",
          "conditionField",
          "conditionOp",
          "conditionValue",
          "pointModifier",
          "description",
          "isActive",
        ] as const;

        for (const field of updatableFields) {
          if (Object.prototype.hasOwnProperty.call(data, field)) {
            patch[field] = normalizedMerged[field];
          }
        }

        return services.repository.rules.update(id, patch);
      },
      delete: (id: string) => services.repository.rules.delete(id),
    },

    calculatePoints: (userId: string, role: string, context: any) =>
      services.ruleEngine.evaluatePointsFromAttendance(userId, role, context),

    // % Evaluasi aturan poin berdasarkan konteks absensi, dengan dukungan override token untuk kasus keterlambatan dan ketidakhadiran.
    applyAttendanceRules: async (params: {
      userId: string;
      role: string;
      attendanceId: string;
      context: AttendanceContext;
      source:
        | "CHECK_IN"
        | "CHECK_OUT"
        | "MANUAL_ATTENDANCE"
        | "CRON_ABSENT";
      actor?: AuditActor;
      dbClient?: any;
    }) => {
      const {
        userId,
        role,
        attendanceId,
        context: incomingContext,
        source,
        actor,
        dbClient,
      } = params;

      const context: AttendanceContext = {
        ...incomingContext,
      };
      const dbRuntime = dbClient ?? db;

      let tokenUsed: any = null;
      const sourceStatus =
        source === "CHECK_OUT"
          ? context.statusCheckOut ?? context.attendanceStatus
          : context.attendanceStatus ?? context.statusCheckOut;

      const normalizedStatus = normalizeAttendanceStatus(sourceStatus);
      const lateMinutesCandidate = parseLateMinutesSafely(context.lateMinutes);
      let tokenGateStatus = normalizedStatus;

      if (!tokenGateStatus || tokenGateStatus === "PENDING") {
        if (context.isAbsent === true) {
          tokenGateStatus = "ABSENT";
        } else if (
          context.isLate === true ||
          (lateMinutesCandidate != null && lateMinutesCandidate > 0)
        ) {
          tokenGateStatus = "LATE";
        }
      }

      let attendanceSnapshotStatus: string | null = null;
      const requiresAttendanceFallbackStatus =
        ["CHECK_IN", "CRON_ABSENT"].includes(source) &&
        Boolean(attendanceId) &&
        !["LATE", "ABSENT"].includes(tokenGateStatus);

      if (requiresAttendanceFallbackStatus) {
        const attendanceSnapshot = await dbRuntime.attendances.findUnique({
          where: { id: attendanceId },
          select: {
            status: true,
            statusCheckOut: true,
          },
        });

        const snapshotStatusSource =
          source === "CHECK_OUT"
            ? attendanceSnapshot?.statusCheckOut ?? attendanceSnapshot?.status
            : attendanceSnapshot?.status ?? attendanceSnapshot?.statusCheckOut;

        attendanceSnapshotStatus = normalizeAttendanceStatus(snapshotStatusSource);
        if (["LATE", "ABSENT"].includes(attendanceSnapshotStatus)) {
          tokenGateStatus = attendanceSnapshotStatus;
        }
      }

      const canUseToken =
        ["CHECK_IN", "CRON_ABSENT"].includes(source) &&
        Boolean(attendanceId) &&
        ["LATE", "ABSENT"].includes(tokenGateStatus);

      const tokenGateReasons = [
        !["CHECK_IN", "CRON_ABSENT"].includes(source)
          ? `source_not_supported:${source}`
          : null,
        !attendanceId ? "attendance_id_missing" : null,
        !["LATE", "ABSENT"].includes(tokenGateStatus)
          ? `status_not_eligible:${tokenGateStatus || "EMPTY"}`
          : null,
      ].filter(Boolean);

      console.log("[POINTS] applyAttendanceRules token gate:", {
        source,
        attendanceId,
        sourceStatus: sourceStatus ?? null,
        normalizedStatus,
        tokenGateStatus,
        attendanceSnapshotStatus,
        contextLateMinutes: context.lateMinutes ?? null,
        normalizedLateMinutes: lateMinutesCandidate,
        contextIsLate: context.isLate ?? null,
        contextIsAbsent: context.isAbsent ?? null,
        canUseToken,
        tokenGateReasons,
      });

      if (canUseToken) {
        const tokenSource = source === "CRON_ABSENT" ? "CRON_ABSENT" : "CHECK_IN";

        const tokenResult = await services.tokenInterceptor.checkAndApplyToken(
          userId,
          attendanceId,
          {
            status: tokenGateStatus,
            lateMinutes: lateMinutesCandidate,
            source: tokenSource,
          },
          actor,
          dbClient,
        );

        console.log("[POINTS] Token interceptor output:", {
          attendanceId,
          statusOverride: tokenResult?.statusOverride ?? null,
          tokenUsedId: tokenResult?.tokenUsed?.id ?? null,
          lateThreshold: tokenResult?.lateThreshold ?? null,
        });

        if (tokenResult?.statusOverride) {
          const overriddenStatus = String(tokenResult.statusOverride).toUpperCase();

          context.attendanceStatus = overriddenStatus;

          context.isLate = overriddenStatus === "LATE";
          context.isAbsent = overriddenStatus === "ABSENT";

          if (overriddenStatus !== "LATE") {
            context.lateMinutes = 0;
          }

          tokenUsed = tokenResult.tokenUsed ?? null;
          if (tokenUsed) {
            tokenUsed._lateThreshold = tokenResult.lateThreshold ?? null;
          }
        } else {
          console.log("[POINTS] Token interceptor returned no override:", {
            attendanceId,
            tokenUsedId: tokenResult?.tokenUsed?.id ?? null,
            statusOverride: tokenResult?.statusOverride ?? null,
          });
        }
      } else {
        console.log("[POINTS] Token skipped by gate before interceptor call:", {
          source,
          attendanceId,
          tokenGateStatus,
          tokenGateReasons,
        });
      }

      if (tokenUsed) {
        const tokenOverrideReferenceEntity = "ATTENDANCE_TOKEN_OVERRIDE";
        const tokenOverrideReferenceId = `${attendanceId}:${tokenUsed.id ?? "UNKNOWN_TOKEN"}`;

        try {
          const existingTokenOverrideLog = await services.repository.ledgers.findByReference(
            userId,
            tokenOverrideReferenceEntity,
            tokenOverrideReferenceId,
          );

          if (!existingTokenOverrideLog) {
            await services.ledger.recordLedgerEntry(
              {
                userId,
                transactionType: TransactionType.ADJUSTMENT,
                amount: 0,
                description: `[${source}] Token telah digunakan untuk absensi  (token ${tokenUsed.name ?? "UNKNOWN_TOKEN"})`,
                referenceEntity: tokenOverrideReferenceEntity,
                referenceId: tokenOverrideReferenceId,
                actor,
              },
              dbClient,
            );

            console.log("[POINTS] Token override ledger mutation created:", {
              attendanceId,
              tokenId: tokenUsed.id ?? null,
              referenceEntity: tokenOverrideReferenceEntity,
              referenceId: tokenOverrideReferenceId,
            });
          } else {
            console.log("[POINTS] Token override ledger mutation already exists:", {
              attendanceId,
              tokenId: tokenUsed.id ?? null,
              referenceEntity: tokenOverrideReferenceEntity,
              referenceId: tokenOverrideReferenceId,
            });
          }
        } catch (error) {
          console.warn("[POINTS] Failed to create token override ledger mutation:", {
            attendanceId,
            tokenId: tokenUsed.id ?? null,
            error,
          });
        }

        // & When token override is applied, suppress all attendance rules entirely.
        // % Saat override token diterapkan, seluruh rule absensi dimatikan (tidak ada poin +/-) kecuali rule umum.
        console.log("[POINTS] Token override active -> skipping all attendance rules.");
        return {
          totalPointModifier: 0,
          appliedRules: [] as string[],
          skippedRules: ["SYSTEM_TOKEN_OVERRIDE"],
          tokenUsed,
        };
      }

      const evaluation = await services.ruleEngine.evaluatePointsFromAttendance(
        userId,
        role,
        context,
      );

      if (!evaluation.matchedRules.length) {
        return {
          totalPointModifier: 0,
          appliedRules: [] as string[],
          skippedRules: [] as string[],
          tokenUsed,
        };
      }

      const appliedRules: string[] = [];
      const skippedRules: string[] = [];
      let totalPointModifier = 0;

      // & Determine if token was used for late allowance and what the original status was.
      // % Periksa apakah token dipakai untuk keterlambatan dan apa status aslinya.
      const originalStatus = tokenGateStatus || normalizedStatus; // status sebelum token override

      for (const rule of evaluation.matchedRules) {
        const ruleField = String(rule.conditionField || "").toLowerCase();

        // & Block minutesEarly rules if original attendance status was LATE (user was late, not early).
        // % Blokir rule minutesEarly jika status asli LATE (karyawan terlambat, bukan datang awal).
        if (
          (ruleField === "attendance.minutesearly" || ruleField === "attendance.earlyminutes") &&
          originalStatus === "LATE"
        ) {
          skippedRules.push(`${rule.ruleName} (blokir: status asli LATE)`);
          continue;
        }

        const amount = Number(rule.pointModifier || 0);

        const referenceEntity = "ATTENDANCE_RULE";
        const referenceId = `${attendanceId}:${rule.id}`;

        const existing = await services.repository.ledgers.findByReference(
          userId,
          referenceEntity,
          referenceId,
        );

        if (existing) {
          skippedRules.push(rule.ruleName);
          continue;
        }

        if (amount === 0) {
          skippedRules.push(rule.ruleName);
          continue;
        }

        await services.ledger.recordLedgerEntry(
          {
            userId,
            transactionType: toLedgerTransactionType(amount),
            amount,
            description: `[${source}] Rule ${rule.ruleName} (${toSignedPointLabel(amount)})`,
            referenceEntity,
            referenceId,
            actor,
          },
          dbClient,
        );

        appliedRules.push(rule.ruleName);
        totalPointModifier += amount;
      }

      return { totalPointModifier, appliedRules, skippedRules, tokenUsed };
    },

    applyMonthlyCountRules: async (params: {
      userId: string;
      role: string;
      monthlyCount: number;
      monthKey: string;
      actor?: AuditActor;
      dbClient?: any;
    }) => {
      const { userId, role, monthlyCount, monthKey, actor, dbClient } = params;

      const evaluation = await services.ruleEngine.evaluatePointsFromAttendance(
        userId,
        role,
        { monthlyCount },
      );

      if (!evaluation.matchedRules.length) {
        return {
          totalPointModifier: 0,
          appliedRules: [] as string[],
          skippedRules: [] as string[],
        };
      }

      const appliedRules: string[] = [];
      const skippedRules: string[] = [];
      let totalPointModifier = 0;

      for (const rule of evaluation.matchedRules) {
        const referenceEntity = "MONTHLY_ATTENDANCE_RULE";
        const referenceId = `${monthKey}:${rule.id}`;

        const existing = await services.repository.ledgers.findByReference(
          userId,
          referenceEntity,
          referenceId,
        );

        if (existing) {
          skippedRules.push(rule.ruleName);
          continue;
        }

        const amount = Number(rule.pointModifier || 0);
        if (amount === 0) {
          skippedRules.push(rule.ruleName);
          continue;
        }

        await services.ledger.recordLedgerEntry(
          {
            userId,
            transactionType: toLedgerTransactionType(amount),
            amount,
            description: `[CRON_MONTHLY] Rule ${rule.ruleName} (${toSignedPointLabel(amount)}) bulan ${monthKey} (jumlah hadir: ${monthlyCount})`,
            referenceEntity,
            referenceId,
            actor,
          },
          dbClient,
        );

        appliedRules.push(rule.ruleName);
        totalPointModifier += amount;
      }

      return { totalPointModifier, appliedRules, skippedRules };
    },

    ledger: {
      create: (params: any, dbClient?: any) =>
        services.ledger.recordLedgerEntry(params, dbClient),
      recordLedgerEntry: (params: any, dbClient?: any) =>
        services.ledger.recordLedgerEntry(params, dbClient),
      getBalance: (userId: string) => services.ledger.getUserWallet(userId),
      history: (userId: string, skip?: number, take?: number) =>
        services.ledger.getUserLedgerHistory(userId, skip, take),
      adminHistory: (params?: any) => services.ledger.getSystemLedgerHistory(params),
    },

    marketplace: {
      items: {
        create: (data: any) => services.marketplace.createItem(data),
        list: (
          skip?: number,
          take?: number,
          options?: { includeExpired?: boolean; userId?: string },
        ) => services.marketplace.getItems(skip, take, options),
        get: (id: string) => services.marketplace.getItem(id),
        update: (id: string, data: any) => services.marketplace.updateItem(id, data),
        delete: (id: string) => services.marketplace.deleteItem(id),
      },
      buyToken: (userId: string, itemId: string, actor: any, ledger: any) =>
        services.marketplace.buyToken(userId, itemId, actor, ledger),
    },

    tokens: {
      apply: (
        userId: string,
        attendanceId: string,
        condition: any,
        actor?: AuditActor,
        dbClient?: any,
      ) =>
        services.tokenInterceptor.checkAndApplyToken(
          userId,
          attendanceId,
          condition,
          actor,
          dbClient,
        ),
      findUsable: (userId: string, condition: any) =>
        services.tokenInterceptor.findBestMatchingToken(userId, condition),
      inventory: (userId: string, options?: any) =>
        services.tokenInventory.getUserInventory(userId, options),
      available: (userId: string) => services.tokenInventory.getAvailableTokens(userId),
      getSummary: (userId: string) => services.tokenInventory.getInventorySummary(userId),
    },

    analytics: {
      leaderboard: (options?: any) => services.analytics.getLeaderboard(options),
      employeeLeaderboard: (options?: any) =>
        services.analytics.getEmployeeLeaderboard(options),
      userStats: (userId: string) => services.analytics.getUserStats(userId),
      systemStats: () => services.analytics.getSystemStats(),
    },
  };
};

/** Mengekspor PointsService untuk kebutuhan modul ini. */
export const PointsService = createPointsService(prisma);

// * Points cron plugin: src/app/jobs/pointsJobs.ts
// & Daily background jobs for point wallet maintenance.
// % Job latar belakang harian untuk pemeliharaan dompet poin.

import { cron } from "@elysiajs/cron";
import { Elysia } from "elysia";
import prisma from "../../config/prisma";
import { PointsService } from "../../modules/points/service";
import { writeAuditLog } from "../../shared/audit/writeAudit";

const SYSTEM_ACTOR = {
  id: "SYSTEM",
  role: "SYSTEM",
};

const DEFAULT_TIMEZONE = "Asia/Jakarta";
const JAKARTA_UTC_OFFSET = "+07:00";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RETRYABLE_DB_ERROR_MARKERS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "P1001",
  "P1002",
  "CLIENT NETWORK SOCKET DISCONNECTED BEFORE SECURE TLS CONNECTION WAS ESTABLISHED",
  "CONNECTION TERMINATED",
  "CONNECTION CLOSED",
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const stringifyError = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "Unknown error");

const isRetryableDatabaseError = (error: unknown) => {
  const message = stringifyError(error).toUpperCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "").toUpperCase()
      : "";

  return RETRYABLE_DB_ERROR_MARKERS.some(
    (marker) => code.includes(marker) || message.includes(marker),
  );
};

const withPrismaReconnectRetry = async <T>(
  operationName: string,
  task: () => Promise<T>,
  options?: { maxAttempts?: number; initialDelayMs?: number },
): Promise<T> => {
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const initialDelayMs = Math.max(100, options?.initialDelayMs ?? 500);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$connect();
      return await task();
    } catch (error) {
      lastError = error;

      if (!isRetryableDatabaseError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const waitMs = initialDelayMs * attempt;
      console.warn(
        `[POINTS CRON] ${operationName} attempt ${attempt}/${maxAttempts} failed with transient DB error. Retrying in ${waitMs}ms...`,
      );

      try {
        await prisma.$disconnect();
      } catch {
        // Ignore disconnect errors; connect retry will still run.
      }

      await delay(waitMs);
    }
  }

  throw new Error(
    `[POINTS CRON] ${operationName} failed after retry: ${stringifyError(lastError)}`,
  );
};

const calculateRemainingDays = (expiresAt: Date, now = new Date()) => {
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
};

const reconcileTokenExpiryState = async (trigger: "STARTUP" | "DAILY_CRON") => {
  const now = new Date();
  const tokens = await withPrismaReconnectRetry(
    "reconcileTokenExpiryState.findMany",
    () =>
      prisma.userTokens.findMany({
        where: {
          status: {
            in: ["AVAILABLE", "EXPIRED"],
          },
        },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          remainingDays: true,
        },
      }),
  );

  let statusChanged = 0;
  let remainingDaysSynced = 0;

  for (const token of tokens) {
    const nextRemainingDays = calculateRemainingDays(token.expiresAt, now);
    const nextStatus = nextRemainingDays > 0 ? "AVAILABLE" : "EXPIRED";

    const shouldUpdateStatus = token.status !== nextStatus;
    const shouldUpdateRemainingDays = Number(token.remainingDays ?? 0) !== nextRemainingDays;

    if (!shouldUpdateStatus && !shouldUpdateRemainingDays) {
      continue;
    }

    await withPrismaReconnectRetry("reconcileTokenExpiryState.update", () =>
      prisma.userTokens.update({
        where: { id: token.id },
        data: {
          status: nextStatus,
          remainingDays: nextRemainingDays,
        },
      }),
    );

    if (shouldUpdateStatus) statusChanged += 1;
    if (shouldUpdateRemainingDays) remainingDaysSynced += 1;
  }

  if (statusChanged <= 0 && remainingDaysSynced <= 0) {
    return;
  }

  try {
    await withPrismaReconnectRetry(
      "reconcileTokenExpiryState.writeAuditLog",
      () =>
        writeAuditLog({
          actor: SYSTEM_ACTOR,
          action: "SYNC_TOKEN_EXPIRY_STATE",
          entity: "UserTokens",
          entityId: "BATCH",
          changes: {
            trigger,
            statusChanged,
            remainingDaysSynced,
            timestamp: now.toISOString(),
          },
          reason: "Sync token status and remaining days from expiresAt",
        }),
      { maxAttempts: 2 },
    );
  } catch (error) {
    console.error("[POINTS CRON] Failed to write token reconcile audit log:", error);
  }
};

const getPreviousMonthWindow = () => {
  const jakartaDateKey = new Date().toLocaleDateString("sv-SE", {
    timeZone: DEFAULT_TIMEZONE,
  });
  const [yearRaw, monthRaw] = jakartaDateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth <= 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const monthKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  const nextBoundary = `${year}-${String(month).padStart(2, "0")}-01`;

  return {
    monthKey,
    monthStart: new Date(`${monthKey}-01T00:00:00.000${JAKARTA_UTC_OFFSET}`),
    monthEndExclusive: new Date(
      `${nextBoundary}T00:00:00.000${JAKARTA_UTC_OFFSET}`,
    ),
  };
};

export const pointsCronPlugin = new Elysia()
  .onStart(async () => {
    try {
      await reconcileTokenExpiryState("STARTUP");
    } catch (error) {
      console.error("[POINTS CRON] Failed to reconcile tokens on startup:", error);
    }
  })
  .use(
    cron({
      name: "points-expire-token",
      // & Run every day 02:00 Jakarta time.
      // % Jalan setiap hari jam 02:00 waktu Jakarta.
      pattern: "0 0 2 * * *",
      async run() {
        try {
          await reconcileTokenExpiryState("DAILY_CRON");
        } catch (error) {
          console.error("[POINTS CRON] Failed to reconcile token expiry state:", error);
        }
      },
    }),
  )
  .use(
    cron({
      name: "points-monthly-attendance-count",
      // & Run on day-1 each month at 00:15 and calculate previous month attendance count.
      // % Jalan tiap tanggal 1 jam 00:15 untuk hitung jumlah kehadiran bulan sebelumnya.
      pattern: "0 58 11 * * *",
      async run() {
        try {
          const { monthKey, monthStart, monthEndExclusive } =
            getPreviousMonthWindow();

          const employees = await withPrismaReconnectRetry(
            "monthlyAttendance.findEmployees",
            () =>
              prisma.employees.findMany({
                include: {
                  user: {
                    include: {
                      rbacRole: {
                        select: { key: true },
                      },
                    },
                  },
                },
              }),
          );

          let processedUsers = 0;
          let totalAppliedPoints = 0;

          for (const employee of employees) {
            if (!employee.userId) continue;

            const monthlyCount = await withPrismaReconnectRetry(
              "monthlyAttendance.countAttendances",
              () =>
                prisma.attendances.count({
                  where: {
                    employeeId: employee.id,
                    createdAt: {
                      gte: monthStart,
                      lt: monthEndExclusive,
                    },
                    status: {
                      in: ["PRESENT", "LATE"],
                    },
                  },
                }),
            );

            const role = employee.user?.rbacRole?.key || "USER";
            const result = await withPrismaReconnectRetry(
              "monthlyAttendance.applyMonthlyCountRules",
              () =>
                PointsService.applyMonthlyCountRules({
                  userId: employee.userId,
                  role,
                  monthlyCount,
                  monthKey,
                  actor: SYSTEM_ACTOR,
                }),
            ) as {
              totalPointModifier: number;
            };

            totalAppliedPoints += result.totalPointModifier;
            processedUsers += 1;
          }

          try {
            await withPrismaReconnectRetry(
              "monthlyAttendance.writeAuditLog",
              () =>
                writeAuditLog({
                  actor: SYSTEM_ACTOR,
                  action: "AUTO_APPLY_MONTHLY_ATTENDANCE_POINTS",
                  entity: "PointLedger",
                  entityId: monthKey,
                  changes: {
                    monthKey,
                    processedUsers,
                    totalAppliedPoints,
                    timestamp: new Date().toISOString(),
                  },
                  reason: "Monthly attendance count points job",
                }),
              { maxAttempts: 2 },
            );
          } catch (error) {
            console.error(
              "[POINTS CRON] Failed to write monthly attendance audit log:",
              error,
            );
          }
        } catch (error) {
          console.error(
            "[POINTS CRON] Failed to apply monthly attendance points:",
            error,
          );
        }
      },
    }),
  );

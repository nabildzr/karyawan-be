// * Point wallet models and DTOs: karyawan-be/src/modules/points/model.ts
// & Type contracts for point rules, ledgers, marketplace items, and user tokens.
// % Kontrak tipe untuk aturan poin, buku besar, item marketplace, dan token pengguna.

import { t } from "elysia";
import { TransactionType } from "../../generated/prisma/enums";

// ========================
// Query Models
// ========================

/** Mengekspor PaginationQueryModel untuk kebutuhan modul ini. */
export const PaginationQueryModel = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  skip: t.Optional(t.Number({ minimum: 0 })),
});

/** Mengekspor PointRulesQueryModel untuk kebutuhan modul ini. */
export const PointRulesQueryModel = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  targetRole: t.Optional(t.String()),
});

/** Mengekspor InventoryQueryModel untuk kebutuhan modul ini. */
export const InventoryQueryModel = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  status: t.Optional(t.Union([t.Literal("AVAILABLE"), t.Literal("USED"), t.Literal("EXPIRED") ])),
});

/** Mengekspor AdminLedgerQueryModel untuk kebutuhan modul ini. */
export const AdminLedgerQueryModel = t.Object({
  page: t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
  transactionType: t.Optional(t.Enum(TransactionType)),
  userId: t.Optional(t.String()),
  referenceEntity: t.Optional(t.String()),
  startDate: t.Optional(t.String()),
  endDate: t.Optional(t.String()),
  search: t.Optional(t.String()),
});

// ========================
// Point Rules Models
// ========================

/** Mengekspor PointRuleModel untuk kebutuhan modul ini. */
export const PointRuleModel = t.Object({
  id: t.String(),
  ruleName: t.String(),
  targetRole: t.String(),
  conditionField: t.String(),
  conditionOp: t.String(),
  conditionValue: t.String(),
  pointModifier: t.Number(),
  description: t.Optional(t.String()),
  isActive: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mengekspor CreatePointRulePayload untuk kebutuhan modul ini. */
export const CreatePointRulePayload = t.Object({
  ruleName: t.String(),
  targetRole: t.String(),
  conditionField: t.String(),
  conditionOp: t.String(),
  conditionValue: t.String(),
  pointModifier: t.Number(),
  description: t.Optional(t.String()),
});

/** Mengekspor UpdatePointRulePayload untuk kebutuhan modul ini. */
export const UpdatePointRulePayload = t.Partial(CreatePointRulePayload);

/** Mengekspor UpdatePointRulePatchPayload untuk kebutuhan modul ini. */
export const UpdatePointRulePatchPayload = t.Partial(
  t.Object({
    ruleName: t.String(),
    targetRole: t.String(),
    conditionField: t.String(),
    conditionOp: t.String(),
    conditionValue: t.String(),
    pointModifier: t.Number(),
    description: t.Optional(t.String()),
    isActive: t.Boolean(),
  }),
);

// ========================
// Point Ledgers Models
// ========================

/** Mengekspor PointLedgerModel untuk kebutuhan modul ini. */
export const PointLedgerModel = t.Object({
  id: t.String(),
  userId: t.String(),
  transactionType: t.Enum(TransactionType),
  amount: t.Number(),
  balanceBefore: t.Number(),
  balanceAfter: t.Number(),
  currentBalance: t.Number(),
  description: t.Optional(t.String()),
  referenceEntity: t.Optional(t.String()),
  referenceId: t.Optional(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mengekspor CreateLedgerEntryPayload untuk kebutuhan modul ini. */
export const CreateLedgerEntryPayload = t.Object({
  userId: t.String(),
  transactionType: t.Enum(TransactionType),
  amount: t.Number(),
  description: t.Optional(t.String()),
  referenceEntity: t.Optional(t.String()),
  referenceId: t.Optional(t.String()),
});

// ========================
// Flexibility Items Models
// ========================

/** Mengekspor FlexibilityItemModel untuk kebutuhan modul ini. */
export const FlexibilityItemModel = t.Object({
  id: t.String(),
  itemName: t.String(),
  pointCost: t.Number(),
  itemType: t.String(),
  durationDays: t.Number(),
  maxPerMonth: t.Nullable(t.Number()),
  conditionField: t.Nullable(
    t.Union([
      t.Literal("attendance.status"),
      t.Literal("attendance.lateMinutes"),
    ]),
  ),
  conditionValue: t.Nullable(t.String()),
  expiredAt: t.Nullable(t.String()),
  description: t.Optional(t.String()),
  iconUrl: t.Optional(t.String()),
  isActive: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mengekspor CreateFlexibilityItemPayload untuk kebutuhan modul ini. */
export const CreateFlexibilityItemPayload = t.Object({
  itemName: t.String(),
  pointCost: t.Number(),
  itemType: t.String(),
  durationDays: t.Number(),
  maxPerMonth: t.Optional(t.Nullable(t.Number())),
  conditionField: t.Optional(
    t.Nullable(
      t.Union([
        t.Literal("attendance.status"),
        t.Literal("attendance.lateMinutes"),
      ]),
    ),
  ),
  conditionValue: t.Optional(t.Nullable(t.String())),
  expiredAt: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.String()),
  iconUrl: t.Optional(t.String()),
  isActive: t.Optional(t.Boolean()),
});

/** Mengekspor UpdateFlexibilityItemPayload untuk kebutuhan modul ini. */
export const UpdateFlexibilityItemPayload = t.Partial(
  t.Object({
    itemName: t.String(),
    pointCost: t.Number(),
    itemType: t.String(),
    durationDays: t.Number(),
    maxPerMonth: t.Nullable(t.Number()),
    conditionField: t.Nullable(
      t.Union([
        t.Literal("attendance.status"),
        t.Literal("attendance.lateMinutes"),
      ]),
    ),
    conditionValue: t.Nullable(t.String()),
    expiredAt: t.Nullable(t.String()),
    description: t.Optional(t.String()),
    iconUrl: t.Optional(t.String()),
    isActive: t.Boolean(),
  }),
);

// ========================
// User Tokens Models
// ========================

/** Mengekspor UserTokenModel untuk kebutuhan modul ini. */
export const UserTokenModel = t.Object({
  id: t.String(),
  userId: t.String(),
  itemId: t.String(),
  status: t.Union([t.Literal("AVAILABLE"), t.Literal("USED"), t.Literal("EXPIRED")]),
  usedAt: t.Optional(t.String()),
  usedAtAttendanceId: t.Nullable(t.String()),
  expiresAt: t.String(),
  remainingDays: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mengekspor UserTokenWithItemModel untuk kebutuhan modul ini. */
export const UserTokenWithItemModel = t.Object({
  id: t.String(),
  userId: t.String(),
  itemId: t.String(),
  item: FlexibilityItemModel,
  status: t.Union([t.Literal("AVAILABLE"), t.Literal("USED"), t.Literal("EXPIRED")]),
  usedAt: t.Optional(t.String()),
  usedAtAttendanceId: t.Nullable(t.String()),
  expiresAt: t.String(),
  remainingDays: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/** Mengekspor BuyTokenPayload untuk kebutuhan modul ini. */
export const BuyTokenPayload = t.Object({
  itemId: t.String(),
});

// ========================
// User Wallet Models
// ========================

/** Mengekspor UserWalletModel untuk kebutuhan modul ini. */
export const UserWalletModel = t.Object({
  userId: t.String(),
  balance: t.Number(),
  totalEarned: t.Number(),
  totalSpent: t.Number(),
  level: t.String(),
  rank: t.Number(),
  currentPoints: t.Number(),
  integrityLevel: t.String(),
  nextLevel: t.String(),
  nextLevelThreshold: t.Number(),
  percentageToNextLevel: t.Number(),
});

/** Mengekspor PointEvaluationResult untuk kebutuhan modul ini. */
export const PointEvaluationResult = t.Object({
  pointModifier: t.Number(),
  rulesApplied: t.Array(t.String()),
});

/** Mengekspor TokenApplicationResult untuk kebutuhan modul ini. */
export const TokenApplicationResult = t.Object({
  tokenUsed: t.Optional(UserTokenModel),
  statusOverride: t.Optional(t.String()),
});

// ========================
// Leaderboard Models
// ========================

/** Mengekspor LeaderboardUserModel untuk kebutuhan modul ini. */
export const LeaderboardUserModel = t.Object({
  rank: t.Number(),
  userId: t.String(),
  name: t.String(),
  userName: t.String(),
  employeeId: t.Optional(t.String()),
  role: t.Optional(t.String()),
  balance: t.Number(),
  currentPoints: t.Number(),
  level: t.String(),
  integrityLevel: t.String(),
  totalEarned: t.Optional(t.Number()),
});

/** Mengekspor LeaderboardResponseModel untuk kebutuhan modul ini. */
export const LeaderboardResponseModel = t.Array(LeaderboardUserModel);

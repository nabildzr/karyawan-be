ALTER TABLE "FlexibilityItems"
ADD COLUMN IF NOT EXISTS "conditionField" TEXT,
ADD COLUMN IF NOT EXISTS "conditionValue" TEXT,
ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);

ALTER TABLE "UserTokens"
ADD COLUMN IF NOT EXISTS "remainingDays" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "FlexibilityItems_isActive_expiredAt_idx"
ON "FlexibilityItems"("isActive", "expiredAt");

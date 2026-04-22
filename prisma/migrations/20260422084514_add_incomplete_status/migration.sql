/*
  Warnings:

  - The values [GANTI_SHIFT_HARI] on the enum `SubmissionType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `type` on the `AssessmentCategories` table. All the data in the column will be lost.
  - You are about to drop the `Badges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Points` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserBadges` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('ATTENDANCE', 'POINTS', 'SCHEDULE', 'ASSESSMENT', 'SUBMISSION', 'GENERAL');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'INCOMPLETE';

-- AlterEnum
BEGIN;
CREATE TYPE "SubmissionType_new" AS ENUM ('IZIN_SAKIT', 'IZIN_KHUSUS', 'DINAS_LUAR', 'LEMBUR');
ALTER TABLE "Submissions" ALTER COLUMN "type" TYPE "SubmissionType_new" USING ("type"::text::"SubmissionType_new");
ALTER TYPE "SubmissionType" RENAME TO "SubmissionType_old";
ALTER TYPE "SubmissionType_new" RENAME TO "SubmissionType";
DROP TYPE "public"."SubmissionType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Points" DROP CONSTRAINT "Points_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadges" DROP CONSTRAINT "UserBadges_badgeId_fkey";

-- DropForeignKey
ALTER TABLE "UserBadges" DROP CONSTRAINT "UserBadges_userId_fkey";

-- AlterTable
ALTER TABLE "AssessmentCategories" DROP COLUMN "type";

-- DropTable
DROP TABLE "Badges";

-- DropTable
DROP TABLE "Points";

-- DropTable
DROP TABLE "UserBadges";

-- CreateTable
CREATE TABLE "Notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL DEFAULT 'GENERAL',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "referenceEntity" TEXT,
    "referenceId" TEXT,
    "pushSent" BOOLEAN NOT NULL DEFAULT false,
    "pushSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notifications_userId_isRead_createdAt_idx" ON "Notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notifications_userId_category_idx" ON "Notifications"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscriptions_endpoint_key" ON "PushSubscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscriptions_userId_idx" ON "PushSubscriptions"("userId");

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscriptions" ADD CONSTRAINT "PushSubscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

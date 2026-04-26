/*
  Warnings:

  - The values [LEMBUR] on the enum `SubmissionType` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- AlterEnum
BEGIN;
CREATE TYPE "SubmissionType_new" AS ENUM ('IZIN_SAKIT', 'IZIN_KHUSUS', 'DINAS_LUAR');
ALTER TABLE "Submissions" ALTER COLUMN "type" TYPE "SubmissionType_new" USING ("type"::text::"SubmissionType_new");
ALTER TYPE "SubmissionType" RENAME TO "SubmissionType_old";
ALTER TYPE "SubmissionType_new" RENAME TO "SubmissionType";
DROP TYPE "public"."SubmissionType_old";
COMMIT;

-- CreateTable
CREATE TABLE "Tickets" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "operatorId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "firstResponseAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketResponses" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketResponses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisfactionRatings" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SatisfactionRatings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tickets_reporterId_status_idx" ON "Tickets"("reporterId", "status");

-- CreateIndex
CREATE INDEX "Tickets_operatorId_status_idx" ON "Tickets"("operatorId", "status");

-- CreateIndex
CREATE INDEX "Tickets_status_priority_idx" ON "Tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "TicketResponses_ticketId_createdAt_idx" ON "TicketResponses"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SatisfactionRatings_ticketId_key" ON "SatisfactionRatings"("ticketId");

-- AddForeignKey
ALTER TABLE "Tickets" ADD CONSTRAINT "Tickets_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tickets" ADD CONSTRAINT "Tickets_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketResponses" ADD CONSTRAINT "TicketResponses_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketResponses" ADD CONSTRAINT "TicketResponses_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisfactionRatings" ADD CONSTRAINT "SatisfactionRatings_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

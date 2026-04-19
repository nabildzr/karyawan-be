-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'OFF');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('IZIN_SAKIT', 'IZIN_KHUSUS', 'DINAS_LUAR', 'LEMBUR', 'GANTI_SHIFT_HARI');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EARN', 'SPEND', 'PENALTY', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rbacRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RbacRoles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canAccessAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RbacRoles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionResources" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "routePath" TEXT,
    "groupName" TEXT,
    "supportsApprove" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionResources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermissionActions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermissionActions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Positions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gajiPokok" INTEGER NOT NULL,
    "isManagerial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "divisionId" TEXT,

    CONSTRAINT "Positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Divisions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employees" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "address" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "positionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workingSchedulesId" TEXT,

    CONSTRAINT "Employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDetails" (
    "employeeId" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "placeOfBirth" TEXT,
    "gender" TEXT,
    "maritalStatus" TEXT,
    "religion" TEXT,
    "profilePictureUrl" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "hireDate" DATE,
    "employmentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDetails_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "AssessmentCategories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisibleToEmployee" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentCategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessments" (
    "id" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "evaluateeId" TEXT NOT NULL,
    "assessmentDate" DATE NOT NULL,
    "period" TEXT NOT NULL,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentDetails" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Geofences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "radius" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Geofences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment" TEXT,
    "attachmentPublicId" TEXT,
    "attachmentOriginalName" TEXT,
    "attachmentMimeType" TEXT,
    "attachmentSizeBytes" INTEGER,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isCrossDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingSchedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkingSchedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDays" (
    "id" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shiftId" TEXT,
    "workingScheduleId" TEXT NOT NULL,

    CONSTRAINT "ScheduleDays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicHolidays" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicHolidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendances" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftNameSnapshot" TEXT NOT NULL,
    "expectedCheckInSnapshot" TIMESTAMP(3) NOT NULL,
    "expectedCheckOutSnapshot" TIMESTAMP(3),
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "manualReason" TEXT,
    "manualNotes" TEXT,
    "manualEntryBy" TEXT,
    "manualEntryAt" TIMESTAMP(3),
    "manualEntryByRole" TEXT,
    "deviceInfo" TEXT,
    "checkInPhoto" TEXT,
    "checkOutPhoto" TEXT,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'OFF',
    "statusCheckOut" "AttendanceStatus",
    "latitudeCheckInSnapshot" DECIMAL(10,7),
    "longitudeCheckInSnapshot" DECIMAL(10,7),
    "latitudeCheckOutSnapshot" DECIMAL(10,7),
    "longitudeCheckOutSnapshot" DECIMAL(10,7),
    "radiusCheckInSnapshot" INTEGER,
    "radiusCheckOutSnapshot" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "geofencesId" TEXT,
    "geofencesCheckOutId" TEXT,
    "pointsEarned" INTEGER,
    "usedTokenId" TEXT,

    CONSTRAINT "Attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFaces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "faceData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Points" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointRules" (
    "id" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "conditionField" TEXT NOT NULL,
    "conditionOp" TEXT NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "pointModifier" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLedgers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "referenceEntity" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointLedgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlexibilityItems" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "pointCost" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxPerMonth" INTEGER,
    "description" TEXT,
    "iconUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlexibilityItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_nip_key" ON "Users"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "RbacRoles_key_key" ON "RbacRoles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionResources_key_key" ON "PermissionResources"("key");

-- CreateIndex
CREATE INDEX "RolePermissionActions_roleId_idx" ON "RolePermissionActions"("roleId");

-- CreateIndex
CREATE INDEX "RolePermissionActions_resourceId_idx" ON "RolePermissionActions"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermissionActions_roleId_resourceId_action_key" ON "RolePermissionActions"("roleId", "resourceId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Divisions_managerId_key" ON "Divisions"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "Employees_email_key" ON "Employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Employees_phoneNumber_key" ON "Employees"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employees_userId_key" ON "Employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentDetails_assessmentId_categoryId_key" ON "AssessmentDetails"("assessmentId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDays_workingScheduleId_dayOfWeek_key" ON "ScheduleDays"("workingScheduleId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHolidays_date_key" ON "PublicHolidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendances_usedTokenId_key" ON "Attendances"("usedTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFaces_userId_key" ON "UserFaces"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadges_userId_badgeId_key" ON "UserBadges"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "PointRules_isActive_targetRole_idx" ON "PointRules"("isActive", "targetRole");

-- CreateIndex
CREATE INDEX "PointLedgers_userId_createdAt_idx" ON "PointLedgers"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLedgers_transactionType_idx" ON "PointLedgers"("transactionType");

-- CreateIndex
CREATE INDEX "UserTokens_userId_status_idx" ON "UserTokens"("userId", "status");

-- CreateIndex
CREATE INDEX "UserTokens_expiresAt_idx" ON "UserTokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_rbacRoleId_fkey" FOREIGN KEY ("rbacRoleId") REFERENCES "RbacRoles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissionActions" ADD CONSTRAINT "RolePermissionActions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RbacRoles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermissionActions" ADD CONSTRAINT "RolePermissionActions_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "PermissionResources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Positions" ADD CONSTRAINT "Positions_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Divisions" ADD CONSTRAINT "Divisions_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employees" ADD CONSTRAINT "Employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employees" ADD CONSTRAINT "Employees_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employees" ADD CONSTRAINT "Employees_workingSchedulesId_fkey" FOREIGN KEY ("workingSchedulesId") REFERENCES "WorkingSchedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDetails" ADD CONSTRAINT "EmployeeDetails_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessments" ADD CONSTRAINT "Assessments_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessments" ADD CONSTRAINT "Assessments_evaluateeId_fkey" FOREIGN KEY ("evaluateeId") REFERENCES "Employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDetails" ADD CONSTRAINT "AssessmentDetails_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDetails" ADD CONSTRAINT "AssessmentDetails_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssessmentCategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submissions" ADD CONSTRAINT "Submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDays" ADD CONSTRAINT "ScheduleDays_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDays" ADD CONSTRAINT "ScheduleDays_workingScheduleId_fkey" FOREIGN KEY ("workingScheduleId") REFERENCES "WorkingSchedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendances" ADD CONSTRAINT "Attendances_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendances" ADD CONSTRAINT "Attendances_manualEntryBy_fkey" FOREIGN KEY ("manualEntryBy") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendances" ADD CONSTRAINT "Attendances_geofencesId_fkey" FOREIGN KEY ("geofencesId") REFERENCES "Geofences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendances" ADD CONSTRAINT "Attendances_geofencesCheckOutId_fkey" FOREIGN KEY ("geofencesCheckOutId") REFERENCES "Geofences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendances" ADD CONSTRAINT "Attendances_usedTokenId_fkey" FOREIGN KEY ("usedTokenId") REFERENCES "UserTokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFaces" ADD CONSTRAINT "UserFaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadges" ADD CONSTRAINT "UserBadges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadges" ADD CONSTRAINT "UserBadges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Points" ADD CONSTRAINT "Points_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedgers" ADD CONSTRAINT "PointLedgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTokens" ADD CONSTRAINT "UserTokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTokens" ADD CONSTRAINT "UserTokens_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FlexibilityItems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

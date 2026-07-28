-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShareRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "orgName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_registry" (
    "id" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "deployUrl" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "formId" TEXT,
    "target" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'info',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_requests" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" "ShareRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_registrations" (
    "id" TEXT NOT NULL,
    "producerName" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "lastSubstantialUpdate" TIMESTAMP(3) NOT NULL,
    "investmentDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_update_logs" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scope" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,

    CONSTRAINT "database_update_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_formId_idx" ON "audit_logs"("formId");

-- CreateIndex
CREATE INDEX "share_requests_formId_idx" ON "share_requests"("formId");

-- CreateIndex
CREATE INDEX "database_update_logs_registrationId_idx" ON "database_update_logs"("registrationId");

-- AddForeignKey
ALTER TABLE "form_registry" ADD CONSTRAINT "form_registry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_update_logs" ADD CONSTRAINT "database_update_logs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "database_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

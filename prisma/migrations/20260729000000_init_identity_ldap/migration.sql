-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('MEMBER', 'AUTHOR', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "UserSource" AS ENUM ('LOCAL', 'LDAP');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FormLifecycle" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ApiScope" AS ENUM ('READ', 'WRITE', 'READ_WRITE');

-- CreateEnum
CREATE TYPE "ShareRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "LdapEncryption" AS ENUM ('NONE', 'LDAPS', 'STARTTLS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "employeeNo" TEXT,
    "department" TEXT,
    "position" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "UserSource" NOT NULL DEFAULT 'LOCAL',
    "ldapDn" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "canBulkExport" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "scopeFormId" TEXT,
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_registry" (
    "id" TEXT NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "deployUrl" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lifecycle" "FormLifecycle" NOT NULL DEFAULT 'DRAFT',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "submissionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scope" "ApiScope" NOT NULL DEFAULT 'READ',
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "publicBaseUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ldap_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT,
    "port" INTEGER NOT NULL DEFAULT 389,
    "encryption" "LdapEncryption" NOT NULL DEFAULT 'STARTTLS',
    "verifyCert" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "bindDn" TEXT,
    "bindPasswordEncrypted" TEXT,
    "baseDn" TEXT,
    "userSearchFilter" TEXT NOT NULL DEFAULT '(&(objectClass=person)(uid={username}))',
    "userSearchScope" TEXT NOT NULL DEFAULT 'sub',
    "attrEmail" TEXT NOT NULL DEFAULT 'mail',
    "attrName" TEXT NOT NULL DEFAULT 'cn',
    "attrEmployeeNo" TEXT DEFAULT 'employeeNumber',
    "attrDepartment" TEXT DEFAULT 'departmentNumber',
    "attrPosition" TEXT DEFAULT 'title',
    "defaultRole" "RoleType" NOT NULL DEFAULT 'MEMBER',
    "deactivateMissing" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncResult" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ldap_config_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeNo_key" ON "users"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "users_ldapDn_key" ON "users"("ldapDn");

-- CreateIndex
CREATE INDEX "users_department_idx" ON "users"("department");

-- CreateIndex
CREATE INDEX "users_source_status_idx" ON "users"("source", "status");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_scopeFormId_idx" ON "user_roles"("scopeFormId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_scopeFormId_key" ON "user_roles"("userId", "role", "scopeFormId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_formId_idx" ON "api_keys"("formId");

-- CreateIndex
CREATE INDEX "audit_logs_formId_idx" ON "audit_logs"("formId");

-- CreateIndex
CREATE INDEX "admin_notifications_userId_read_idx" ON "admin_notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "share_requests_formId_idx" ON "share_requests"("formId");

-- CreateIndex
CREATE INDEX "database_update_logs_registrationId_idx" ON "database_update_logs"("registrationId");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_scopeFormId_fkey" FOREIGN KEY ("scopeFormId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_registry" ADD CONSTRAINT "form_registry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_requests" ADD CONSTRAINT "share_requests_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_update_logs" ADD CONSTRAINT "database_update_logs_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "database_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CreateEnum
CREATE TYPE "IdentityMode" AS ENUM ('ANONYMOUS', 'IDENTIFIED', 'AUTHENTICATED', 'MIXED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "PointStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TargetingMode" AS ENUM ('ALL_MEMBERS', 'DEPARTMENTS', 'EXPLICIT', 'PREVIOUS_RESPONDENTS');

-- CreateEnum
CREATE TYPE "AuthorAuthStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FormApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RewardVisibility" AS ENUM ('HIDDEN', 'ADMIN_ONLY', 'ALL_MEMBERS');

-- CreateEnum
CREATE TYPE "FormLinkCardinality" AS ENUM ('ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY');

-- CreateEnum
CREATE TYPE "FormLinkVisibility" AS ENUM ('PRIVATE', 'PENDING', 'SHARED');

-- CreateEnum
CREATE TYPE "CorrectionRequestIssueType" AS ENUM ('MISSING', 'OUTLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "CorrectionRequestStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EndpointMode" AS ENUM ('BUILTIN', 'EXTERNAL', 'DISABLED');

-- AlterTable
ALTER TABLE "form_registry" ADD COLUMN     "anonymityThreshold" INTEGER,
ADD COLUMN     "authorHadPrivacyAuth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "collectsPersonalData" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "identityMode" "IdentityMode" NOT NULL DEFAULT 'ANONYMOUS',
ADD COLUMN     "maskingExemptReason" TEXT,
ADD COLUMN     "maskingExemptedAt" TIMESTAMP(3),
ADD COLUMN     "maskingExemptedBy" TEXT,
ADD COLUMN     "privacyWarningAck" TEXT;

-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "defaultAnonymityThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "maxWeeklyInvitesPerUser" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "rewardVisibility" "RewardVisibility" NOT NULL DEFAULT 'ADMIN_ONLY';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ontologyConsentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'SCHEDULED',
    "schemaVersion" INTEGER NOT NULL,
    "anonymityThreshold" INTEGER,
    "autoCreated" BOOLEAN NOT NULL DEFAULT false,
    "distributionScope" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_approval_requests" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" "FormApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "form_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_links" (
    "id" TEXT NOT NULL,
    "leftFormId" TEXT NOT NULL,
    "leftFieldId" TEXT NOT NULL,
    "rightFormId" TEXT NOT NULL,
    "rightFieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reverseName" TEXT NOT NULL,
    "cardinality" "FormLinkCardinality" NOT NULL,
    "normalization" JSONB NOT NULL,
    "isPersonalKey" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "FormLinkVisibility" NOT NULL DEFAULT 'PRIVATE',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "form_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_correction_requests" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "campaignId" TEXT,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT,
    "respondentId" TEXT,
    "issueType" "CorrectionRequestIssueType" NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "submission_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_schedules" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "startDayOfPeriod" INTEGER NOT NULL DEFAULT 1,
    "durationDays" INTEGER NOT NULL DEFAULT 14,
    "reminderDaysBefore" INTEGER[] DEFAULT ARRAY[7, 1]::INTEGER[],
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "nameTemplate" TEXT NOT NULL DEFAULT '{year} {quarter} 정기조사',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_targets" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT,
    "invitedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "campaign_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PointStatus" NOT NULL DEFAULT 'PENDING',
    "statusReason" TEXT,
    "campaignId" TEXT,
    "policySnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "point_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_participations" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastEditedAt" TIMESTAMP(3),
    "onTime" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "campaign_participations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respondent_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "campaignId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "singleUse" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "issuedBy" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),

    CONSTRAINT "respondent_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_response_buffer" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "campaignId" TEXT,
    "payloadEncrypted" TEXT NOT NULL,
    "bucketAt" TIMESTAMP(3) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_response_buffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_authorizations" (
    "userId" TEXT NOT NULL,
    "status" "AuthorAuthStatus" NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT NOT NULL,
    "plannedDataItems" TEXT NOT NULL,
    "pledgeAcceptedAt" TIMESTAMP(3),
    "trainingCompletedAt" TIMESTAMP(3),
    "trainingValidUntil" TIMESTAMP(3),
    "reauthorizeBy" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "author_authorizations_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "external_endpoint_config" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "mode" "EndpointMode" NOT NULL DEFAULT 'DISABLED',
    "scheme" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "pathTemplate" TEXT,
    "apiKey" TEXT,
    "dataAsOf" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastCheckOk" BOOLEAN,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_endpoint_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_category_assignments" (
    "formId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "form_category_assignments_pkey" PRIMARY KEY ("formId","categoryId")
);

-- CreateTable
CREATE TABLE "form_folders" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_folder_items" (
    "folderId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_folder_items_pkey" PRIMARY KEY ("folderId","formId")
);

-- CreateIndex
CREATE INDEX "campaigns_formId_status_idx" ON "campaigns"("formId", "status");

-- CreateIndex
CREATE INDEX "campaigns_status_endsAt_idx" ON "campaigns"("status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_formId_sequence_key" ON "campaigns"("formId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "form_approval_requests_campaignId_key" ON "form_approval_requests"("campaignId");

-- CreateIndex
CREATE INDEX "form_links_leftFormId_idx" ON "form_links"("leftFormId");

-- CreateIndex
CREATE INDEX "form_links_rightFormId_idx" ON "form_links"("rightFormId");

-- CreateIndex
CREATE INDEX "submission_correction_requests_formId_idx" ON "submission_correction_requests"("formId");

-- CreateIndex
CREATE INDEX "submission_correction_requests_respondentId_status_idx" ON "submission_correction_requests"("respondentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_schedules_formId_key" ON "campaign_schedules"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_targets_tokenId_key" ON "campaign_targets"("tokenId");

-- CreateIndex
CREATE INDEX "campaign_targets_campaignId_respondedAt_idx" ON "campaign_targets"("campaignId", "respondedAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_targets_campaignId_userId_key" ON "campaign_targets"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "point_ledger_userId_status_idx" ON "point_ledger"("userId", "status");

-- CreateIndex
CREATE INDEX "point_ledger_campaignId_idx" ON "point_ledger"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_participations_userId_idx" ON "campaign_participations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_participations_campaignId_userId_key" ON "campaign_participations"("campaignId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "respondent_tokens_tokenHash_key" ON "respondent_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "respondent_tokens_userId_formId_idx" ON "respondent_tokens"("userId", "formId");

-- CreateIndex
CREATE INDEX "respondent_tokens_formId_expiresAt_idx" ON "respondent_tokens"("formId", "expiresAt");

-- CreateIndex
CREATE INDEX "anonymous_response_buffer_formId_idx" ON "anonymous_response_buffer"("formId");

-- CreateIndex
CREATE INDEX "anonymous_response_buffer_campaignId_idx" ON "anonymous_response_buffer"("campaignId");

-- CreateIndex
CREATE INDEX "form_categories_parentId_idx" ON "form_categories"("parentId");

-- CreateIndex
CREATE INDEX "form_category_assignments_categoryId_idx" ON "form_category_assignments"("categoryId");

-- CreateIndex
CREATE INDEX "form_folders_ownerId_idx" ON "form_folders"("ownerId");

-- CreateIndex
CREATE INDEX "form_folders_parentId_idx" ON "form_folders"("parentId");

-- CreateIndex
CREATE INDEX "form_folder_items_formId_idx" ON "form_folder_items"("formId");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_approval_requests" ADD CONSTRAINT "form_approval_requests_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_correction_requests" ADD CONSTRAINT "submission_correction_requests_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_correction_requests" ADD CONSTRAINT "submission_correction_requests_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_schedules" ADD CONSTRAINT "campaign_schedules_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_targets" ADD CONSTRAINT "campaign_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_participations" ADD CONSTRAINT "campaign_participations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_participations" ADD CONSTRAINT "campaign_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respondent_tokens" ADD CONSTRAINT "respondent_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respondent_tokens" ADD CONSTRAINT "respondent_tokens_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_response_buffer" ADD CONSTRAINT "anonymous_response_buffer_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anonymous_response_buffer" ADD CONSTRAINT "anonymous_response_buffer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_authorizations" ADD CONSTRAINT "author_authorizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_categories" ADD CONSTRAINT "form_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "form_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_category_assignments" ADD CONSTRAINT "form_category_assignments_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_category_assignments" ADD CONSTRAINT "form_category_assignments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "form_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_folders" ADD CONSTRAINT "form_folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_folders" ADD CONSTRAINT "form_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "form_folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_folder_items" ADD CONSTRAINT "form_folder_items_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "form_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_folder_items" ADD CONSTRAINT "form_folder_items_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


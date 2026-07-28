-- CreateEnum
CREATE TYPE "FormLifecycle" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ApiScope" AS ENUM ('READ', 'WRITE', 'READ_WRITE');

-- AlterTable
ALTER TABLE "form_registry" ADD COLUMN     "lifecycle" "FormLifecycle" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "schemaVersion" INTEGER NOT NULL DEFAULT 1;

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

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "api_keys_formId_idx" ON "api_keys"("formId");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


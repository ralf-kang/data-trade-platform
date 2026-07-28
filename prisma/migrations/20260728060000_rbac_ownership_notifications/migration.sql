-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "canBulkExport" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "form_registry" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "startsAt" TIMESTAMP(3);

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

-- CreateIndex
CREATE INDEX "admin_notifications_userId_read_idx" ON "admin_notifications"("userId", "read");

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form_registry"("id") ON DELETE SET NULL ON UPDATE CASCADE;


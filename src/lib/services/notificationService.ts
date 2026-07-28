import { prisma } from '@/lib/db';

export interface NotifyInput {
  userId: string;
  formId?: string;
  type: string;
  message: string;
  severity?: 'info' | 'warning' | 'critical';
}

export async function notifyFormOwner(input: NotifyInput) {
  return prisma.adminNotification.create({
    data: {
      userId: input.userId,
      formId: input.formId,
      type: input.type,
      message: input.message,
      severity: input.severity ?? 'info',
    },
  });
}

export async function listNotifications(userId: string, unreadOnly = false) {
  return prisma.adminNotification.findMany({
    where: { userId, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markNotificationRead(id: string, userId: string) {
  await prisma.adminNotification.updateMany({ where: { id, userId }, data: { read: true } });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.adminNotification.updateMany({ where: { userId, read: false }, data: { read: true } });
}

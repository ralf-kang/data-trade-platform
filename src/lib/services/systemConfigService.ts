import { prisma } from '@/lib/db';

const CONFIG_ID = 'default';

export async function getSystemConfig() {
  const config = await prisma.systemConfig.findUnique({ where: { id: CONFIG_ID } });
  return config ?? { id: CONFIG_ID, publicBaseUrl: null, updatedAt: new Date(0) };
}

export async function setPublicBaseUrl(publicBaseUrl: string | null) {
  return prisma.systemConfig.upsert({
    where: { id: CONFIG_ID },
    update: { publicBaseUrl },
    create: { id: CONFIG_ID, publicBaseUrl },
  });
}

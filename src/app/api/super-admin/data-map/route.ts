import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { getDataMap, getDataMapSchemaExample } from '@/lib/services/dataMapService';

// 전체 시스템의 엔티티 관계 + 실시간 카운트를 노출하므로 슈퍼관리자 전용.
export async function GET() {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const [map, schemaExample] = await Promise.all([getDataMap(), getDataMapSchemaExample()]);
  return NextResponse.json({ ...map, schemaExample });
}

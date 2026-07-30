import { NextResponse } from 'next/server';
import { getCurrentUser, requireSuperAdmin } from '@/lib/auth';
import { deleteFormLink } from '@/lib/services/formLinkService';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const forbidden = await requireSuperAdmin();
  if (forbidden) return forbidden;

  const { id } = await params;
  const actor = await getCurrentUser();
  await deleteFormLink(id, actor);
  return NextResponse.json({ ok: true });
}

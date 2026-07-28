import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, requireAdmin } from '@/lib/auth';
import { createForm, listForms } from '@/lib/services/formService';

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const forms = await listForms();
  return NextResponse.json({ forms });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  if (!body?.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  const actor = await getCurrentAdmin();
  const form = await createForm(
    {
      id: body.id,
      title: body.title,
      description: body.description ?? '',
      fields: body.fields ?? [],
    },
    actor
  );
  return NextResponse.json({ form }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { campaigns } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, params.id))

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  await db
    .update(campaigns)
    .set({ status: 'paused', updated_at: new Date().toISOString() })
    .where(eq(campaigns.id, params.id))

  return NextResponse.json({ ok: true, status: 'paused' })
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { campaigns } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { runCampaign } from '@/lib/campaign-runner'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
  const db = await getDb()
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
    .set({ status: 'active', updated_at: new Date().toISOString() })
    .where(eq(campaigns.id, params.id))

  // Re-trigger the campaign loop for remaining pending contacts
  setImmediate(() => {
    runCampaign(params.id).catch((err) => {
      console.error(`[resume] Campaign runner error for ${params.id}:`, err)
    })
  })

  return NextResponse.json({ ok: true, status: 'active' })
}

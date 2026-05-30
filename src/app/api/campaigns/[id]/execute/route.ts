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

  // Set campaign to active
  await db
    .update(campaigns)
    .set({ status: 'active', updated_at: new Date().toISOString() })
    .where(eq(campaigns.id, params.id))

  // NOTE: Next.js App Router route handlers cannot truly background async work
  // in a serverless/edge context. Since this app is self-hosted (Docker / Node.js),
  // we use setImmediate to defer execution after the response is sent.
  // The HTTP response returns 202 immediately; the campaign loop runs in the
  // background on the same Node.js process. This will block that event loop
  // iteration for each await, but is acceptable for a self-hosted scenario.
  // For production at scale, replace with a proper job queue (BullMQ, etc.).
  setImmediate(() => {
    runCampaign(params.id).catch((err) => {
      console.error(`[execute] Campaign runner error for ${params.id}:`, err)
    })
  })

  return NextResponse.json({ ok: true, status: 'active' }, { status: 202 })
}

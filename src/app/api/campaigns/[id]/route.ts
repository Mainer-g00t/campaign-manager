import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { campaigns } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = await getDb()
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, params.id))

  if (!campaign) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(campaign)
}

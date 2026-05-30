import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { contacts } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.campaign_id, params.id))

  const stats = {
    total: rows.length,
    pending: 0,
    calling: 0,
    completed: 0,
    failed: 0,
    do_not_call: 0,
  }

  for (const row of rows) {
    const s = row.status as keyof typeof stats
    if (s in stats && s !== 'total') {
      stats[s]++
    }
  }

  return NextResponse.json(stats)
}

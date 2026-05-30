import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { calls, contacts } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = await getDb()

  // Join calls with contacts to get name + phone alongside the CDR data
  const rows = await db
    .select({
      id: calls.id,
      call_uuid: calls.call_uuid,
      destination: calls.destination,
      status: calls.status,
      started_at: calls.started_at,
      ended_at: calls.ended_at,
      duration_seconds: calls.duration_seconds,
      turn_count: calls.turn_count,
      end_reason: calls.end_reason,
      created_at: calls.created_at,
      contact_first_name: contacts.first_name,
      contact_last_name: contacts.last_name,
    })
    .from(calls)
    .leftJoin(contacts, eq(calls.contact_id, contacts.id))
    .where(eq(calls.campaign_id, params.id))
    .orderBy(calls.created_at)

  return NextResponse.json(rows)
}

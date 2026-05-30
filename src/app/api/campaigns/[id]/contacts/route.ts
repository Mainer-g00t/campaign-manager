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

  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { phone, first_name, last_name, extra_vars } = body

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    await db.insert(contacts).values({
      id,
      campaign_id: params.id,
      phone,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      extra_vars: JSON.stringify(extra_vars ?? {}),
      status: 'pending',
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[contacts] Error adding contact:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

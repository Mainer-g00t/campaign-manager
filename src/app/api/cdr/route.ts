import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { contacts, calls } from '@/db/schema'
import { eq, or } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const db = await getDb()
  try {
    const body = await req.json()

    const {
      call_uuid,
      destination,
      started_at,
      ended_at,
      duration_seconds,
      turn_count,
      end_reason,
      transcript,
      metadata,
    } = body

    const campaignId = metadata?.campaign_id
    const contactId = metadata?.contact_id

    // Find the contact: try by call_uuid first, then by metadata.contact_id
    let contact = null

    if (call_uuid) {
      const rows = await db
        .select()
        .from(contacts)
        .where(eq(contacts.call_uuid, call_uuid))
      contact = rows[0] ?? null
    }

    if (!contact && contactId) {
      const rows = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, contactId))
      contact = rows[0] ?? null
    }

    if (!contact) {
      console.warn('[cdr] Could not find contact for CDR', { call_uuid, contactId })
      return NextResponse.json({ ok: true, warning: 'contact not found' })
    }

    // Determine final contact status
    const finalStatus =
      end_reason === 'do_not_call' ? 'do_not_call' : 'completed'

    // Update contact status
    await db
      .update(contacts)
      .set({ status: finalStatus, call_uuid: call_uuid ?? contact.call_uuid })
      .where(eq(contacts.id, contact.id))

    // Find existing call record by call_uuid or contact_id
    let existingCall = null
    if (call_uuid) {
      const rows = await db
        .select()
        .from(calls)
        .where(eq(calls.call_uuid, call_uuid))
      existingCall = rows[0] ?? null
    }
    if (!existingCall) {
      const rows = await db
        .select()
        .from(calls)
        .where(eq(calls.contact_id, contact.id))
      existingCall = rows[0] ?? null
    }

    const now = new Date().toISOString()

    if (existingCall) {
      // Update existing call record
      await db
        .update(calls)
        .set({
          call_uuid: call_uuid ?? existingCall.call_uuid,
          status: finalStatus,
          started_at: started_at ?? existingCall.started_at,
          ended_at: ended_at ?? existingCall.ended_at,
          duration_seconds: duration_seconds ?? existingCall.duration_seconds,
          turn_count: turn_count ?? existingCall.turn_count,
          end_reason: end_reason ?? existingCall.end_reason,
          transcript: transcript ? JSON.stringify(transcript) : existingCall.transcript,
          raw_cdr: JSON.stringify(body),
        })
        .where(eq(calls.id, existingCall.id))
    } else {
      // Create new call record
      await db.insert(calls).values({
        id: crypto.randomUUID(),
        campaign_id: campaignId ?? contact.campaign_id,
        contact_id: contact.id,
        call_uuid,
        destination: destination ?? contact.phone,
        status: finalStatus,
        started_at,
        ended_at,
        duration_seconds,
        turn_count,
        end_reason,
        transcript: transcript ? JSON.stringify(transcript) : null,
        raw_cdr: JSON.stringify(body),
        created_at: now,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[cdr] Error processing CDR:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { campaigns } from '@/db/schema'

export async function POST(req: NextRequest) {
  const db = await getDb()
  try {
    const body = await req.json()
    const { name, agent_slug, voip_base_url, api_key, template_vars } = body

    if (!name || !agent_slug || !voip_base_url) {
      return NextResponse.json(
        { error: 'name, agent_slug, and voip_base_url are required' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    await db.insert(campaigns).values({
      id,
      name,
      agent_slug,
      voip_base_url,
      api_key: api_key || null,
      template_vars: JSON.stringify(template_vars ?? {}),
      status: 'draft',
      created_at: now,
      updated_at: now,
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[campaigns] Error creating campaign:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

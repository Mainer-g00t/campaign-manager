import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { contacts } from '@/db/schema'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    rows.push(row)
  }

  return rows
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDb()
    let csvText = ''

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file')
      const text = formData.get('csv')

      if (file && file instanceof Blob) {
        csvText = await file.text()
      } else if (typeof text === 'string') {
        csvText = text
      }
    } else {
      const body = await req.json()
      csvText = body.csv ?? ''
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 })
    }

    const rows = parseCSV(csvText)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows found in CSV' }, { status: 400 })
    }

    const now = new Date().toISOString()
    let imported = 0
    const errors: string[] = []

    for (const row of rows) {
      const phone = row['phone'] || row['Phone'] || row['PHONE']
      if (!phone) {
        errors.push(`Row missing phone: ${JSON.stringify(row)}`)
        continue
      }

      const first_name = row['first_name'] || row['First Name'] || row['firstname'] || null
      const last_name = row['last_name'] || row['Last Name'] || row['lastname'] || null

      // Extra vars: all columns except phone, first_name, last_name
      const knownCols = new Set(['phone', 'Phone', 'PHONE', 'first_name', 'First Name', 'firstname', 'last_name', 'Last Name', 'lastname'])
      const extraVars: Record<string, string> = {}
      for (const [key, value] of Object.entries(row)) {
        if (!knownCols.has(key) && value) {
          extraVars[key] = value
        }
      }

      try {
        await db.insert(contacts).values({
          id: crypto.randomUUID(),
          campaign_id: params.id,
          phone,
          first_name,
          last_name,
          extra_vars: JSON.stringify(extraVars),
          status: 'pending',
          created_at: now,
        })
        imported++
      } catch (err) {
        errors.push(`Failed to insert ${phone}: ${err}`)
      }
    }

    return NextResponse.json({ imported, errors })
  } catch (err) {
    console.error('[import] Error importing contacts:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { getDb } from '@/db'
import { campaigns, contacts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const db = await getDb()
  const allCampaigns = await db.select().from(campaigns).orderBy(campaigns.created_at)
  const allContacts = await db.select().from(contacts)

  // Build stats per campaign
  const statsMap: Record<string, { total: number; pending: number; calling: number; completed: number; failed: number; do_not_call: number }> = {}

  for (const c of allCampaigns) {
    statsMap[c.id] = { total: 0, pending: 0, calling: 0, completed: 0, failed: 0, do_not_call: 0 }
  }

  for (const contact of allContacts) {
    if (!statsMap[contact.campaign_id]) continue
    statsMap[contact.campaign_id].total++
    const s = contact.status as keyof typeof statsMap[string]
    if (s in statsMap[contact.campaign_id]) {
      statsMap[contact.campaign_id][s]++
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <p className="text-gray-500 mt-1">Manage and monitor your voice AI campaigns</p>
      </div>

      {allCampaigns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-lg">No campaigns yet</p>
          <Link
            href="/campaigns/new"
            className="mt-4 inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allCampaigns.map((campaign) => {
            const stats = statsMap[campaign.id]
            const progress = stats.total > 0
              ? Math.round(((stats.completed + stats.failed + stats.do_not_call) / stats.total) * 100)
              : 0

            return (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all block"
              >
                <div className="flex items-start justify-between mb-3">
                  <h2 className="font-semibold text-gray-900 text-base leading-tight">{campaign.name}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {campaign.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-1">Agent: <span className="font-mono text-gray-700">{campaign.agent_slug}</span></p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{stats.completed + stats.failed + stats.do_not_call} / {stats.total} processed</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-3 text-xs">
                  <span className="text-gray-500">{stats.pending} pending</span>
                  {stats.calling > 0 && <span className="text-blue-600">{stats.calling} calling</span>}
                  {stats.completed > 0 && <span className="text-green-600">{stats.completed} done</span>}
                  {stats.failed > 0 && <span className="text-red-500">{stats.failed} failed</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

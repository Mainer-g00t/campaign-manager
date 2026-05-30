'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  agent_slug: string
  voip_base_url: string
  template_vars: string
  status: string
  created_at: string
}

interface Contact {
  id: string
  phone: string
  first_name: string | null
  last_name: string | null
  status: string
  call_uuid: string | null
  created_at: string
}

interface Call {
  id: string
  call_uuid: string | null
  destination: string | null
  status: string | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  turn_count: number | null
  end_reason: string | null
  created_at: string
  contact_first_name: string | null
  contact_last_name: string | null
}

interface Stats {
  total: number
  pending: number
  calling: number
  completed: number
  failed: number
  do_not_call: number
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  calling: 'bg-blue-100 text-blue-700 animate-pulse',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  do_not_call: 'bg-orange-100 text-orange-700',
}

const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-blue-100 text-blue-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
}

export default function CampaignDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'contacts' | 'cdrs'>('contacts')

  const fetchData = useCallback(async () => {
    try {
      const [campRes, contactsRes, statsRes, callsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/campaigns/${id}/contacts`),
        fetch(`/api/campaigns/${id}/stats`),
        fetch(`/api/campaigns/${id}/calls`),
      ])

      if (!campRes.ok) {
        setError('Campaign not found')
        return
      }

      const [campData, contactsData, statsData, callsData] = await Promise.all([
        campRes.json(),
        contactsRes.json(),
        statsRes.json(),
        callsRes.json(),
      ])

      setCampaign(campData)
      setContacts(contactsData)
      setStats(statsData)
      setCalls(callsData)
    } catch {
      setError('Failed to load campaign data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  async function handleAction(action: 'execute' | 'pause' | 'resume') {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${id}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || `Failed to ${action} campaign`)
      } else {
        await fetchData()
      }
    } catch {
      alert(`Failed to ${action} campaign`)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500">{error || 'Campaign not found'}</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const progress = stats && stats.total > 0
    ? Math.round(((stats.completed + stats.failed + stats.do_not_call) / stats.total) * 100)
    : 0

  let templateVarsParsed: Record<string, string> = {}
  try { templateVarsParsed = JSON.parse(campaign.template_vars) } catch { /* empty */ }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Campaigns
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${CAMPAIGN_STATUS_BADGE[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}>
              {campaign.status}
            </span>
            <span className="text-sm text-gray-500">Agent: <span className="font-mono">{campaign.agent_slug}</span></span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(campaign.status === 'draft' || campaign.status === 'completed') && (
            <button
              onClick={() => handleAction('execute')}
              disabled={actionLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              {campaign.status === 'completed' ? 'Re-run' : 'Start Campaign'}
            </button>
          )}
          {campaign.status === 'active' && (
            <button
              onClick={() => handleAction('pause')}
              disabled={actionLoading}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              Pause
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={() => handleAction('resume')}
              disabled={actionLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
            >
              Resume
            </button>
          )}
          <Link
            href={`/campaigns/${id}/import`}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Import Contacts
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Pending', value: stats.pending, color: 'text-gray-600' },
            { label: 'Calling', value: stats.calling, color: 'text-blue-600' },
            { label: 'Completed', value: stats.completed, color: 'text-green-600' },
            { label: 'Failed', value: stats.failed, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Campaign info */}
      {Object.keys(templateVarsParsed).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Template Variables</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(templateVarsParsed).map(([k, v]) => (
              <span key={k} className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono">
                {k} = {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Tab header */}
        <div className="px-5 py-0 border-b border-gray-100 flex items-center justify-between">
          <div className="flex gap-0">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'contacts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setActiveTab('cdrs')}
              className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cdrs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Call Records ({calls.length})
            </button>
          </div>
          <span className="text-xs text-gray-400 pr-1">Auto-refreshes every 5s</span>
        </div>

        {/* Contacts tab */}
        {activeTab === 'contacts' && (
          contacts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No contacts yet</p>
              <Link
                href={`/campaigns/${id}/import`}
                className="mt-3 inline-block text-blue-600 hover:underline text-sm"
              >
                Import contacts
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Call UUID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-900">
                        {[contact.first_name, contact.last_name].filter(Boolean).join(' ') || (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-gray-600">{contact.phone}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[contact.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {contact.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400">
                        {contact.call_uuid ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* CDRs tab */}
        {activeTab === 'cdrs' && (
          calls.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No call records yet</p>
              <p className="text-xs text-gray-400 mt-1">Records appear here once calls are completed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Phone</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Duration</th>
                    <th className="px-5 py-3 font-medium">Turns</th>
                    <th className="px-5 py-3 font-medium">End Reason</th>
                    <th className="px-5 py-3 font-medium">Started</th>
                    <th className="px-5 py-3 font-medium">Call UUID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {calls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-900">
                        {[call.contact_first_name, call.contact_last_name].filter(Boolean).join(' ') || (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-gray-600">{call.destination ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[call.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                          {call.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {call.duration_seconds != null ? `${call.duration_seconds}s` : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-center">
                        {call.turn_count ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        {call.end_reason ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-50 border border-gray-200 text-gray-600">
                            {call.end_reason}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-400">
                        {call.started_at
                          ? new Date(call.started_at).toLocaleString()
                          : call.created_at
                            ? new Date(call.created_at).toLocaleString()
                            : '—'}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-400 max-w-[160px] truncate">
                        {call.call_uuid ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}

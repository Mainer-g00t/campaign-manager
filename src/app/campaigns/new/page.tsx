'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface KVPair {
  key: string
  value: string
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [agentSlug, setAgentSlug] = useState('')
  const [voipBaseUrl, setVoipBaseUrl] = useState('http://config-api:8080')
  const [apiKey, setApiKey] = useState('')
  const [templateVars, setTemplateVars] = useState<KVPair[]>([{ key: '', value: '' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addKV() {
    setTemplateVars((prev) => [...prev, { key: '', value: '' }])
  }

  function removeKV(index: number) {
    setTemplateVars((prev) => prev.filter((_, i) => i !== index))
  }

  function updateKV(index: number, field: 'key' | 'value', val: string) {
    setTemplateVars((prev) =>
      prev.map((pair, i) => (i === index ? { ...pair, [field]: val } : pair))
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const tvObj: Record<string, string> = {}
    for (const { key, value } of templateVars) {
      if (key.trim()) tvObj[key.trim()] = value
    }

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          agent_slug: agentSlug,
          voip_base_url: voipBaseUrl,
          api_key: apiKey || null,
          template_vars: tvObj,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create campaign')
      }

      const { id } = await res.json()
      router.push(`/campaigns/${id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">New Campaign</h1>
        <p className="text-gray-500 mt-1">Configure your voice AI campaign settings</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Campaign Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Q4 Outreach"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agent Slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={agentSlug}
            onChange={(e) => setAgentSlug(e.target.value)}
            required
            placeholder="sales"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">The agent identifier used when originating calls</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            VoIP Base URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={voipBaseUrl}
            onChange={(e) => setVoipBaseUrl(e.target.value)}
            required
            placeholder="https://your-voip-platform.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Base URL for the voice AI platform API</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-va-abc123..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">Sent as <span className="font-mono">X-Api-Key</span> header when originating calls. Leave blank if your platform does not require auth.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Template Variables</label>
            <button
              type="button"
              onClick={addKV}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add variable
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            These variables are merged with contact data and passed to the agent (e.g., product, company)
          </p>
          <div className="space-y-2">
            {templateVars.map((pair, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={pair.key}
                  onChange={(e) => updateKV(i, 'key', e.target.value)}
                  placeholder="variable"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-400 text-sm">=</span>
                <input
                  type="text"
                  value={pair.value}
                  onChange={(e) => updateKV(i, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => removeKV(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors px-1"
                  aria-label="Remove variable"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </button>
          <a
            href="/"
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}

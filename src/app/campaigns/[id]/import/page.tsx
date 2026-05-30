'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const EXAMPLE_CSV = `phone,first_name,last_name,product
+15551234567,Alice,Smith,Premium
+15559876543,Bob,Jones,Basic
+15550001234,Carol,Williams,Premium`

export default function ImportContactsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)

    try {
      let body: FormData | string
      let headers: Record<string, string> = {}

      // Check if a file was selected
      const file = fileRef.current?.files?.[0]
      if (file) {
        const formData = new FormData()
        formData.append('file', file)
        body = formData
      } else if (csvText.trim()) {
        body = JSON.stringify({ csv: csvText })
        headers = { 'Content-Type': 'application/json' }
      } else {
        setError('Please paste CSV data or select a file')
        setLoading(false)
        return
      }

      const res = await fetch(`/api/campaigns/${id}/contacts/import`, {
        method: 'POST',
        headers,
        body,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setResult(data)

      if (data.imported > 0 && data.errors.length === 0) {
        // Auto-redirect after success
        setTimeout(() => router.push(`/campaigns/${id}`), 1500)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-2">
        <Link href={`/campaigns/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back to campaign
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>
        <p className="text-gray-500 mt-1">Upload a CSV file or paste CSV data directly</p>
      </div>

      <form onSubmit={handleImport} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className={`rounded-lg px-4 py-3 text-sm ${result.errors.length === 0 ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
            <p className="font-medium">{result.imported} contacts imported successfully</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 text-xs space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-red-600">• {e}</li>
                ))}
              </ul>
            )}
            {result.imported > 0 && result.errors.length === 0 && (
              <p className="text-xs mt-1 text-green-600">Redirecting to campaign...</p>
            )}
          </div>
        )}

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload CSV File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-400">or paste CSV data</span>
          </div>
        </div>

        {/* Paste area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Paste CSV Data</label>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            placeholder={EXAMPLE_CSV}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        {/* Format hint */}
        <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
          <p className="font-medium mb-1">CSV Format</p>
          <ul className="space-y-1 list-disc list-inside text-gray-500">
            <li>First row must be headers</li>
            <li><span className="font-mono">phone</span> column is required</li>
            <li><span className="font-mono">first_name</span> and <span className="font-mono">last_name</span> are optional</li>
            <li>Any extra columns become contact template variables</li>
          </ul>
          <div className="mt-3">
            <p className="font-medium text-gray-600 mb-1">Example:</p>
            <pre className="bg-white border border-gray-200 rounded p-2 text-xs overflow-x-auto">{EXAMPLE_CSV}</pre>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {loading ? 'Importing...' : 'Import Contacts'}
          </button>
          <Link
            href={`/campaigns/${id}`}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

import { useState, useEffect } from 'react'
import axios from 'axios'
import Cookies from 'js-cookie'

interface ServerStats {
  server?: {
    uptime: number
    uptimeFormatted: string
    nodeVersion: string
  }
  memory?: {
    rss: number
    heapTotal: number
    heapUsed: number
    rssFormatted?: string
    heapTotalFormatted?: string
    heapUsedFormatted?: string
  }
  environment?: {
    nodeEnv: string
    port: string
  }
  activeModels: {
    chat: string
    files: string
    testing: string
  }
  lastModelRefresh: string
}

export default function ServerInfo() {
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [loading, setLoading] = useState(true)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

  useEffect(() => {
    fetchServerInfo()
    const interval = setInterval(fetchServerInfo, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchServerInfo = async () => {
    try {
      const token = Cookies.get('adminToken')
      const response = await axios.get(`${API_URL}/admin/server/info`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setStats(response.data)
    } catch (error) {
      console.error('Failed to fetch server info:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  if (loading) {
    return <div className="animate-pulse">Loading server info...</div>
  }

  if (!stats) {
    return <div>Failed to load server information</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Server Status</h2>
        
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Uptime</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.server?.uptimeFormatted || formatUptime(stats.server?.uptime || 0)}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Environment</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.environment?.nodeEnv || 'development'}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Node Version</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.server?.nodeVersion || 'Unknown'}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Port</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.environment?.port || '3001'}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Memory Usage</h3>
        
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">RSS</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.memory?.rssFormatted || formatBytes(stats.memory?.rss || 0)}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Heap Total</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.memory?.heapTotalFormatted || formatBytes(stats.memory?.heapTotal || 0)}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Heap Used</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.memory?.heapUsedFormatted || formatBytes(stats.memory?.heapUsed || 0)}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Active Models</h3>
        
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">Chat Model</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.activeModels.chat}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Files Model</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.activeModels.files}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Testing Model</dt>
            <dd className="mt-1 text-sm text-gray-900">{stats.activeModels.testing}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
import { useState, useEffect } from 'react'
import { Switch } from '@headlessui/react'
import Cookies from 'js-cookie'

interface FeatureFlag {
  id: string
  name: string
  description: string
  enabled: boolean
}

interface FeatureFlagsResponse {
  flags: FeatureFlag[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.getbrainlift.app/api'

export default function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null)

  const fetchFlags = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const token = Cookies.get('adminToken')
      const response = await fetch(`${API_URL}/feature-flags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch feature flags: ${response.statusText}`)
      }

      const data: FeatureFlagsResponse = await response.json()
      setFlags(data.flags || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch feature flags'
      setError(errorMessage)
      console.error('Error fetching feature flags:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateFlag = async (flagId: string, enabled: boolean) => {
    try {
      setUpdatingFlag(flagId)
      setError(null)

      const token = Cookies.get('adminToken')
      const response = await fetch(`${API_URL}/feature-flags/${flagId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ enabled })
      })

      if (!response.ok) {
        throw new Error(`Failed to update feature flag: ${response.statusText}`)
      }

      const updatedFlag = await response.json()
      
      // Update the local state
      setFlags(prevFlags => 
        prevFlags.map(flag => 
          flag.id === flagId ? { ...flag, enabled: updatedFlag.enabled } : flag
        )
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update feature flag'
      setError(errorMessage)
      console.error('Error updating feature flag:', err)
      
      // Revert the change on error
      setFlags(prevFlags => 
        prevFlags.map(flag => 
          flag.id === flagId ? { ...flag, enabled: !enabled } : flag
        )
      )
    } finally {
      setUpdatingFlag(null)
    }
  }

  useEffect(() => {
    fetchFlags()
  }, [])

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-base sm:text-lg font-medium text-gray-900">Feature Flags</h2>
        <p className="mt-1 text-xs sm:text-sm text-gray-600">
          Control feature availability across the application
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={fetchFlags}
                  className="bg-red-100 px-2 py-1 text-sm font-medium text-red-800 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {flags.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6 text-center">
            <p className="text-gray-500">No feature flags configured</p>
          </div>
        ) : (
          flags.map((flag) => (
            <div key={flag.id} className="bg-white shadow rounded-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex-1">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900">
                    {flag.name}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-gray-600">
                    {flag.description}
                  </p>
                </div>
                <div className="sm:ml-4 flex items-center justify-end">
                  {updatingFlag === flag.id && (
                    <div className="mr-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    </div>
                  )}
                  <Switch
                    checked={flag.enabled}
                    onChange={(enabled) => updateFlag(flag.id, enabled)}
                    disabled={updatingFlag === flag.id}
                    className={`${
                      flag.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                    } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span className="sr-only">
                      {flag.enabled ? 'Disable' : 'Enable'} {flag.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`${
                        flag.enabled ? 'translate-x-5' : 'translate-x-0'
                      } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </Switch>
                </div>
              </div>
              {flag.id === 'web-login-enabled' && !flag.enabled && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> Web login is currently disabled. Users will not be able to sign in through the web application.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={fetchFlags}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
              Refreshing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>
    </div>
  )
}
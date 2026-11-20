import { useState } from 'react'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface User {
  id: string
  email: string
  full_name?: string
  subscription_tier: 'free' | 'premium' | 'ultra'
  subscription_end_date?: string | null
  created_at: string
  oauth_providers?: string[]
}

type Duration = '1_week' | '1_month' | '1_year' | 'lifetime'
type Action = 'set' | 'extend'

const TIER_CONFIG = {
  free: { label: 'Free', badgeClass: 'bg-gray-100 text-gray-800' },
  premium: { label: 'Premium', badgeClass: 'bg-blue-100 text-blue-800' },
  ultra: { label: 'Ultra', badgeClass: 'bg-purple-100 text-purple-800' },
} as const

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: '1_week', label: '1 Week' },
  { value: '1_month', label: '1 Month' },
  { value: '1_year', label: '1 Year' },
  { value: 'lifetime', label: 'Lifetime' },
]

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState<'email' | 'userId' | 'oauth'>('email')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [foundUser, setFoundUser] = useState<User | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<Duration>('1_month')

  const searchUser = async () => {
    if (!searchTerm.trim()) {
      setMessage('Please enter a search term')
      return
    }

    setLoading(true)
    setMessage('')
    setFoundUser(null)

    try {
      const searchBy = searchType === 'oauth' ? 'email' : searchType
      const token = Cookies.get('adminToken')
      const response = await fetch(`${API_URL}/admin/users/search?${searchBy}=${encodeURIComponent(searchTerm.trim())}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errMsg = typeof errorData.error === 'string' ? errorData.error : errorData.error?.message || 'Failed to search user'
        throw new Error(errMsg)
      }

      const userData = await response.json()

      if (userData.user) {
        setFoundUser(userData.user)
        setMessage('User found successfully')
      } else {
        setMessage('User not found')
      }
    } catch (error) {
      console.error('Search error:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const changeTier = async (userId: string, newTier: 'free' | 'premium' | 'ultra', action: Action = 'set') => {
    const durationLabel = DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label || selectedDuration
    let confirmMsg = ''

    if (newTier === 'free') {
      confirmMsg = 'Are you sure you want to downgrade this user to Free? This removes their subscription immediately.'
    } else if (action === 'extend' && selectedDuration === 'lifetime') {
      confirmMsg = `Upgrade ${TIER_CONFIG[newTier].label} to Lifetime (never expires)?`
    } else if (action === 'extend') {
      confirmMsg = `Extend ${TIER_CONFIG[newTier].label} by ${durationLabel}? Time will be added to their current expiration.`
    } else {
      confirmMsg = `Set user to ${TIER_CONFIG[newTier].label} for ${durationLabel}? This overwrites their current subscription.`
    }

    if (!confirm(confirmMsg)) return

    setLoading(true)
    setMessage('')

    try {
      const token = Cookies.get('adminToken')
      const response = await fetch(`${API_URL}/admin/users/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          userId,
          tier: newTier,
          ...(newTier !== 'free' && { duration: selectedDuration, action })
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errMsg = typeof errorData.error === 'string' ? errorData.error : errorData.error?.message || 'Failed to update user tier'
        throw new Error(errMsg)
      }

      const result = await response.json()
      setMessage(result.message || 'Updated successfully!')

      if (foundUser && result.user) {
        setFoundUser({
          ...foundUser,
          subscription_tier: result.user.subscription_tier,
          subscription_end_date: result.user.subscription_end_date,
        })
      }
    } catch (error) {
      console.error('Tier change error:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getExpirationInfo = (user: User) => {
    if (user.subscription_tier === 'free') return null
    if (!user.subscription_end_date) {
      return { text: 'Lifetime (never expires)', className: 'text-indigo-600 font-semibold', isLifetime: true, isExpired: false }
    }
    const now = new Date()
    const expiry = new Date(user.subscription_end_date)
    if (expiry < now) {
      return { text: `Expired ${formatDate(user.subscription_end_date)}`, className: 'text-red-600', isLifetime: false, isExpired: true }
    }
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const color = daysLeft <= 7 ? 'text-orange-600' : 'text-green-600'
    return { text: `${formatDate(user.subscription_end_date)} (${daysLeft}d left)`, className: color, isLifetime: false, isExpired: false }
  }

  // Can we extend? Only if user has a timed (non-lifetime, non-free) subscription
  const canExtend = (user: User) => {
    return user.subscription_tier !== 'free' && user.subscription_end_date !== null
  }

  // User is already lifetime premium if they have a paid tier with no end date
  const isAlreadyLifetime = (user: User) => {
    return user.subscription_tier !== 'free' && user.subscription_end_date === null
  }

  const tierConfig = foundUser ? TIER_CONFIG[foundUser.subscription_tier] || TIER_CONFIG.free : null
  const expirationInfo = foundUser ? getExpirationInfo(foundUser) : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900 mb-4">User Management</h2>
        <p className="text-sm text-gray-600 mb-6">
          Search for users and manage their subscription tiers.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Search User</h3>

        <div className="space-y-4">
          {/* Search Type Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700">Search by:</label>
            <div className="mt-2 space-x-4">
              {(['email', 'userId', 'oauth'] as const).map((type) => (
                <label key={type} className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-indigo-600"
                    name="searchType"
                    value={type}
                    checked={searchType === type}
                    onChange={() => setSearchType(type)}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {type === 'email' ? 'Email' : type === 'userId' ? 'User ID' : 'OAuth Email'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {searchType === 'email' ? 'Email Address' : searchType === 'userId' ? 'User ID' : 'OAuth Email Address'}
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type={searchType === 'userId' ? 'text' : 'email'}
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder={
                  searchType === 'email' ? 'user@example.com' :
                  searchType === 'userId' ? 'user-id-123' :
                  'oauth-user@gmail.com'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUser()}
              />
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 text-sm disabled:opacity-50"
                onClick={searchUser}
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mt-4 p-3 rounded-md ${
            message.includes('Error') || message.includes('not found')
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* User Details & Actions */}
      {foundUser && tierConfig && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Details</h3>

          <div className="space-y-3">
            <div>
              <span className="font-medium text-gray-700">Email:</span>
              <span className="ml-2 text-gray-900">{foundUser.email}</span>
            </div>

            <div>
              <span className="font-medium text-gray-700">User ID:</span>
              <span className="ml-2 text-gray-900 font-mono text-sm">{foundUser.id}</span>
            </div>

            {foundUser.full_name && (
              <div>
                <span className="font-medium text-gray-700">Name:</span>
                <span className="ml-2 text-gray-900">{foundUser.full_name}</span>
              </div>
            )}

            <div>
              <span className="font-medium text-gray-700">Subscription:</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${tierConfig.badgeClass}`}>
                {tierConfig.label}
              </span>
            </div>

            {/* Subscription Expiration */}
            {expirationInfo && (
              <div>
                <span className="font-medium text-gray-700">Expires:</span>
                <span className={`ml-2 text-sm font-medium ${expirationInfo.className}`}>
                  {expirationInfo.text}
                </span>
              </div>
            )}

            <div>
              <span className="font-medium text-gray-700">Joined:</span>
              <span className="ml-2 text-gray-900">{formatDate(foundUser.created_at)}</span>
            </div>

            {foundUser.oauth_providers && foundUser.oauth_providers.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">OAuth Providers:</span>
                <span className="ml-2 text-gray-900">{foundUser.oauth_providers.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Duration Selector */}
          <div className="mt-6 border-t pt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Duration:</label>
            <div className="flex space-x-2">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                    selectedDuration === option.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedDuration(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons - all in one row */}
          <div className="mt-4">
            {isAlreadyLifetime(foundUser) && selectedDuration === 'lifetime' ? (
              <p className="text-sm text-gray-500 italic">User is already on Lifetime Premium. Select a different duration or downgrade.</p>
            ) : null}
            <div className="flex flex-wrap gap-3 mt-2">
              {foundUser.subscription_tier !== 'free' && (
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50"
                  onClick={() => changeTier(foundUser.id, 'free', 'set')}
                  disabled={loading}
                >
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                  Downgrade to Free
                </button>
              )}
              {!(isAlreadyLifetime(foundUser) && selectedDuration === 'lifetime') && (
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  onClick={() => changeTier(foundUser.id, 'premium', 'set')}
                  disabled={loading}
                >
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                  Set Premium ({DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label})
                </button>
              )}
              {canExtend(foundUser) && !(isAlreadyLifetime(foundUser) && selectedDuration === 'lifetime') && (
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border-2 border-blue-600 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                  onClick={() => changeTier(foundUser.id, foundUser.subscription_tier, 'extend')}
                  disabled={loading}
                >
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>}
                  Extend by {DURATION_OPTIONS.find(d => d.value === selectedDuration)?.label}
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center px-4 py-2 border-2 border-orange-500 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
                onClick={async () => {
                  if (!confirm(`Reset all limits for ${foundUser.email}?`)) return
                  setLoading(true)
                  try {
                    const token = Cookies.get('adminToken')
                    const res = await fetch(`${API_URL}/admin/users/${foundUser.id}/reset-limit`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error?.message)
                    alert(data.message)
                  } catch (e: any) {
                    alert(e.message || 'Failed to reset limits')
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
              >
                Reset Limits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

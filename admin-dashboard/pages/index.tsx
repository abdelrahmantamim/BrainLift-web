import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import ModelSettings from '../components/ModelSettings'
import ServerInfo from '../components/ServerInfo'
import RateLimitSettings from '../components/RateLimitSettings'
import FileSizeSettings from '../components/FileSizeSettings'
import NotificationSettings from '../components/NotificationSettings'
import FeatureFlags from '../components/FeatureFlags'
import UserManagement from '../components/UserManagement'
import SubscriptionLimits from '../components/SubscriptionLimits'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('models')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <Layout>
      <div className="py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          
          <div className="mt-4 sm:mt-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('models')}
                  className={`${
                    activeTab === 'models'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  AI Model Settings
                </button>
                <button
                  onClick={() => setActiveTab('server')}
                  className={`${
                    activeTab === 'server'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  Server Info
                </button>
                <button
                  onClick={() => setActiveTab('rateLimits')}
                  className={`${
                    activeTab === 'rateLimits'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  Rate Limits
                </button>
                <button
                  onClick={() => setActiveTab('fileSize')}
                  className={`${
                    activeTab === 'fileSize'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  File Size Settings
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`${
                    activeTab === 'notifications'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  Push Notifications
                </button>
                <button
                  onClick={() => setActiveTab('featureFlags')}
                  className={`${
                    activeTab === 'featureFlags'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  Feature Flags
                </button>
                <button
                  onClick={() => setActiveTab('subscriptionLimits')}
                  className={`${
                    activeTab === 'subscriptionLimits'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  Subscription Limits
                </button>
                <button
                  onClick={() => setActiveTab('userManagement')}
                  className={`${
                    activeTab === 'userManagement'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm flex-shrink-0`}
                >
                  User Management
                </button>
              </nav>
            </div>
          </div>

          <div className="mt-4 sm:mt-8">
            {activeTab === 'models' && <ModelSettings />}
            {activeTab === 'server' && <ServerInfo />}
            {activeTab === 'rateLimits' && <RateLimitSettings />}
            {activeTab === 'fileSize' && <FileSizeSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'featureFlags' && <FeatureFlags />}
            {activeTab === 'subscriptionLimits' && <SubscriptionLimits />}
            {activeTab === 'userManagement' && <UserManagement />}
          </div>
        </div>
      </div>
    </Layout>
  )
}
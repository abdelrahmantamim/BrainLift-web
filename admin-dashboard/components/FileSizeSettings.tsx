import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

export default function FileSizeSettings() {
  const [config, setConfig] = useState({
    limit_mb: 10,
    max_allowed_mb: 50
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [tempLimit, setTempLimit] = useState(10)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const token = Cookies.get('adminToken')
      const response = await axios.get(`${API_URL}/admin/files/settings/size-limits`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Convert bytes to MB for display
      const limitMB = Math.round(response.data.maxFileSize / 1048576)
      setConfig({ 
        limit_mb: limitMB,
        ...response.data 
      })
      setTempLimit(limitMB)
    } catch {
      toast.error('Failed to fetch file size configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = Cookies.get('adminToken')
      const response = await axios.put(
        `${API_URL}/admin/files/settings/size-limits`,
        { maxFileSize: tempLimit * 1048576 }, // Convert MB to bytes
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      // Update config with new values
      const newLimitMB = Math.round(response.data.settings.maxFileSize / 1048576)
      setConfig({ 
        limit_mb: newLimitMB,
        ...response.data.settings 
      })
      setEditMode(false)
      toast.success('File size limit updated successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to update file size limit')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setTempLimit(config.limit_mb)
    setEditMode(false)
  }

  if (loading) {
    return <div className="animate-pulse">Loading file size settings...</div>
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">File Size Limit Settings</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Current File Size Limit
          </label>
          {editMode ? (
            <div className="mt-1 flex items-center space-x-4">
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={tempLimit}
                  onChange={(e) => setTempLimit(parseInt(e.target.value) || 1)}
                  className="block w-32 pr-12 pl-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">MB</span>
                </div>
              </div>
              <span className="text-sm text-gray-500">
                (Maximum allowed: {config.max_allowed_mb} MB)
              </span>
            </div>
          ) : (
            <div className="mt-1 flex items-center space-x-4">
              <span className="text-2xl font-semibold text-gray-900">
                {config.limit_mb} MB
              </span>
              <span className="text-sm text-gray-500">
                ({config.limit_mb * 1024 * 1024} bytes)
              </span>
            </div>
          )}
        </div>

        <div className="bg-blue-50 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1 md:flex md:justify-between">
              <p className="text-sm text-blue-700">
                This limit applies to all file uploads in the mobile app. The backend server supports up to 50 MB.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-between items-center">
          {editMode ? (
            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                disabled={saving || tempLimit < 1 || tempLimit > 50}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Change Limit
            </button>
          )}
          
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        </div>

        {tempLimit !== config.limit_mb && editMode && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Preview: Changing from {config.limit_mb} MB to {tempLimit} MB
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>This change will affect all users immediately after saving.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
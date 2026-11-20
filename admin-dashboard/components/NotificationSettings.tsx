import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

interface NotificationTemplate {
  id: string
  name: string
  title: string
  body: string
  data?: Record<string, any>
  is_active: boolean
  created_at: string
}

interface ScheduledNotification {
  id: string
  template_id?: string
  custom_title?: string
  custom_body?: string
  scheduled_for: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  segment?: string
  created_at: string
}

interface NotificationStats {
  total_users: number
  users_with_tokens: number
  notifications_sent_today: number
  notifications_sent_week: number
  pending_notifications: number
}

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([])
  const [activeTab, setActiveTab] = useState<'send' | 'templates' | 'scheduled' | 'stats'>('send')
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  
  // Form states
  const [sendForm, setSendForm] = useState({
    title: '',
    body: '',
    data: '{}',
    segment: 'all',
    userIds: '',
    scheduleFor: '',
  })
  
  const [templateForm, setTemplateForm] = useState({
    name: '',
    title: '',
    body: '',
    data: '{}',
  })
  
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Try to get the token from cookies first, then localStorage
      const token = Cookies.get('adminToken')
      
      if (!token) {
        toast.error('Please login first')
        return
      }
      
      const headers = { Authorization: `Bearer ${token}` }
      
      const [statsRes, templatesRes, scheduledRes] = await Promise.all([
        axios.get(`${API_URL}/admin/notifications/stats`, { headers }),
        axios.get(`${API_URL}/admin/notifications/templates`, { headers }),
        axios.get(`${API_URL}/admin/notifications/scheduled`, { headers }),
      ])
      
      setStats(statsRes.data)
      setTemplates(templatesRes.data.templates || [])
      setScheduledNotifications(scheduledRes.data.notifications || [])
    } catch (error) {
      console.error('Error fetching notification data:', error)
      toast.error('Failed to load notification data')
    } finally {
      setLoading(false)
    }
  }

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Try to get the token from cookies first, then localStorage
      const token = Cookies.get('adminToken')
      
      if (!token) {
        toast.error('Please login first')
        return
      }
      
      let data = {}
      try {
        data = JSON.parse(sendForm.data)
      } catch {
        toast.error('Invalid JSON in data field')
        return
      }
      
      const payload: any = {
        title: sendForm.title,
        body: sendForm.body,
        data,
        segment: sendForm.segment,
      }
      
      if (sendForm.segment === 'specific' && sendForm.userIds) {
        // Send emails instead of IDs, backend will convert them
        payload.userEmails = sendForm.userIds.split(',').map(email => email.trim())
      }
      
      if (sendForm.scheduleFor) {
        payload.scheduledFor = new Date(sendForm.scheduleFor).toISOString()
      }
      
      await axios.post(
        `${API_URL}/admin/notifications/send`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      toast.success('Notification sent successfully')
      setSendForm({
        title: '',
        body: '',
        data: '{}',
        segment: 'all',
        userIds: '',
        scheduleFor: '',
      })
      fetchData()
    } catch (error: any) {
      console.error('Error sending notification:', error)
      toast.error(error.response?.data?.message || 'Failed to send notification')
    }
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const token = Cookies.get('adminToken')
      
      let data = {}
      try {
        data = JSON.parse(templateForm.data)
      } catch {
        toast.error('Invalid JSON in data field')
        return
      }
      
      const payload = {
        name: templateForm.name,
        title: templateForm.title,
        body: templateForm.body,
        data,
      }
      
      if (editingTemplate) {
        await axios.put(
          `${API_URL}/admin/notifications/templates/${editingTemplate}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('Template updated successfully')
      } else {
        await axios.post(
          `${API_URL}/admin/notifications/templates`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        toast.success('Template created successfully')
      }
      
      setTemplateForm({
        name: '',
        title: '',
        body: '',
        data: '{}',
      })
      setEditingTemplate(null)
      fetchData()
    } catch (error: any) {
      console.error('Error creating template:', error)
      toast.error(error.response?.data?.message || 'Failed to create template')
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    
    try {
      const token = Cookies.get('adminToken')
      await axios.delete(
        `${API_URL}/admin/notifications/templates/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Template deleted successfully')
      fetchData()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  const handleCancelNotification = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled notification?')) return
    
    try {
      const token = Cookies.get('adminToken')
      await axios.post(
        `${API_URL}/admin/notifications/scheduled/${id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Notification cancelled successfully')
      fetchData()
    } catch (error) {
      console.error('Error cancelling notification:', error)
      toast.error('Failed to cancel notification')
    }
  }

  const loadTemplateIntoSendForm = (template: NotificationTemplate) => {
    setSendForm({
      ...sendForm,
      title: template.title,
      body: template.body,
      data: JSON.stringify(template.data || {}, null, 2),
    })
    setActiveTab('send')
    toast.success('Template loaded into send form')
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('send')}
              className={`${
                activeTab === 'send'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Send Notification
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`${
                activeTab === 'templates'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Templates
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`${
                activeTab === 'scheduled'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`${
                activeTab === 'stats'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Statistics
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'send' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Send Push Notification</h3>
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={sendForm.title}
                onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Body</label>
              <textarea
                value={sendForm.body}
                onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Data (JSON)
                <span className="ml-2 text-xs text-gray-500">
                  Include action: "navigate", screen: "ScreenName" for navigation
                </span>
              </label>
              <textarea
                value={sendForm.data}
                onChange={(e) => setSendForm({ ...sendForm, data: e.target.value })}
                rows={4}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
                placeholder={`{
  "action": "navigate",
  "screen": "QuizzesMain",
  "params": {}
}`}
              />
              <p className="mt-1 text-xs text-gray-500">
                Available screens: QuizzesMain, ChatScreen, FilesScreen, ProfileScreen, NotificationsScreen
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Target Audience</label>
              <select
                value={sendForm.segment}
                onChange={(e) => setSendForm({ ...sendForm, segment: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="all">All Users</option>
                <option value="active">Active Users (7 days)</option>
                <option value="inactive">Inactive Users (7+ days)</option>
                <option value="specific">Specific Users</option>
              </select>
            </div>
            
            {sendForm.segment === 'specific' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">User Emails (comma-separated)</label>
                <input
                  type="text"
                  value={sendForm.userIds}
                  onChange={(e) => setSendForm({ ...sendForm, userIds: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="user1@example.com, user2@example.com, ..."
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Schedule For (optional)</label>
              <input
                type="datetime-local"
                value={sendForm.scheduleFor}
                onChange={(e) => setSendForm({ ...sendForm, scheduleFor: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">Leave empty to send immediately</p>
            </div>
            
            <div className="pt-4">
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {sendForm.scheduleFor ? 'Schedule Notification' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Notification Templates</h3>
          
          <form onSubmit={handleCreateTemplate} className="mb-6 space-y-4 border-b pb-6">
            <h4 className="text-md font-medium text-gray-800">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={templateForm.title}
                  onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Body</label>
              <textarea
                value={templateForm.body}
                onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                rows={2}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Default Data (JSON)</label>
              <textarea
                value={templateForm.data}
                onChange={(e) => setTemplateForm({ ...templateForm, data: e.target.value })}
                rows={2}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
              {editingTemplate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTemplate(null)
                    setTemplateForm({ name: '', title: '', body: '', data: '{}' })
                  }}
                  className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{template.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">Title: {template.title}</p>
                    <p className="text-sm text-gray-600">Body: {template.body}</p>
                    {template.data && Object.keys(template.data).length > 0 && (
                      <p className="text-xs text-gray-500 mt-1 font-mono">
                        Data: {JSON.stringify(template.data)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => loadTemplateIntoSendForm(template)}
                      className="text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => {
                        setEditingTemplate(template.id)
                        setTemplateForm({
                          name: template.name,
                          title: template.title,
                          body: template.body,
                          data: JSON.stringify(template.data || {}, null, 2),
                        })
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-sm text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {templates.length === 0 && (
              <p className="text-gray-500 text-center py-4">No templates created yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Scheduled Notifications</h3>
          
          <div className="space-y-3">
            {scheduledNotifications.map((notification) => (
              <div key={notification.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {notification.custom_title || 'Untitled Notification'}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.custom_body || 'No body content'}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>Scheduled for: {new Date(notification.scheduled_for).toLocaleString()}</span>
                      <span>Segment: {notification.segment || 'all'}</span>
                      <span className={`font-medium ${
                        notification.status === 'pending' ? 'text-yellow-600' :
                        notification.status === 'sent' ? 'text-green-600' :
                        notification.status === 'failed' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {notification.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {notification.status === 'pending' && (
                    <button
                      onClick={() => handleCancelNotification(notification.id)}
                      className="text-sm text-red-600 hover:text-red-900 ml-4"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {scheduledNotifications.length === 0 && (
              <p className="text-gray-500 text-center py-4">No scheduled notifications</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stats' && stats && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Notification Statistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.total_users}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Users with Push Tokens</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.users_with_tokens}</p>
              <p className="text-sm text-gray-500 mt-1">
                ({Math.round((stats.users_with_tokens / stats.total_users) * 100)}% of total)
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Pending Notifications</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.pending_notifications}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Sent Today</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.notifications_sent_today}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-500">Sent This Week</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">{stats.notifications_sent_week}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
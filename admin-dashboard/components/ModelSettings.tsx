import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import Cookies from 'js-cookie'

interface AIModel {
  id: string
  provider: string
  model_name: string
  display_name: string
  is_active: boolean
  capabilities: {
    chat: boolean
    files: boolean
    testing: boolean  // Renamed from quiz - covers both quiz and flashcards
    vision?: boolean
  }
  cost_per_1k_tokens: number
}

interface ModelAssignment {
  feature: 'chat' | 'files' | 'testing'  // Renamed quiz to testing
  model_id: string
  is_active?: boolean
}

export default function ModelSettings() {
  const [models, setModels] = useState<AIModel[]>([])
  const [assignments, setAssignments] = useState<ModelAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [refreshInterval, setRefreshInterval] = useState(10) // minutes
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newModel, setNewModel] = useState({
    provider: '',
    model_name: '',
    display_name: '',
    api_endpoint: '',
    capabilities: {
      chat: false,
      files: false,
      testing: false,  // Renamed from quiz
      vision: false
    },
    cost_per_1k_tokens: 0,
    is_active: true
  })

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

  useEffect(() => {
    fetchData()
    
    // Set up refresh interval
    const interval = setInterval(() => {
      fetchData()
    }, refreshInterval * 60 * 1000)

    return () => clearInterval(interval)
  }, [refreshInterval])

  const fetchData = async () => {
    try {
      const token = Cookies.get('adminToken')
      const headers = { Authorization: `Bearer ${token}` }

      const [modelsRes, assignmentsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/models`, { headers }),
        axios.get(`${API_URL}/admin/models/assignments`, { headers })
      ])

      setModels(modelsRes.data.models)
      
      // Ensure we have assignments for all features
      const existingAssignments = assignmentsRes.data.assignments
      const allFeatures = ['chat', 'files', 'testing']  // Renamed quiz to testing
      const completeAssignments = allFeatures.map(feature => {
        const existing = existingAssignments.find((a: ModelAssignment) => a.feature === feature)
        return existing || { feature, model_id: '', is_active: true }
      })
      
      setAssignments(completeAssignments)
      setLastRefresh(new Date())
    } catch {
      toast.error('Failed to fetch model data')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignmentChange = (feature: string, modelId: string) => {
    setAssignments(prev => {
      const updated = prev.map(a => 
        a.feature === feature ? { ...a, model_id: modelId } : a
      )
      // If assignment doesn't exist, add it
      if (!updated.find(a => a.feature === feature)) {
        updated.push({ feature: feature as 'chat' | 'files' | 'testing', model_id: modelId, is_active: true })
      }
      return updated
    })
  }

  const saveAssignments = async () => {
    setSaving(true)
    try {
      const token = Cookies.get('adminToken')
      
      // Save each assignment individually
      for (const assignment of assignments) {
        await axios.put(
          `${API_URL}/admin/models/assignments/${assignment.feature}`,
          { modelId: assignment.model_id },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }
      
      toast.success('Model assignments saved successfully!')
      
      // Refresh data
      await fetchData()
    } catch {
      toast.error('Failed to save assignments')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteModel = async (model: AIModel) => {
    if (!confirm(`Delete "${model.display_name}"? This cannot be undone.`)) return
    setDeletingId(model.id)
    try {
      const token = Cookies.get('adminToken')
      await axios.delete(`${API_URL}/admin/models/${model.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success(`${model.display_name} deleted`)
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete model')
    } finally {
      setDeletingId(null)
    }
  }

  const handleAddModel = async () => {
    try {
      const token = Cookies.get('adminToken')
      await axios.post(
        `${API_URL}/admin/models`,
        newModel,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      toast.success('Model added successfully!')
      setShowAddForm(false)
      setNewModel({
        provider: '',
        model_name: '',
        display_name: '',
        api_endpoint: '',
        capabilities: {
          chat: false,
          files: false,
          testing: false,  // Renamed from quiz
          vision: false
        },
        cost_per_1k_tokens: 0,
        is_active: true
      })
      
      // Refresh the models list
      fetchData()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to add model')
    }
  }

  if (loading) {
    return <div className="animate-pulse">Loading model settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">AI Model Assignments</h2>
        
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Fallback Model:</strong> If any model fails, the system will automatically fallback to <strong>GPT-4.1 Nano</strong> to ensure uninterrupted service.
          </p>
        </div>
        
        <div className="space-y-4">
          {['chat', 'files', 'testing'].map((feature) => {
            const assignment = assignments.find(a => a.feature === feature)
            const selectedModel = models.find(m => m.id === assignment?.model_id)
            
            return (
              <div key={feature} className="flex items-center justify-between">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 capitalize">
                    {feature === 'testing' ? 'Testing (Quiz & Flashcards)' : feature} Model
                  </label>
                  <select
                    value={assignment?.model_id || ''}
                    onChange={(e) => handleAssignmentChange(feature, e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="">Select a model</option>
                    {models
                      .filter(m => m.is_active && m.capabilities[feature as keyof typeof m.capabilities])
                      .map(model => (
                        <option key={model.id} value={model.id}>
                          {model.display_name} ({model.provider}) - ${model.cost_per_1k_tokens}/1k tokens
                        </option>
                      ))}
                  </select>
                  {selectedModel && (
                    <p className="mt-1 text-xs text-gray-500">
                      Current cost: ${selectedModel.cost_per_1k_tokens} per 1k tokens
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={saveAssignments}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Assignments'}
          </button>
          
          <div className="text-sm text-gray-500">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Refresh Settings</h3>
        
        <div className="flex items-center space-x-4">
          <label className="block text-sm font-medium text-gray-700">
            Auto-refresh interval (minutes):
          </label>
          <input
            type="number"
            min="1"
            max="60"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
            className="block w-20 px-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          />
          <button
            onClick={fetchData}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Refresh Now
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Available Models</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add New Model
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 p-4 border-2 border-indigo-500 rounded-lg bg-indigo-50">
            <h4 className="text-lg font-semibold mb-4">Add New AI Model</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Provider</label>
                <select
                  value={newModel.provider}
                  onChange={(e) => setNewModel({...newModel, provider: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select provider</option>
                  <option value="openai">OpenAI</option>
                  <option value="google">Google</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Model Name</label>
                <input
                  type="text"
                  value={newModel.model_name}
                  onChange={(e) => setNewModel({...newModel, model_name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="e.g., gpt-4-turbo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={newModel.display_name}
                  onChange={(e) => setNewModel({...newModel, display_name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="e.g., GPT-4 Turbo"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">API Endpoint (Optional)</label>
                <input
                  type="text"
                  value={newModel.api_endpoint}
                  onChange={(e) => setNewModel({...newModel, api_endpoint: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Custom API endpoint"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Cost per 1k tokens ($)</label>
                <input
                  type="number"
                  step="0.001"
                  value={newModel.cost_per_1k_tokens}
                  onChange={(e) => setNewModel({...newModel, cost_per_1k_tokens: parseFloat(e.target.value) || 0})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Capabilities</label>
                <div className="space-y-2">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={newModel.capabilities.chat}
                      onChange={(e) => setNewModel({...newModel, capabilities: {...newModel.capabilities, chat: e.target.checked}})}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm">Chat</span>
                  </label>
                  <label className="inline-flex items-center ml-4">
                    <input
                      type="checkbox"
                      checked={newModel.capabilities.files}
                      onChange={(e) => setNewModel({...newModel, capabilities: {...newModel.capabilities, files: e.target.checked}})}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm">Files</span>
                  </label>
                  <label className="inline-flex items-center ml-4">
                    <input
                      type="checkbox"
                      checked={newModel.capabilities.testing}
                      onChange={(e) => setNewModel({...newModel, capabilities: {...newModel.capabilities, testing: e.target.checked}})}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm">Testing (Quiz & Flashcards)</span>
                  </label>
                  <label className="inline-flex items-center ml-4">
                    <input
                      type="checkbox"
                      checked={newModel.capabilities.vision}
                      onChange={(e) => setNewModel({...newModel, capabilities: {...newModel.capabilities, vision: e.target.checked}})}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm">Vision</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={handleAddModel}
                disabled={!newModel.provider || !newModel.model_name || !newModel.display_name}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Model
              </button>
            </div>
          </div>
        )}
        
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capabilities
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost/1k tokens
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.map((model) => (
                <tr key={model.id} className={model.model_name === 'gpt-4.1-nano' ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {model.display_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      model.provider === 'openai' ? 'bg-blue-100 text-blue-800' :
                      model.provider === 'google' ? 'bg-green-100 text-green-800' :
                      model.provider === 'openrouter' ? 'bg-purple-100 text-purple-800' :
                      model.provider === 'anthropic' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {model.provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      {model.capabilities.chat && <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">Chat</span>}
                      {model.capabilities.files && <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Files</span>}
                      {model.capabilities.testing && <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">Testing</span>}
                      {model.capabilities.vision && <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Vision</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${model.cost_per_1k_tokens}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      model.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {model.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleDeleteModel(model)}
                      disabled={deletingId === model.id}
                      className="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50"
                    >
                      {deletingId === model.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
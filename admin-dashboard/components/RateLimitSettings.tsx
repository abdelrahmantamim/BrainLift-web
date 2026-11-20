import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

interface RateLimit {
  id: string;
  endpoint_pattern: string;
  endpoint_name: string;
  description?: string;
  window_ms: number;
  max_requests: number;
  message: string;
  skip_successful_requests: boolean;
  skip_failed_requests: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EditingRateLimit extends Partial<RateLimit> {
  id?: string;
}

const RateLimitSettings: React.FC = () => {
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditingRateLimit>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [isResettingUser, setIsResettingUser] = useState(false);
  const [newRateLimit, setNewRateLimit] = useState<EditingRateLimit>({
    endpoint_pattern: '',
    endpoint_name: '',
    description: '',
    window_ms: 900000, // 15 minutes
    max_requests: 100,
    message: 'Too many requests, please try again later.',
    skip_successful_requests: false,
    skip_failed_requests: false,
    is_active: true
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  // Format milliseconds to human-readable time
  const formatTime = (ms: number): string => {
    if (ms < 60000) return `${ms / 1000}s`;
    if (ms < 3600000) return `${ms / 60000}m`;
    return `${ms / 3600000}h`;
  };


  useEffect(() => {
    fetchRateLimits();
  }, []);

  const fetchRateLimits = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('adminToken='))
        ?.split('=')[1];

      const response = await axios.get(`${API_URL}/admin/rate-limits`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setRateLimits(response.data.rateLimits);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching rate limits:', error);
      toast.error('Failed to load rate limits');
      setLoading(false);
    }
  };

  const handleEdit = (rateLimit: RateLimit) => {
    setEditingId(rateLimit.id);
    setEditForm({
      ...rateLimit,
      window_ms: rateLimit.window_ms
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleUpdate = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('adminToken='))
        ?.split('=')[1];

      await axios.put(
        `${API_URL}/admin/rate-limits/${editingId}`,
        {
          windowMinutes: editForm.window_ms ? editForm.window_ms / 60000 : 15,
          maxRequests: editForm.max_requests || 100,
          message: editForm.message
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Rate limit updated successfully');
      setEditingId(null);
      fetchRateLimits();
    } catch (error) {
      console.error('Error updating rate limit:', error);
      toast.error('Failed to update rate limit');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('adminToken='))
        ?.split('=')[1];

      await axios.patch(
        `${API_URL}/admin/rate-limits/${id}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Rate limit toggled successfully');
      fetchRateLimits();
    } catch (error) {
      console.error('Error toggling rate limit:', error);
      toast.error('Failed to toggle rate limit');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate limit?')) return;

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('adminToken='))
        ?.split('=')[1];

      await axios.delete(
        `${API_URL}/admin/rate-limits/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Rate limit deleted successfully');
      fetchRateLimits();
    } catch (error) {
      console.error('Error deleting rate limit:', error);
      toast.error('Failed to delete rate limit');
    }
  };

  const handleAdd = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('adminToken='))
        ?.split('=')[1];

      await axios.post(
        `${API_URL}/admin/rate-limits`,
        newRateLimit,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Rate limit created successfully');
      setShowAddForm(false);
      setNewRateLimit({
        endpoint_pattern: '',
        endpoint_name: '',
        description: '',
        window_ms: 900000,
        max_requests: 100,
        message: 'Too many requests, please try again later.',
        skip_successful_requests: false,
        skip_failed_requests: false,
        is_active: true
      });
      fetchRateLimits();
    } catch (error: any) {
      console.error('Error creating rate limit:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to create rate limit');
    }
  };

  const handleReload = async () => {
    try {
      await fetchRateLimits();
      toast.success('Rate limits reloaded successfully');
    } catch (error) {
      console.error('Error reloading rate limits:', error);
      toast.error('Failed to reload rate limits');
    }
  };

  const handleResetUser = async () => {
    if (!resetIdentifier.trim()) {
      toast.error('Please enter an email, user ID, or IP address');
      return;
    }
    setIsResettingUser(true);
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('adminToken='))
        ?.split('=')[1];

      const response = await axios.post(
        `${API_URL}/admin/rate-limits/reset-user`,
        { identifier: resetIdentifier.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(response.data.message || 'Rate limits reset successfully');
      setResetIdentifier('');
    } catch (error: any) {
      console.error('Error resetting user rate limits:', error);
      toast.error(error.response?.data?.error || 'Failed to reset user rate limits');
    } finally {
      setIsResettingUser(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">Loading rate limits...</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Rate Limit Configuration</h2>
        <div className="space-x-2">
          <button
            onClick={handleReload}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Force Reload
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Add New Rate Limit
          </button>
        </div>
      </div>

      {/* Reset User Rate Limits */}
      <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">Reset User Rate Limits</h3>
        <p className="text-xs text-yellow-700 mb-3">
          Unblock a rate-limited user by entering their email, user ID, or IP address.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={resetIdentifier}
            onChange={(e) => setResetIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResetUser()}
            placeholder="Email, User ID, or IP address"
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <button
            onClick={handleResetUser}
            disabled={isResettingUser || !resetIdentifier.trim()}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isResettingUser ? 'Resetting...' : 'Reset Limits'}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="mb-6 p-4 border-2 border-indigo-500 rounded-lg bg-indigo-50">
          <h3 className="text-lg font-semibold mb-4">Add New Rate Limit</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Endpoint Pattern</label>
              <input
                type="text"
                value={newRateLimit.endpoint_pattern || ''}
                onChange={(e) => setNewRateLimit({...newRateLimit, endpoint_pattern: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="/api/example/*"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={newRateLimit.endpoint_name || ''}
                onChange={(e) => setNewRateLimit({...newRateLimit, endpoint_name: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Example Endpoint"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={newRateLimit.description || ''}
                onChange={(e) => setNewRateLimit({...newRateLimit, description: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Time Window</label>
              <select
                value={newRateLimit.window_ms}
                onChange={(e) => setNewRateLimit({...newRateLimit, window_ms: parseInt(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
                <option value={900000}>15 minutes</option>
                <option value={3600000}>1 hour</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Requests</label>
              <input
                type="number"
                value={newRateLimit.max_requests || ''}
                onChange={(e) => setNewRateLimit({...newRateLimit, max_requests: parseInt(e.target.value)})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                min="1"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Error Message</label>
              <input
                type="text"
                value={newRateLimit.message || ''}
                onChange={(e) => setNewRateLimit({...newRateLimit, message: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newRateLimit.skip_successful_requests || false}
                  onChange={(e) => setNewRateLimit({...newRateLimit, skip_successful_requests: e.target.checked})}
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Skip successful requests</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newRateLimit.skip_failed_requests || false}
                  onChange={(e) => setNewRateLimit({...newRateLimit, skip_failed_requests: e.target.checked})}
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">Skip failed requests</span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newRateLimit.endpoint_pattern || !newRateLimit.endpoint_name}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Rate Limit
            </button>
          </div>
        </div>
      )}

      {/* Rate Limits Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Endpoint
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Window
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Max Requests
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
            {rateLimits.map((rateLimit) => (
              <tr key={rateLimit.id}>
                {editingId === rateLimit.id ? (
                  <>
                    <td className="px-6 py-4">
                      <div className="space-y-2 min-w-[250px]">
                        <input
                          type="text"
                          value={editForm.endpoint_pattern || ''}
                          onChange={(e) => setEditForm({...editForm, endpoint_pattern: e.target.value})}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Endpoint pattern"
                        />
                        <input
                          type="text"
                          value={editForm.endpoint_name || ''}
                          onChange={(e) => setEditForm({...editForm, endpoint_name: e.target.value})}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          placeholder="Name"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={editForm.window_ms}
                        onChange={(e) => setEditForm({...editForm, window_ms: parseInt(e.target.value)})}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value={60000}>1m</option>
                        <option value={300000}>5m</option>
                        <option value={900000}>15m</option>
                        <option value={3600000}>1h</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={editForm.max_requests || ''}
                        onChange={(e) => setEditForm({...editForm, max_requests: parseInt(e.target.value)})}
                        className="block w-full max-w-[100px] rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        min="1"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        rateLimit.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {rateLimit.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleUpdate}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{rateLimit.endpoint_pattern}</div>
                      <div className="text-sm text-gray-500">{rateLimit.endpoint_name}</div>
                      {rateLimit.description && (
                        <div className="text-xs text-gray-400">{rateLimit.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(rateLimit.window_ms)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rateLimit.max_requests}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        rateLimit.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {rateLimit.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(rateLimit)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggle(rateLimit.id)}
                        className="text-yellow-600 hover:text-yellow-900 mr-3"
                      >
                        Toggle
                      </button>
                      <button
                        onClick={() => handleDelete(rateLimit.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Additional Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Pattern Examples:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <code>/api/auth/login</code> - Exact match</li>
          <li>• <code>/api/auth/*</code> - All auth endpoints</li>
          <li>• <code>/api/*</code> - All API endpoints</li>
          <li>• <code>/api/chat/message:authenticated</code> - Only for authenticated users</li>
        </ul>
      </div>
    </div>
  );
};

export default RateLimitSettings;
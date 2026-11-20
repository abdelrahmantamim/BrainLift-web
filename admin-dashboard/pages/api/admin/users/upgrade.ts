import type { NextApiRequest, NextApiResponse } from 'next'

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { userId, tier, duration, action } = req.body

  if (!userId || !tier) {
    return res.status(400).json({ error: 'UserId and tier are required' })
  }

  if (!['free', 'premium', 'ultra'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier. Must be "free", "premium", or "ultra"' })
  }

  if (tier !== 'free' && !duration) {
    return res.status(400).json({ error: 'Duration is required for paid tiers' })
  }

  try {
    const response = await fetch(`${API_BASE_URL}/admin/users/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${req.headers.authorization?.replace('Bearer ', '') || req.cookies.adminToken || ''}`
      },
      body: JSON.stringify({
        userId,
        tier,
        duration,
        action: action || 'set'
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      return res.status(response.status).json({ error: errorData.error || 'Failed to update user tier' })
    }

    const result = await response.json()
    res.status(200).json(result)

  } catch (error) {
    console.error('Admin user upgrade error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

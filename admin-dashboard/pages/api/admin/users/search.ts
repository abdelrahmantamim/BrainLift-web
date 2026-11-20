import type { NextApiRequest, NextApiResponse } from 'next'

// This should be replaced with your actual database connection
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, userId } = req.query

  if (!email && !userId) {
    return res.status(400).json({ error: 'Email or userId is required' })
  }

  try {
    // Call your server's admin endpoint to search for users
    const searchParam = email ? `email=${encodeURIComponent(email as string)}` : `userId=${encodeURIComponent(userId as string)}`
    
    const response = await fetch(`${API_BASE_URL}/admin/users/search?${searchParam}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Add admin authentication header if needed
        'Authorization': `Bearer ${req.headers.authorization?.replace('Bearer ', '') || req.cookies.adminToken || ''}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return res.status(response.status).json({ error: errorData.error || 'Failed to search user' })
    }

    const userData = await response.json()
    res.status(200).json(userData)

  } catch (error) {
    console.error('Admin user search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
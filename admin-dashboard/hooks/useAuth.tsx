import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import Cookies from 'js-cookie'

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

  useEffect(() => {
    checkAuth()
    
    // Setup axios interceptor for auto token refresh
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          
          const token = Cookies.get('adminToken')
          if (token) {
            try {
              const refreshResponse = await axios.post(`${API_URL}/admin/auth/refresh`)
              if (refreshResponse.data.success) {
                const newToken = refreshResponse.data.token
                Cookies.set('adminToken', newToken, { expires: 7, sameSite: 'strict', secure: window.location.protocol === 'https:' })
                axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`
                setUser(refreshResponse.data.user)
                return axios(originalRequest)
              }
            } catch (refreshError) {
              // Refresh failed
              logout()
            }
          }
        }
        
        return Promise.reject(error)
      }
    )
    
    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor)
    }
  }, [])

  const checkAuth = async () => {
    try {
      const token = Cookies.get('adminToken')
      if (!token) {
        setLoading(false)
        return
      }

      // Try to get user from cookie first for faster load
      const userCookie = Cookies.get('adminUser')
      if (userCookie) {
        try {
          setUser(JSON.parse(userCookie))
        } catch (e) {
          // Invalid cookie data
        }
      }

      // Set axios defaults for all requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.get(`${API_URL}/admin/auth/check`)

      if (response.data.success) {
        setUser(response.data.user)
        // Update user cookie with fresh data
        Cookies.set('adminUser', JSON.stringify(response.data.user), { expires: 7, sameSite: 'strict', secure: window.location.protocol === 'https:' })
      }
    } catch (error) {
      Cookies.remove('adminToken')
      Cookies.remove('adminUser')
      delete axios.defaults.headers.common['Authorization']
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/admin/auth/login`, {
        email,
        password
      })

      const { user, token } = response.data
      
      // Store token and user data in cookies
      Cookies.set('adminToken', token, { expires: 7, sameSite: 'strict', secure: window.location.protocol === 'https:' })
      Cookies.set('adminUser', JSON.stringify(user), { expires: 7, sameSite: 'strict', secure: window.location.protocol === 'https:' })
      setUser(user)
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } catch (error: any) {
      throw new Error(error.response?.data?.error?.message || 'Login failed')
    }
  }

  const logout = () => {
    Cookies.remove('adminToken')
    Cookies.remove('adminUser')
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
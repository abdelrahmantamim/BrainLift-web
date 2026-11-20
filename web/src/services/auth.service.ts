import { authClient } from '@/lib/auth-client';
import { USER_KEY, TOKEN_KEY, API_BASE_URL } from '@/config/constants';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  username?: string;
  studentType: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  studentType?: string;
  student_type?: string;
  avatarUrl?: string;
  avatar_url?: string;
  chat_background?: string;
  chat_background_url?: string;
  createdAt: string;
  emailVerified?: boolean;
}

export interface AuthResponse {
  user: User;
  session: {
    id: string;
    userId: string;
    expiresAt: string;
  };
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Direct API call since Better Auth client isn't respecting baseURL
    const response = await fetch(`${API_BASE_URL}/auth/sign-in/email`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Login failed');
    }

    const data = await response.json();

    // Check if the response has the expected structure
    if (!data.user || !data.token) {
      throw new Error('Invalid response format from server');
    }

    // Better Auth returns token, not session object
    const authResponse: AuthResponse = {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name || '',
        username: data.user.name || data.user.email.split('@')[0],
        studentType: data.user.studentType,
        student_type: data.user.studentType || data.user.student_type,
        avatarUrl: data.user.avatarUrl,
        avatar_url: data.user.avatarUrl || data.user.avatar_url,
        createdAt: data.user.createdAt,
        emailVerified: data.user.emailVerified || false,
      },
      session: {
        id: data.token, // Use token as session ID
        userId: data.user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      },
    };

    // Store user and token in localStorage
    localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    localStorage.setItem(TOKEN_KEY, data.token);

    return authResponse;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    // Use Better Auth client
    const { data: authData, error } = await authClient.signUp.email({
      email: data.email,
      password: data.password,
      name: data.name || data.username || data.email.split('@')[0],
      studentType: data.studentType,
    });

    if (error) {
      throw new Error(error.message || 'Registration failed');
    }

    if (!authData) {
      throw new Error('Registration failed - no data returned');
    }

    const authResponse: AuthResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.name || '',
        username: authData.user.name || authData.user.email.split('@')[0],
        studentType: (authData.user as unknown as { studentType?: string }).studentType,
        avatarUrl: (authData.user as unknown as { avatarUrl?: string }).avatarUrl,
        createdAt: authData.user.createdAt.toISOString(),
        emailVerified: authData.user.emailVerified || false,
      },
      session: {
        id: (authData as { session?: { id: string; userId: string; expiresAt: string }; token?: string }).session?.id || (authData as { token?: string }).token || 'session',
        userId: (authData as { session?: { userId: string } }).session?.userId || authData.user.id,
        expiresAt: (authData as { session?: { expiresAt: string } }).session?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };

    // Store user and token in localStorage
    localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    // For registration, extract token from the response structure
    const token = (authData as { session?: { id: string; userId: string; expiresAt: string }; token?: string }).token || (authData as { session?: { token?: string } }).session?.token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }

    return authResponse;
  }

  async logout(): Promise<void> {
    try {
      await authClient.signOut();
    } catch {
      // Ignore errors during logout
    } finally {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      // Don't do a hard redirect — let the store + router handle navigation
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/forget-password`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to send reset email');
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        newPassword: password,
        token,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to reset password');
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
    });

    if (error) {
      throw new Error(error.message || 'Failed to change password');
    }
  }

  async uploadAvatar(base64Image: string): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/user/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ avatarUrl: base64Image }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to upload avatar');
    }
  }

  async uploadChatBackground(base64Image: string): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/user/chat-background`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ background: base64Image }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload chat background');
    }
  }

  async removeChatBackground(): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/user/chat-background`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ background: null }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove chat background');
    }
  }

  async getSession(): Promise<AuthResponse | null> {
    try {
      // First check if we have a token and user in localStorage
      const token = this.getToken();
      const user = this.getCurrentUser();

      if (!token || !user) {
        return null;
      }

      // Verify the token is still valid by making a request to get session
      const response = await fetch(`${API_BASE_URL}/auth/get-session`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Token is invalid, clear it
        this.clearToken();
        return null;
      }

      const sessionData = await response.json();

      // Return the stored user data with session info
      const authResponse: AuthResponse = {
        user: user,
        session: {
          id: token,
          userId: user.id,
          expiresAt: sessionData.session?.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };

      return authResponse;
    } catch (error) {
      console.error('Error getting session:', error);
      // On error, clear the token and return null
      this.clearToken();
      return null;
    }
  }

  /**
   * Refresh the session by calling the extend-session endpoint.
   * Returns the new token on success, or null on failure.
   */
  async refreshSession(): Promise<string | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/session/extend-session`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const newToken = data.token || data.session?.token;

      if (newToken) {
        localStorage.setItem(TOKEN_KEY, newToken);
        // Update user data if provided
        if (data.user) {
          const user: User = {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || '',
            username: data.user.name || data.user.email.split('@')[0],
            studentType: data.user.studentType,
            student_type: data.user.studentType || data.user.student_type,
            avatarUrl: data.user.avatarUrl,
            avatar_url: data.user.avatarUrl || data.user.avatar_url,
            chat_background: data.user.chat_background_url || data.user.chat_background,
            chat_background_url: data.user.chat_background_url || data.user.chat_background,
            createdAt: data.user.createdAt,
            emailVerified: data.user.emailVerified || false,
          };
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        }
        return newToken;
      }

      return null;
    } catch {
      return null;
    }
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session && !!session.user;
  }
}

export const authService = new AuthService();

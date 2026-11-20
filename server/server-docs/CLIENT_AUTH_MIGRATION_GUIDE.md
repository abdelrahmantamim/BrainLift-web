# Client Authentication Migration Guide

This guide explains how to update web and mobile applications to use the new Better Auth native endpoints.

## Authentication Endpoints

### Old Endpoints (Deprecated)
- Register: `POST /api/auth/register`
- Login: `POST /api/auth/login`
- Refresh: `POST /api/auth/refresh-token`
- Logout: `POST /api/auth/logout`

### New Better Auth Endpoints
- Sign Up: `POST /api/auth/sign-up/email`
- Sign In: `POST /api/auth/sign-in/email`
- Get Session: `GET /api/auth/get-session`
- Sign Out: `POST /api/auth/sign-out`

## Request/Response Format Changes

### Sign Up (Register)

**Old Format:**
```javascript
// Request
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "username": "username"
}

// Response
{
  "user": { "id": "...", "email": "..." },
  "token": "jwt-token",
  "refreshToken": "refresh-token"
}
```

**New Format:**
```javascript
// Request
POST /api/auth/sign-up/email
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "User Name"  // Note: 'name' instead of 'username'
}

// Response
{
  "token": "session-token",  // This is a session token, not JWT
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "emailVerified": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Sign In (Login)

**Old Format:**
```javascript
// Request
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}

// Response
{
  "user": { "id": "...", "email": "..." },
  "token": "jwt-token",
  "refreshToken": "refresh-token"
}
```

**New Format:**
```javascript
// Request
POST /api/auth/sign-in/email
{
  "email": "user@example.com",
  "password": "password"
}

// Response
{
  "token": "session-token",
  "redirect": false,
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "emailVerified": false,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

## Token Handling

### Key Differences

1. **Token Type**: Better Auth returns session tokens, not JWTs
2. **No Refresh Token**: Better Auth manages session refresh automatically
3. **Token Usage**: Use the token as Bearer token or cookie

### Web Application

```javascript
// Store token after login/signup
localStorage.setItem('auth-token', response.token);

// Use token in requests
fetch('/api/user/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
  }
});

// Or use cookies (recommended)
document.cookie = `better-auth.session_token=${response.token}; path=/`;
```

### Mobile Application (React Native)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Store token
await AsyncStorage.setItem('auth-token', response.token);

// Use token in requests
const token = await AsyncStorage.getItem('auth-token');
fetch(API_URL + '/user/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Authentication Service Updates

### Web Auth Service Example

```javascript
class AuthService {
  async signUp(email, password, name) {
    const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    
    const data = await response.json();
    if (response.ok) {
      // Store token
      localStorage.setItem('auth-token', data.token);
      return data;
    }
    throw new Error(data.error?.message || 'Sign up failed');
  }
  
  async signIn(email, password) {
    const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('auth-token', data.token);
      return data;
    }
    throw new Error(data.error?.message || 'Sign in failed');
  }
  
  async signOut() {
    const token = localStorage.getItem('auth-token');
    await fetch(`${API_URL}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    localStorage.removeItem('auth-token');
  }
  
  getToken() {
    return localStorage.getItem('auth-token');
  }
  
  isAuthenticated() {
    return !!this.getToken();
  }
}
```

### Mobile Auth Service Example (React Native)

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  async signUp(email, password, name) {
    const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    
    const data = await response.json();
    if (response.ok) {
      await AsyncStorage.setItem('auth-token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      return data;
    }
    throw new Error(data.error?.message || 'Sign up failed');
  }
  
  async signIn(email, password) {
    const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (response.ok) {
      await AsyncStorage.setItem('auth-token', data.token);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      return data;
    }
    throw new Error(data.error?.message || 'Sign in failed');
  }
  
  async signOut() {
    const token = await AsyncStorage.getItem('auth-token');
    if (token) {
      await fetch(`${API_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    }
    await AsyncStorage.multiRemove(['auth-token', 'user']);
  }
  
  async getToken() {
    return await AsyncStorage.getItem('auth-token');
  }
  
  async getUser() {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  
  async isAuthenticated() {
    const token = await this.getToken();
    return !!token;
  }
}
```

## Axios Interceptor Updates

```javascript
// Request interceptor
axios.interceptors.request.use(
  async (config) => {
    const token = await AuthService.getToken(); // Use appropriate method
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AuthService.signOut();
      // Redirect to login
      window.location.href = '/login'; // Web
      // Or navigate to login screen in mobile
    }
    return Promise.reject(error);
  }
);
```

## OAuth Updates

### Old OAuth Flow
- Google: `/api/auth/google`
- Apple: `/api/auth/apple`
- Callback: `/api/auth/callback/:provider`

### New OAuth Flow
- Google: `/api/auth/sign-in/google`
- Apple: `/api/auth/sign-in/apple`
- Facebook: `/api/auth/sign-in/facebook`
- GitHub: `/api/auth/sign-in/github`

The OAuth flow returns the same response format as email sign-in.

## Migration Checklist

- [ ] Update sign-up endpoint from `/api/auth/register` to `/api/auth/sign-up/email`
- [ ] Update sign-in endpoint from `/api/auth/login` to `/api/auth/sign-in/email`
- [ ] Change `username` field to `name` in sign-up requests
- [ ] Remove refresh token handling (Better Auth manages sessions automatically)
- [ ] Update token storage to use session tokens instead of JWTs
- [ ] Update OAuth endpoints to new format
- [ ] Remove any JWT decoding logic (session tokens are opaque)
- [ ] Update error handling to use Better Auth error format
- [ ] Test authentication flow end-to-end

## Error Handling

Better Auth returns errors in this format:
```json
{
  "error": {
    "message": "Error message here"
  }
}
```

Update your error handling accordingly.

## Notes

1. **Session Duration**: Default session duration is 7 days
2. **Auto Refresh**: Sessions are automatically refreshed when used
3. **No Manual Refresh**: No need to implement token refresh logic
4. **Cookie Support**: Better Auth supports both cookie and header-based auth
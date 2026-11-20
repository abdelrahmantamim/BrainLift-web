# Better Auth Session Management Guide

## Overview
Better Auth uses server-side sessions instead of JWT refresh tokens. This guide explains how session management works and how to handle session expiry in the mobile app.

## Key Differences from JWT

1. **No Refresh Tokens**: Better Auth sessions don't have refresh tokens. Sessions are extended automatically on use.
2. **Server-Side Storage**: Sessions are stored in the database, not just in the client.
3. **Fixed Expiry**: Sessions expire after 7 days (configurable) regardless of activity.

## Session Management

### Session Extension
Sessions are automatically extended when used. The `/api/auth/extend-session` endpoint can be called to:
- Check if session is still valid
- Get updated session expiry time
- Trigger session extension

### Handling Session Expiry

When a session expires:
1. API calls return 401 Unauthorized
2. The app clears stored auth data
3. User is redirected to login screen
4. No infinite loading states

### Implementation Details

#### Server Side
- Session configuration in `better-auth-minimal.js`:
  ```javascript
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60, // Update if older than 24 hours
  }
  ```

#### Mobile App
- API interceptor handles 401 errors
- AuthContext manages auth state transitions
- No token refresh attempts for Better Auth sessions

### Best Practices

1. **Don't attempt token refresh** - Better Auth sessions don't support it
2. **Handle 401 gracefully** - Clear auth and redirect to login
3. **Use session info endpoint** to check session validity proactively
4. **Avoid loading states** during auth failures - fail fast

## Troubleshooting

### App stuck in loading state
- Check if token refresh is being attempted
- Ensure 401 errors clear auth state immediately
- Verify auth state handler is called only once

### Session expires too quickly
- Check server session configuration
- Verify session is being extended on API calls
- Use longer session expiry for mobile apps
# Better-Auth Migration Guide

## Current Status

We have a hybrid setup that allows both Better-Auth and the existing JWT authentication to work side by side:

- **Better-Auth endpoints**: `/api/auth/*`
- **Legacy JWT endpoints**: `/api/auth-legacy/*`
- **Protected routes**: Still using existing JWT middleware

## Running the Hybrid Server

```bash
# With Better-Auth (recommended)
node server-better-auth-hybrid.js

# Original server (fallback)
node server.js
```

## Authentication Endpoints

### Better-Auth (New)
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout
- `GET /api/auth/session` - Get current session
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Legacy JWT (Current App)
- `POST /api/auth-legacy/register` - Register new user
- `POST /api/auth-legacy/login` - Login
- `POST /api/auth-legacy/refresh-token` - Refresh JWT token
- `POST /api/auth-legacy/logout` - Logout

## Migration Strategy

### Phase 1: Parallel Operation (Current)
- Both authentication systems run side by side
- Existing app continues to use JWT auth
- New features can use Better-Auth

### Phase 2: Gradual Migration
1. Update mobile app to support Better-Auth endpoints
2. Add Better-Auth session checks to middleware
3. Migrate user data to Better-Auth tables
4. Update endpoints one by one

### Phase 3: Full Migration
1. Replace all JWT authentication with Better-Auth
2. Remove legacy auth endpoints
3. Update all middleware to use Better-Auth

## Environment Variables

### Required for Better-Auth
```env
# Database connection (required)
DATABASE_URL=postgres://...

# Better-Auth secret (optional, falls back to JWT_SECRET)
BETTER_AUTH_SECRET=your-secret-here

# Social login (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...
FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
```

### Existing Variables (still used)
```env
JWT_SECRET=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

## Testing Better-Auth

### Register a new user
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Get session
```bash
curl http://localhost:3001/api/auth/session \
  -H "Cookie: [session-cookie-from-login]"
```

## Middleware Updates

To use Better-Auth in your routes, you'll need to update the middleware:

```javascript
// Current (JWT)
app.use('/api/route', requireAuth, router);

// Future (Better-Auth)
app.use('/api/route', betterAuthMiddleware, router);
```

## Mobile App Updates

The mobile app will need updates to use Better-Auth:

1. Update auth context to use Better-Auth endpoints
2. Handle session cookies instead of JWT tokens
3. Add social login buttons for Google/Apple/Facebook
4. Update token refresh logic to use sessions

## Benefits of Migration

1. **Automatic session management** - No manual token refresh
2. **Social login support** - Google, Apple, Facebook
3. **Better security** - Built-in CSRF protection, secure sessions
4. **TypeScript support** - Full type safety
5. **Modern architecture** - Works with any framework
6. **Built-in features** - 2FA, magic links, admin panel

## Troubleshooting

### Better-Auth not working
1. Check DATABASE_URL is set correctly
2. Ensure PostgreSQL is accessible
3. Check server logs for connection errors

### Module errors
- Use `server-better-auth-hybrid.js` which handles CommonJS compatibility
- Don't use `"type": "module"` in package.json

### Authentication failures
- Existing users still use JWT auth at `/api/auth-legacy/*`
- New Better-Auth users use `/api/auth/*`
- Sessions are not shared between systems
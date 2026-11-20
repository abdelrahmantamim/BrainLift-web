# Authentication System Cleanup Plan

## Current State Analysis

### What We Have:
1. **server.js** - Still using JWT auth routes
2. **server-final.js** - Custom implementation mimicking Better Auth (but not using the library)
3. **server-better-auth.js** - Proper Better Auth implementation (ES modules)
4. **Multiple auth middlewares** - Mix of JWT and Better Auth

### Decision: Use Better Auth Properly

Since you've confirmed Better Auth is your main authentication system, here's the cleanup plan:

## Files to Keep (Better Auth):
```
✅ /config/better-auth.config.js (ES modules version)
✅ /config/better-auth-config.cjs (CommonJS version)
✅ /middleware/better-auth.middleware.js
✅ /routes/better-auth.routes.js
✅ /server-better-auth.js (main server)
```

## Files to Archive:

### JWT Legacy Files:
```
❌ /config/jwt.config.js → /archived/jwt-legacy-auth/config/
❌ /routes/auth.routes.js → /archived/jwt-legacy-auth/routes/
❌ /middleware/auth.middleware.js → /archived/auth-migration-hybrid/middleware/
```

### Hybrid/Transitional Files:
```
❌ /server-final.js → /archived/auth-migration-hybrid/server-variants/
❌ /server.js → /archived/jwt-legacy-auth/server-variants/
❌ /middleware/auth-simple.js → /archived/auth-migration-hybrid/middleware/
❌ /middleware/auth-better.js → /archived/auth-migration-hybrid/middleware/
```

### Migration Scripts:
```
❌ /scripts/*better-auth*.js → /archived/auth-migration-scripts/
❌ /scripts/migrate-*.js → /archived/auth-migration-scripts/
```

## Action Steps:

1. **Archive old files** (preserving them for reference)
2. **Update package.json** to use server-better-auth.js
3. **Update all route imports** to use Better Auth middleware
4. **Test authentication flows**

## Migration Notes:

### For Admin Dashboard:
The admin dashboard still uses JWT. Options:
1. Keep JWT for admin only (separate auth system)
2. Migrate admin to Better Auth (recommended)

### Database:
- Better Auth tables are already created and populated
- No database changes needed

### Client Updates Needed:
- Mobile app needs to use Better Auth endpoints
- Remove JWT token handling
- Update to Better Auth session management

Would you like me to proceed with this cleanup?
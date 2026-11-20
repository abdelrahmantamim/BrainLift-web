# Better Auth Password System Guide

## Overview
This guide documents how Better Auth handles passwords and the issues we've encountered with password verification.

## Password Format
Better Auth uses a specific password hashing format:
- **Format**: `salt:hash` (colon-separated)
- **Salt**: 32 hex characters (16 bytes)
- **Hash**: 128 hex characters (64 bytes)
- **Total Length**: 161 characters

Example:
```
b4e13671ff2c9aa2fd3aa06f3ce985bd:a35972563b502fc68900240b3b3a136307ceeba0ab8002d63d7c1c9f5c2ba8e11600f0a5be6adbbb9c8b9d805399878ec197b72e0bd4f5dd8679e6604f339ae5
```

## Hashing Algorithm
Better Auth uses **scrypt** with specific parameters that differ from Node.js defaults:
- **N**: 16384 (CPU/memory cost)
- **r**: 16 (block size) ⚠️ **NOT 8** - This is the key difference!
- **p**: 1 (parallelization)
- **dkLen**: 64 (derived key length in bytes)

## Common Issues

### 1. Password Verification Fails After Migration
**Problem**: Users migrated from old auth system can't login even with correct passwords.

**Cause**: Password hashes created with wrong scrypt parameters (especially `r=8` instead of `r=16`).

**Solution**: Create new password hash using Better Auth's signup process.

### 2. Native changePassword API Fails
**Problem**: Better Auth's native `changePassword` API returns "Current password is incorrect" even with correct password.

**Status**: As of 2025-01-18, this appears to be a bug in Better Auth.

**Workaround**: The `/api/profile/change-password` endpoint implements a workaround that:
1. Verifies current password by attempting sign-in
2. Creates a temporary user to generate new password hash
3. Updates the user's password with the generated hash
4. Cleans up the temporary user

**Note**: The endpoint first tries the native API, then falls back to the workaround if it fails.

### 2. Manual Password Hash Creation Fails
**Problem**: Creating password hashes manually using crypto.scrypt or @noble/hashes doesn't work.

**Cause**: Better Auth has internal password processing that's not fully documented.

**Solution**: Use Better Auth's API to create users/passwords.

## Password Reset Solutions

### Solution 1: Create New User and Copy Hash (Recommended)
```javascript
// 1. Create a test user with Better Auth
const testUser = await auth.api.signUpEmail({
  body: {
    email: `test-${Date.now()}@example.com`,
    password: 'Mobile123!',
    name: 'Test User'
  },
  asResponse: false
});

// 2. Get the password hash from database
const result = await pool.query(
  'SELECT password FROM account WHERE "userId" = $1',
  [testUser.user.id]
);

// 3. Copy to target user
await pool.query(
  'UPDATE account SET password = $1 WHERE "userId" = $2',
  [result.rows[0].password, targetUserId]
);
```

### Solution 2: Use Known Working Hash
For password "Mobile123!", this hash is known to work:
```
7bb0e8ecab69e6c826f7e7c0e3c0cad1:b9708eb2b87c4961df690cc6b712b15c9c40cea5b5c670540aeedd12a87c98b96f7feb3d64e967b067b29c55ae7017a23cea47d7d0f31d2de96c039e491ed3e1
```

### Solution 3: Implement Custom Password Change
Since Better Auth's changePassword API has issues, we implemented a custom endpoint:
```javascript
// POST /api/profile/change-password
// Verifies current password and updates with new one
// See: routes/profile.routes.js
```

## Quick Scripts

### Reset Single User Password
```bash
node scripts/reset-single-user.js email@example.com Mobile123!
```

### Reset All Passwords
```bash
node scripts/reset-all-passwords.js
```

### Debug Password Issues
```bash
node debug-better-auth-password.js
```

## Important Notes

1. **Always clear sessions** after password reset:
   ```sql
   DELETE FROM session WHERE "userId" = 'user-id';
   ```

2. **Password validation** - Better Auth expects:
   - Minimum 8 characters
   - But doesn't enforce special character requirements

3. **OAuth users** don't have passwords in the account table

4. **The s2: prefix** sometimes seen in examples is NOT used by Better Auth

## Troubleshooting Checklist

- [ ] Check password hash format (should be `salt:hash`, 161 chars total)
- [ ] Verify user has account record with `providerId = 'credential'`
- [ ] Clear all sessions for the user
- [ ] Use Better Auth's own signup to create password hashes
- [ ] Check server logs for specific Better Auth error messages

## Working Password for Testing
- **Email**: Any user email
- **Password**: Mobile123!
- **Known Working Hash**: See Solution 2 above

## Contact
If you encounter password issues:
1. First try creating a new user with Better Auth and copying the hash
2. Check this guide for common issues
3. Review server logs for Better Auth errors
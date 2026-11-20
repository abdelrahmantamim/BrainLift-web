# Migration Guide: Accessing Existing Accounts with Better Auth

## Overview

This guide explains how to access previously created accounts that have profiles, files, quizzes, and flashcards after the Better Auth migration.

> **Important Update**: Use the improved migration scripts in the `migrations/` directory:
> - `migrate-existing-users-v2.js` - Properly handles Better Auth ID format and password conversion
> - `fix-all-uuid-users.js` - Fixes users with UUID format IDs
> - See `migrations/MIGRATION_README.md` for detailed instructions

## Quick Start

### 1. Check if a User Exists and Their Data

```bash
cd server
node migrations/check-user-data.js user@example.com
```

This will show:
- Whether the user exists in the system
- If they're already migrated to Better Auth
- All their data (files, quizzes, flashcards, etc.)

### 2. Migrate Existing Users to Better Auth

To migrate ALL existing users at once:

```bash
node migrations/migrate-existing-users.js --run
```

This will:
- Find all users with profiles
- Create Better Auth accounts for them
- Create ID mappings to preserve all data relationships
- Preserve existing passwords where available
- Assign temporary passwords where needed

### 3. Reset a User's Password

If a user can't remember their password or needs a new one:

```bash
node migrations/reset-user-password.js user@example.com NewPassword123!
```

## How the Migration Works

### ID Mapping System

The migration creates a mapping between:
- **Better Auth ID**: New 32-character string ID (e.g., `9akTGNZYrv0UONuvVfIi0t2b0yNclmU2`)
- **Supabase UUID**: Existing UUID in all data tables (e.g., `8726f716-14a6-4d9f-9e4f-53b35306ce7e`)

This mapping is stored in the `auth_id_mapping` table:

```sql
CREATE TABLE auth_id_mapping (
  better_auth_id TEXT PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Data Preservation

All existing data is preserved through the UUID mapping:
- **Files**: Linked via `user_id` (UUID)
- **Quizzes**: Linked via `user_id` (UUID)
- **Flashcard Decks**: Linked via `user_id` (UUID)
- **Study Sessions**: Linked via `user_id` (UUID)
- **Chat Conversations**: Linked via `user_id` (UUID)

## Step-by-Step Migration Process

### 1. Check Current State

First, see how many users need migration:

```bash
node migrations/migrate-existing-users.js
```

This shows a preview without making changes.

### 2. Run the Migration

```bash
node migrations/migrate-existing-users.js --run
```

The script will:
1. Find all users in `profiles` table not yet in Better Auth
2. Create Better Auth user accounts
3. Migrate existing password hashes (if any)
4. Create ID mappings
5. Verify data integrity

### 3. Handle Password Issues

For users without passwords or forgotten passwords:

```bash
# Set a new password
node migrations/reset-user-password.js user@example.com TempPassword123!

# Then notify the user to login and change their password
```

## Common Scenarios

### Scenario 1: User Can't Login After Migration

1. Check if they're migrated:
   ```bash
   node migrations/check-user-data.js their@email.com
   ```

2. If not migrated, run migration:
   ```bash
   node migrations/migrate-existing-users.js --run
   ```

3. If password issues, reset it:
   ```bash
   node migrations/reset-user-password.js their@email.com NewPassword123!
   ```

### Scenario 2: Verify User's Data is Accessible

```bash
node migrations/check-user-data.js user@email.com
```

This shows:
- Profile information
- Better Auth mapping status
- File count and recent files
- Quiz count and recent quizzes
- Flashcard deck count
- Study session count
- Chat message count

### Scenario 3: Bulk Migration for Production

1. First, backup your database
2. Run migration in preview mode:
   ```bash
   node migrations/migrate-existing-users.js
   ```
3. Run actual migration:
   ```bash
   node migrations/migrate-existing-users.js --run
   ```
4. Monitor the output for any failures
5. Test a few users to ensure they can login

## Database Queries for Verification

### Check Migration Status

```sql
-- Users successfully migrated
SELECT p.email, p.full_name, m.better_auth_id
FROM profiles p
JOIN auth_id_mapping m ON p.id = m.uuid
JOIN "user" u ON m.better_auth_id = u.id;

-- Users not yet migrated
SELECT email, full_name, created_at
FROM profiles
WHERE id NOT IN (SELECT uuid FROM auth_id_mapping)
AND email IS NOT NULL;
```

### Verify Data Access

```sql
-- Check if a user's data is accessible
SELECT 
  (SELECT COUNT(*) FROM files WHERE user_id = p.id) as files,
  (SELECT COUNT(*) FROM quizzes WHERE user_id = p.id) as quizzes,
  (SELECT COUNT(*) FROM flashcard_decks WHERE user_id = p.id) as flashcards
FROM profiles p
WHERE p.email = 'user@example.com';
```

## Troubleshooting

### "User not found in Better Auth"
- Run the migration script to create Better Auth account
- Check if email exists in profiles table first

### "Invalid password"
- Password might not have been migrated
- Use password reset script to set a new password

### "No data showing after login"
- Check if ID mapping exists in `auth_id_mapping` table
- Verify the `syncUser` middleware is running
- Check server logs for UUID mapping errors

### Server Errors After Login
- Ensure all route files have removed duplicate auth middleware
- Verify `syncUserToSupabase` middleware is in the correct order
- Check that both `users` and `profiles` tables have the user's UUID

## Security Notes

1. **Temporary Passwords**: Users without existing passwords get `*Pass123` - they should change this immediately
2. **Password Hashes**: Existing bcrypt hashes are preserved and work with Better Auth
3. **Email Verification**: Migrated users are marked as email verified
4. **Session Management**: Old sessions won't work - users need to login again

## Contact for Issues

If you encounter issues during migration:
1. Check server logs for detailed error messages
2. Run the check-user-data script for specific users
3. Verify database connectivity and permissions
4. Ensure Better Auth tables exist (`user`, `account`, `session`)
console.log(`
🔗 How to Get Your Supabase Database URL for Better-Auth

1. Go to your Supabase Dashboard:
   https://app.supabase.com/

2. Select your project

3. Go to Settings (gear icon) → Database

4. Look for "Connection string" section

5. You'll see several connection strings. Use the one labeled:
   "Connection pooling" → "Mode: Transaction"
   
   It looks like:
   postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

6. Copy this entire URL

7. Add it to your .env file:
   DATABASE_URL=postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

Note: The password in the connection string is your database password, 
      which is different from your SUPABASE_SERVICE_KEY.

Alternative: If you can't find it, you can construct it:
- Project Reference: Get from your Supabase URL (the part before .supabase.co)
- Database Password: Set when you created the project (can be reset in Database Settings)
- Region: Check your project region in settings

Once you have the DATABASE_URL, run:
  node scripts/migrate-to-better-auth.js
`);
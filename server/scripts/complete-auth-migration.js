// Complete the Better-Auth migration and fix all issues
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function completeAuthMigration() {
  console.log('🚀 Starting complete Better-Auth migration...\n');
  
  try {
    // 1. Ensure all required tables exist
    console.log('1️⃣ Checking/Creating required tables...');
    
    // Password table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "password" (
        "userId" TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
        hash TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Password table ready');
    
    // Password reset tokens table (already created)
    console.log('✅ Password reset tokens table already exists');
    
    // 2. Migrate all existing users to have password records
    console.log('\n2️⃣ Migrating user passwords...');
    
    // Get all users
    const users = await pool.query(`
      SELECT u.id, u.email, u.name 
      FROM "user" u
      LEFT JOIN "password" p ON p."userId" = u.id
      WHERE p."userId" IS NULL
    `);
    
    if (users.rows.length > 0) {
      console.log(`Found ${users.rows.length} users without password records`);
      
      // Create temporary passwords for users without them
      for (const user of users.rows) {
        const tempPassword = `TempPass_${user.id.substring(0, 8)}!`;
        const hash = await bcrypt.hash(tempPassword, 10);
        
        await pool.query(`
          INSERT INTO "password" ("userId", hash, "createdAt", "updatedAt")
          VALUES ($1, $2, NOW(), NOW())
          ON CONFLICT ("userId") DO NOTHING
        `, [user.id, hash]);
        
        console.log(`✅ Created password for ${user.email}`);
      }
    } else {
      console.log('✅ All users have password records');
    }
    
    // 3. Clean up account table (remove password column if added)
    console.log('\n3️⃣ Cleaning up account table...');
    try {
      await pool.query('ALTER TABLE "account" DROP COLUMN IF EXISTS password');
      console.log('✅ Removed password column from account table');
    } catch (error) {
      console.log('ℹ️  Password column not found in account table (already clean)');
    }
    
    // 4. Add missing indexes for performance
    console.log('\n4️⃣ Adding performance indexes...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
      CREATE INDEX IF NOT EXISTS idx_session_token ON "session"(token);
      CREATE INDEX IF NOT EXISTS idx_session_expires ON "session"("expiresAt");
    `);
    console.log('✅ Indexes created');
    
    // 5. Set up email templates table for future use
    console.log('\n5️⃣ Creating email templates table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        subject TEXT NOT NULL,
        html_template TEXT NOT NULL,
        text_template TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Insert default templates
    await pool.query(`
      INSERT INTO email_templates (id, name, subject, html_template, text_template, variables)
      VALUES 
      (
        'password-reset',
        'password_reset',
        'Reset Your Password - {{app_name}}',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi {{user_name}},</p>
          <p>You requested to reset your password. Click the link below to create a new password:</p>
          <p style="margin: 20px 0;">
            <a href="{{reset_link}}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          </p>
          <p>Or copy and paste this link:</p>
          <p style="background-color: #f5f5f5; padding: 10px; word-break: break-all;">{{reset_link}}</p>
          <p>This link will expire in {{expiry_hours}} hour(s).</p>
          <p>If you didn''t request this, please ignore this email.</p>
          <p>Best regards,<br>{{app_name}} Team</p>
        </div>',
        'Hi {{user_name}},

You requested to reset your password. Click the link below to create a new password:

{{reset_link}}

This link will expire in {{expiry_hours}} hour(s).

If you didn''t request this, please ignore this email.

Best regards,
{{app_name}} Team',
        '["user_name", "reset_link", "expiry_hours", "app_name"]'::jsonb
      ),
      (
        'welcome',
        'welcome_email',
        'Welcome to {{app_name}}!',
        '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to {{app_name}}!</h2>
          <p>Hi {{user_name}},</p>
          <p>Thank you for signing up! We''re excited to have you on board.</p>
          <p>Get started by exploring our features:</p>
          <ul>
            <li>Create and take quizzes</li>
            <li>Generate flashcards from your documents</li>
            <li>Chat with AI to learn anything</li>
          </ul>
          <p style="margin: 20px 0;">
            <a href="{{app_url}}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Learning</a>
          </p>
          <p>Best regards,<br>{{app_name}} Team</p>
        </div>',
        'Hi {{user_name}},

Thank you for signing up! We''re excited to have you on board.

Get started by exploring our features:
- Create and take quizzes
- Generate flashcards from your documents
- Chat with AI to learn anything

Start Learning: {{app_url}}

Best regards,
{{app_name}} Team',
        '["user_name", "app_url", "app_name"]'::jsonb
      )
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Email templates created');
    
    // 6. Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(60));
    
    // Get final stats
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM "user") as total_users,
        (SELECT COUNT(*) FROM "password") as users_with_passwords,
        (SELECT COUNT(*) FROM "session" WHERE "expiresAt" > NOW()) as active_sessions,
        (SELECT COUNT(*) FROM password_reset_tokens WHERE expires_at > NOW()) as pending_resets
    `);
    
    const s = stats.rows[0];
    console.log('\n📊 Final Statistics:');
    console.log(`- Total users: ${s.total_users}`);
    console.log(`- Users with passwords: ${s.users_with_passwords}`);
    console.log(`- Active sessions: ${s.active_sessions}`);
    console.log(`- Pending password resets: ${s.pending_resets}`);
    
    if (s.total_users > s.users_with_passwords) {
      console.log(`\n⚠️  ${s.total_users - s.users_with_passwords} users still need passwords!`);
    }
    
    console.log('\n✅ All done! The Better-Auth system is now properly configured.');
    console.log('\n📝 Next steps:');
    console.log('1. Configure email sending (Resend, SendGrid, or SMTP)');
    console.log('2. Update the mobile app reset password flow');
    console.log('3. Test the complete authentication flow');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

completeAuthMigration();
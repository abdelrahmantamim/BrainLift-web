// Script to directly reset a user's password
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function resetUserPassword(email, newPassword) {
  try {
    // Check if user exists in Better-Auth
    const userResult = await pool.query(
      'SELECT id, email, name FROM "user" WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found in Better-Auth system');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Found user:', user);
    
    // Check if user has an account record
    const accountResult = await pool.query(
      'SELECT id, "providerId" FROM "account" WHERE "userId" = $1',
      [user.id]
    );
    
    if (accountResult.rows.length === 0) {
      console.log('❌ No account record found - creating one...');
      
      // Create account record
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query(`
        INSERT INTO "account" (
          id, 
          "userId", 
          "accountId", 
          "providerId", 
          "createdAt", 
          "updatedAt"
        )
        VALUES (
          gen_random_uuid(), 
          $1, 
          $2, 
          'credential', 
          NOW(), 
          NOW()
        )
      `, [user.id, user.email]);
      
      console.log('✅ Created account record');
      
      // Now update the password
      await updatePassword(user.id, newPassword);
    } else {
      // Update existing account
      await updatePassword(user.id, newPassword);
    }
    
    console.log('\n✅ Password reset successfully!');
    console.log('You can now login with:');
    console.log('Email:', email);
    console.log('Password:', newPassword);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

async function updatePassword(userId, newPassword) {
  const hash = await bcrypt.hash(newPassword, 10);
  
  // First check if password column exists
  const columnCheck = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'account' 
    AND column_name = 'password'
  `);
  
  if (columnCheck.rows.length === 0) {
    // Add password column if it doesn't exist
    console.log('Adding password column to account table...');
    await pool.query('ALTER TABLE "account" ADD COLUMN IF NOT EXISTS password TEXT');
  }
  
  // Update password
  await pool.query(
    'UPDATE "account" SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2',
    [hash, userId]
  );
  
  // Clear any existing sessions
  await pool.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
}

// Usage: node reset-user-password.js <email> <new-password>
const email = process.argv[2] || 'armt18@live.com';
const password = process.argv[3] || 'NewPass123!';

if (!email || !password) {
  console.log('Usage: node reset-user-password.js <email> <new-password>');
  process.exit(1);
}

resetUserPassword(email, password);
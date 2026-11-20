import { auth } from '../config/better-auth-minimal.js';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetAllPasswords(newPassword = 'Mobile123!') {
  try {
    console.log(`Resetting all user passwords to: ${newPassword}\n`);
    
    // Step 1: Create a temporary user to get valid password hash
    const tempEmail = `temp-${Date.now()}@example.com`;
    console.log('1. Creating temporary user with Better Auth...');
    
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: tempEmail,
        password: newPassword,
        name: 'Temp User'
      },
      asResponse: false
    });
    
    console.log('✓ Temporary user created');
    
    // Step 2: Get the password hash
    const hashResult = await pool.query(
      'SELECT password FROM account WHERE "userId" = $1 AND "providerId" = $2',
      [signUpResult.user.id, 'credential']
    );
    
    if (hashResult.rows.length === 0) {
      throw new Error('Could not find password hash for temporary user');
    }
    
    const passwordHash = hashResult.rows[0].password;
    console.log('✓ Got password hash from Better Auth');
    console.log(`  Hash format: ${passwordHash.substring(0, 32)}...${passwordHash.substring(passwordHash.length - 32)}`);
    console.log(`  Hash length: ${passwordHash.length} chars\n`);
    
    // Step 3: Update all credential accounts
    console.log('2. Updating all user passwords...');
    const updateResult = await pool.query(
      `UPDATE account 
       SET password = $1, "updatedAt" = NOW() 
       WHERE "providerId" = 'credential'
       RETURNING "userId"`,
      [passwordHash]
    );
    
    console.log(`✓ Updated ${updateResult.rowCount} user passwords`);
    
    // Step 4: Clear all sessions
    console.log('\n3. Clearing all sessions...');
    const sessionResult = await pool.query('DELETE FROM session');
    console.log(`✓ Cleared ${sessionResult.rowCount} sessions`);
    
    // Step 5: Clean up temporary user
    await pool.query('DELETE FROM session WHERE "userId" = $1', [signUpResult.user.id]);
    await pool.query('DELETE FROM account WHERE "userId" = $1', [signUpResult.user.id]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [signUpResult.user.id]);
    console.log('✓ Cleaned up temporary user');
    
    // Show some example users
    const users = await pool.query(`
      SELECT u.email 
      FROM "user" u 
      JOIN account a ON u.id = a."userId" 
      WHERE a."providerId" = 'credential' 
      ORDER BY u.email 
      LIMIT 5
    `);
    
    console.log(`\n✅ Password reset complete!`);
    console.log(`All users can now login with password: ${newPassword}`);
    console.log('\nExample users:');
    users.rows.forEach(user => {
      console.log(`  - ${user.email}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get password from command line or use default
const password = process.argv[2] || 'Mobile123!';

console.log('Better Auth Password Reset Tool');
console.log('==============================\n');

if (process.argv[2] === '--help') {
  console.log('Usage: node reset-all-passwords.js [password]');
  console.log('Example: node reset-all-passwords.js MyNewPass123');
  console.log('\nDefault password: Mobile123!');
  process.exit(0);
}

resetAllPasswords(password);
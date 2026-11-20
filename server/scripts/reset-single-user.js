import { auth } from '../config/better-auth-minimal.js';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function resetSingleUserPassword(targetEmail, newPassword = 'Mobile123!') {
  try {
    console.log(`Resetting password for ${targetEmail}...`);
    
    // Step 1: Create a temporary user with Better Auth to get a valid password hash
    const tempEmail = `temp-${Date.now()}@example.com`;
    console.log('\n1. Creating temporary user with Better Auth...');
    
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
    
    // Step 3: Update target user's password
    const updateResult = await pool.query(
      `UPDATE account 
       SET password = $1, "updatedAt" = NOW() 
       WHERE "userId" = (SELECT id FROM "user" WHERE email = $2) 
       AND "providerId" = 'credential'`,
      [passwordHash, targetEmail]
    );
    
    if (updateResult.rowCount === 0) {
      throw new Error(`User ${targetEmail} not found or doesn't have a credential account`);
    }
    
    console.log(`✓ Updated password for ${targetEmail}`);
    
    // Step 4: Clear sessions for target user
    await pool.query(
      'DELETE FROM session WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)',
      [targetEmail]
    );
    
    console.log('✓ Cleared user sessions');
    
    // Step 5: Clean up temporary user
    await pool.query('DELETE FROM session WHERE "userId" = $1', [signUpResult.user.id]);
    await pool.query('DELETE FROM account WHERE "userId" = $1', [signUpResult.user.id]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [signUpResult.user.id]);
    
    console.log('✓ Cleaned up temporary user');
    
    console.log(`\n✅ Password reset successful!`);
    console.log(`Email: ${targetEmail}`);
    console.log(`Password: ${newPassword}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get arguments
const email = process.argv[2];
const password = process.argv[3] || 'Mobile123!';

if (!email) {
  console.log('Usage: node reset-single-user.js <email> [password]');
  console.log('Example: node reset-single-user.js user@example.com Mobile123!');
  process.exit(1);
}

resetSingleUserPassword(email, password);
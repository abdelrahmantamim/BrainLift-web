// Merge Better-Auth user with existing profile
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function mergeUserAccounts() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting user account merge...\n');
    
    const betterAuthUserId = '3a20dec9-c160-41a3-b54f-5f12461ac33a';
    const existingUserId = '26e34fec-f7f1-4547-a99a-f94d6c825518';
    const email = 'armt18@live.com';
    
    // Step 1: Update Better-Auth user to use the existing user ID
    console.log(`Step 1: Updating Better-Auth user to use existing ID...`);
    console.log(`  Better-Auth ID: ${betterAuthUserId}`);
    console.log(`  Existing ID: ${existingUserId}`);
    
    // First, delete the Better-Auth user record
    const deleteResult = await client.query(
      'DELETE FROM "user" WHERE id = $1',
      [betterAuthUserId]
    );
    console.log(`  Deleted ${deleteResult.rowCount} Better-Auth user records`);
    
    // Then, create a new Better-Auth user with the existing ID
    const insertResult = await client.query(
      `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, NOW(), NOW())
       RETURNING *`,
      [existingUserId, email, 'abdo']
    );
    console.log(`  Created Better-Auth user with existing ID`);
    
    // Step 2: Update the profile name to match Better-Auth
    console.log(`\nStep 2: Updating profile name to match Better-Auth...`);
    const updateProfile = await client.query(
      `UPDATE profiles 
       SET full_name = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [existingUserId, 'abdo']
    );
    console.log(`  Updated profile name from 'Abdo2' to 'abdo'`);
    
    // Step 3: Clean up any sessions or tokens for the old Better-Auth ID
    console.log(`\nStep 3: Cleaning up sessions and tokens...`);
    const sessionDelete = await client.query(
      'DELETE FROM session WHERE "userId" = $1',
      [betterAuthUserId]
    );
    console.log(`  Deleted ${sessionDelete.rowCount} sessions`);
    
    // Step 4: Verify the merge
    console.log('\nStep 4: Verifying the merge...');
    
    // Check Better-Auth user
    const userCheck = await client.query(
      'SELECT id, email, name FROM "user" WHERE email = $1',
      [email]
    );
    console.log(`Better-Auth users with email ${email}: ${userCheck.rows.length}`);
    if (userCheck.rows.length > 0) {
      console.log(`  ID: ${userCheck.rows[0].id}`);
      console.log(`  Email: ${userCheck.rows[0].email}`);
      console.log(`  Name: ${userCheck.rows[0].name}`);
    }
    
    // Check profile
    const profileCheck = await client.query(
      'SELECT id, email, full_name FROM profiles WHERE email = $1',
      [email]
    );
    console.log(`\nProfiles with email ${email}: ${profileCheck.rows.length}`);
    if (profileCheck.rows.length > 0) {
      console.log(`  ID: ${profileCheck.rows[0].id}`);
      console.log(`  Email: ${profileCheck.rows[0].email}`);
      console.log(`  Name: ${profileCheck.rows[0].full_name}`);
    }
    
    // Ensure IDs match
    if (userCheck.rows.length > 0 && profileCheck.rows.length > 0) {
      const idsMatch = userCheck.rows[0].id === profileCheck.rows[0].id;
      console.log(`\n✅ IDs match: ${idsMatch ? 'YES' : 'NO'}`);
      if (!idsMatch) {
        throw new Error('User IDs do not match between Better-Auth and profiles!');
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✅ User account merge completed successfully!');
    console.log('The user can now log in with Better-Auth and access all their existing data.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error merging user accounts:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the merge
mergeUserAccounts().catch(console.error);
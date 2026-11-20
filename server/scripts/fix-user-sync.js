// Fix user synchronization issue
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixUserSync() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting user sync fix...\n');
    
    // Step 1: Delete the old ghost user that has no data
    const oldUserId = '0cf5fbb3-9ed3-40be-a7cc-a8ac96bd5a38';
    console.log(`Step 1: Deleting ghost user ${oldUserId}...`);
    
    const deleteResult = await client.query(
      'DELETE FROM profiles WHERE id = $1',
      [oldUserId]
    );
    console.log(`Deleted ${deleteResult.rowCount} profile records`);
    
    // Step 2: Create profile for the Better-Auth user
    const newUserId = '3a20dec9-c160-41a3-b54f-5f12461ac33a';
    const email = 'armt18@live.com';
    const name = 'abdo';
    
    console.log(`\nStep 2: Creating profile for Better-Auth user ${newUserId}...`);
    
    const insertResult = await client.query(
      `INSERT INTO profiles (id, email, full_name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         updated_at = NOW()
       RETURNING *`,
      [newUserId, email, name]
    );
    
    console.log('Created/Updated profile:', insertResult.rows[0]);
    
    // Step 3: Verify the fix
    console.log('\nStep 3: Verifying the fix...');
    
    // Check if old user is gone
    const oldUserCheck = await client.query(
      'SELECT id, email FROM profiles WHERE id = $1',
      [oldUserId]
    );
    console.log(`Old user exists: ${oldUserCheck.rows.length > 0 ? 'YES (Problem!)' : 'NO (Good!)'}`);
    
    // Check if new user profile exists
    const newUserCheck = await client.query(
      'SELECT id, email, full_name FROM profiles WHERE id = $1',
      [newUserId]
    );
    console.log(`New user profile exists: ${newUserCheck.rows.length > 0 ? 'YES (Good!)' : 'NO (Problem!)'}`);
    if (newUserCheck.rows.length > 0) {
      console.log(`Profile data: ${JSON.stringify(newUserCheck.rows[0], null, 2)}`);
    }
    
    // Check for email conflicts
    const emailCheck = await client.query(
      'SELECT id, email FROM profiles WHERE email = $1',
      [email]
    );
    console.log(`\nUsers with email ${email}: ${emailCheck.rows.length}`);
    emailCheck.rows.forEach(row => {
      console.log(`  - ID: ${row.id}`);
    });
    
    await client.query('COMMIT');
    console.log('\n✅ User sync fix completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error fixing user sync:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixUserSync().catch(console.error);
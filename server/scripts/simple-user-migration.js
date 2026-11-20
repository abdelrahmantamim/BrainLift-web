// Simple migration to ensure all existing users are in Better-Auth
// Users will need to reset their passwords
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrateUsers() {
  try {
    console.log('Starting simple user migration...\n');
    
    // Get all existing users from profiles
    const existingUsers = await pool.query(`
      SELECT DISTINCT ON (p.email) 
        p.id, 
        p.email, 
        p.full_name,
        p.created_at
      FROM profiles p
      WHERE p.email IS NOT NULL
      ORDER BY p.email, p.created_at ASC
    `);
    
    console.log(`Found ${existingUsers.rows.length} users to migrate\n`);
    
    let migrated = 0;
    let alreadyExists = 0;
    let errors = 0;
    
    for (const user of existingUsers.rows) {
      try {
        // Check if user exists in Better-Auth
        const betterAuthCheck = await pool.query(
          'SELECT id FROM "user" WHERE email = $1',
          [user.email]
        );
        
        if (betterAuthCheck.rows.length === 0) {
          // Create user in Better-Auth with their existing ID
          await pool.query(`
            INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, false, $4, NOW())
            ON CONFLICT (email) DO NOTHING
          `, [user.id, user.email, user.full_name || user.email, user.created_at]);
          
          migrated++;
          console.log(`✅ Migrated: ${user.email} (ID: ${user.id})`);
        } else {
          alreadyExists++;
          console.log(`⏭️  Already exists: ${user.email}`);
        }
        
        // Ensure user exists in users table
        await pool.query(`
          INSERT INTO users (id, email, created_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO NOTHING
        `, [user.id, user.email, user.created_at]);
        
      } catch (error) {
        console.error(`❌ Error with ${user.email}: ${error.message}`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Migration Complete:');
    console.log(`✅ Migrated: ${migrated}`);
    console.log(`⏭️  Already existed: ${alreadyExists}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50));
    
    if (migrated > 0) {
      console.log('\n⚠️  IMPORTANT: Migrated users will need to reset their passwords!');
      console.log('They should use the "Forgot Password" flow to set a new password.');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

migrateUsers();
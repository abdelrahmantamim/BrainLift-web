// Check all references to a user ID
require('dotenv').config();
const { Pool } = require('pg');

async function checkUserReferences(userId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    console.log(`\nChecking references for user ID: ${userId}\n`);
    
    // List of tables with user_id foreign keys
    const tables = [
      'imported_content',
      'quizzes', 
      'flashcard_decks',
      'files',
      'folders',
      'chat_conversations',
      'quiz_attempts',
      'share_tracking',
      'study_sessions',
      'notification_history',
      'push_tokens',
      'uploaded_files'
    ];
    
    for (const table of tables) {
      try {
        const result = await pool.query(
          `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1`,
          [userId]
        );
        console.log(`${table}: ${result.rows[0].count} records`);
      } catch (error) {
        console.log(`${table}: Error - ${error.message}`);
      }
    }
    
    // Check profiles table separately (uses id not user_id)
    try {
      const profiles = await pool.query(
        'SELECT email, full_name FROM profiles WHERE id = $1',
        [userId]
      );
      if (profiles.rows.length > 0) {
        console.log(`\nprofiles: ${profiles.rows[0].email} (${profiles.rows[0].full_name || 'No name'})`);
      } else {
        console.log(`\nprofiles: No record found`);
      }
    } catch (error) {
      console.log(`profiles: Error - ${error.message}`);
    }
    
    // Check users table (Better-Auth)
    try {
      const users = await pool.query(
        'SELECT email, name FROM "user" WHERE id = $1',
        [userId]
      );
      if (users.rows.length > 0) {
        console.log(`Better-Auth user: ${users.rows[0].email} (${users.rows[0].name || 'No name'})`);
      } else {
        console.log(`Better-Auth user: No record found`);
      }
    } catch (error) {
      console.log(`Better-Auth user: Error - ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Check both conflicting user IDs
async function main() {
  // The user with the email that's causing conflicts
  console.log('=== OLD USER (from profiles table) ===');
  await checkUserReferences('0cf5fbb3-9ed3-40be-a7cc-a8ac96bd5a38');
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // The Better-Auth user we're trying to sync
  console.log('=== NEW USER (from Better-Auth) ===');
  await checkUserReferences('3a20dec9-c160-41a3-b54f-5f12461ac33a');
}

main().catch(console.error);
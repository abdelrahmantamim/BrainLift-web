// Check references for a specific user ID
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
      'study_sessions',
      'notification_history',
      'push_tokens',
      'uploaded_files'
    ];
    
    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        const result = await pool.query(
          `SELECT COUNT(*) as count FROM ${table} WHERE user_id = $1`,
          [userId]
        );
        const count = parseInt(result.rows[0].count);
        totalRecords += count;
        if (count > 0) {
          console.log(`${table}: ${count} records ⚠️`);
        } else {
          console.log(`${table}: ${count} records`);
        }
      } catch (error) {
        console.log(`${table}: Error - ${error.message}`);
      }
    }
    
    console.log(`\nTotal records across all tables: ${totalRecords}`);
    
    // Check profiles table
    const profiles = await pool.query(
      'SELECT id, email, full_name, created_at FROM profiles WHERE id = $1',
      [userId]
    );
    if (profiles.rows.length > 0) {
      console.log(`\nProfile found:`);
      console.log(`  Email: ${profiles.rows[0].email}`);
      console.log(`  Name: ${profiles.rows[0].full_name || 'No name'}`);
      console.log(`  Created: ${profiles.rows[0].created_at}`);
    } else {
      console.log(`\nNo profile found`);
    }
    
    // Check Better-Auth user table
    const users = await pool.query(
      'SELECT id, email, name, createdAt FROM "user" WHERE id = $1',
      [userId]
    );
    if (users.rows.length > 0) {
      console.log(`\nBetter-Auth user found:`);
      console.log(`  Email: ${users.rows[0].email}`);
      console.log(`  Name: ${users.rows[0].name || 'No name'}`);
      console.log(`  Created: ${users.rows[0].createdat}`);
    } else {
      console.log(`\nNo Better-Auth user found`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Get user ID from command line argument
const userId = process.argv[2];
if (!userId) {
  console.error('Please provide a user ID as an argument');
  console.error('Usage: node check-specific-user.js <user-id>');
  process.exit(1);
}

checkUserReferences(userId).catch(console.error);
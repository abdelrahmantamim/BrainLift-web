// Verify user synchronization status
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function verifyUserSync() {
  try {
    console.log('Verifying user synchronization status...\n');
    
    const email = 'armt18@live.com';
    
    // Check Better-Auth user
    const betterAuthUser = await pool.query(
      'SELECT id, email, name, "emailVerified" FROM "user" WHERE email = $1',
      [email]
    );
    
    console.log('=== Better-Auth User ===');
    if (betterAuthUser.rows.length > 0) {
      const user = betterAuthUser.rows[0];
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Name: ${user.name}`);
      console.log(`Email Verified: ${user.emailVerified}`);
    } else {
      console.log('No Better-Auth user found');
    }
    
    // Check profile
    const profile = await pool.query(
      'SELECT id, email, full_name, created_at FROM profiles WHERE email = $1',
      [email]
    );
    
    console.log('\n=== Profile ===');
    if (profile.rows.length > 0) {
      const prof = profile.rows[0];
      console.log(`ID: ${prof.id}`);
      console.log(`Email: ${prof.email}`);
      console.log(`Name: ${prof.full_name}`);
      console.log(`Created: ${prof.created_at}`);
    } else {
      console.log('No profile found');
    }
    
    // Verify IDs match
    if (betterAuthUser.rows.length > 0 && profile.rows.length > 0) {
      const idsMatch = betterAuthUser.rows[0].id === profile.rows[0].id;
      console.log(`\n=== Verification ===`);
      console.log(`IDs match: ${idsMatch ? '✅ YES' : '❌ NO'}`);
      
      if (idsMatch) {
        // Count user data
        const userId = betterAuthUser.rows[0].id;
        
        const quizCount = await pool.query(
          'SELECT COUNT(*) as count FROM quizzes WHERE user_id = $1',
          [userId]
        );
        
        const flashcardCount = await pool.query(
          'SELECT COUNT(*) as count FROM flashcard_decks WHERE user_id = $1',
          [userId]
        );
        
        const fileCount = await pool.query(
          'SELECT COUNT(*) as count FROM files WHERE user_id = $1',
          [userId]
        );
        
        console.log(`\n=== User Data ===`);
        console.log(`Quizzes: ${quizCount.rows[0].count}`);
        console.log(`Flashcard Decks: ${flashcardCount.rows[0].count}`);
        console.log(`Files: ${fileCount.rows[0].count}`);
        
        console.log('\n✅ User synchronization is complete and working correctly!');
        console.log('The user can now log in with Better-Auth and access all their data.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

verifyUserSync();
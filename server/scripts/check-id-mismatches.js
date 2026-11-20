require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkIdMismatches() {
  try {
    const result = await pool.query(`
      SELECT 
        p.email,
        p.id::text as profile_id,
        u.id as betterauth_id,
        CASE WHEN p.id::text = u.id THEN 'Match' ELSE 'Mismatch' END as status
      FROM profiles p
      JOIN "user" u ON u.email = p.email
      ORDER BY p.email
    `);
    
    console.log('User ID Comparison:');
    console.log('='.repeat(100));
    
    let matches = 0;
    let mismatches = 0;
    
    result.rows.forEach(row => {
      const icon = row.status === 'Match' ? '✅' : '❌';
      console.log(`${icon} ${row.email}: Profile=${row.profile_id} | Better-Auth=${row.betterauth_id}`);
      
      if (row.status === 'Match') {
        matches++;
      } else {
        mismatches++;
      }
    });
    
    console.log('\n' + '='.repeat(100));
    console.log(`Summary: ${matches} matches, ${mismatches} mismatches`);
    
    if (mismatches > 0) {
      console.log('\n⚠️  Users with mismatches may experience issues and need manual migration.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkIdMismatches();
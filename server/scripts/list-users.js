// List users in the new auth system
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

async function listUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Users in new auth system:\n');
    
    const result = await pool.query(`
      SELECT u.id, u.email, u.name, u."createdAt",
             CASE WHEN p."userId" IS NOT NULL THEN 'Yes' ELSE 'No' END as has_password
      FROM "user" u
      LEFT JOIN "password" p ON u.id = p."userId"
      ORDER BY u."createdAt" DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('No users found in new auth system');
    } else {
      console.table(result.rows);
    }
    
    console.log(`\nTotal users: ${result.rows.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

listUsers();
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixUserPassword(email, password) {
  try {
    // Get user
    const userResult = await pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('Found user:', userId);
    
    // Hash password
    const hash = await bcrypt.hash(password, 10);
    
    // Insert or update in password table
    await pool.query(`
      INSERT INTO "password" ("userId", hash, "createdAt", "updatedAt")
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE 
      SET hash = $2, "updatedAt" = NOW()
    `, [userId, hash]);
    
    console.log('✅ Password set successfully in password table!');
    console.log('You can now login with:');
    console.log('Email:', email);
    console.log('Password:', password);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixUserPassword('armt18@live.com', 'TempPass123!');
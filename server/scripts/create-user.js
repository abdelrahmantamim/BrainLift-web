// Create a user directly in the new auth system
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

dotenv.config();

async function createUser(email, password, name) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Check if user already exists
    const existing = await pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      console.log(`❌ User ${email} already exists`);
      
      // Update password instead
      const userId = existing.rows[0].id;
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await pool.query(
        'UPDATE "password" SET hash = $1 WHERE "userId" = $2',
        [hashedPassword, userId]
      );
      
      console.log(`✅ Password updated for ${email}`);
      return;
    }
    
    // Create new user
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      'INSERT INTO "user" (id, email, name, "createdAt") VALUES ($1, $2, $3, $4)',
      [userId, email, name || email.split('@')[0], new Date()]
    );
    
    await pool.query(
      'INSERT INTO "password" ("userId", hash) VALUES ($1, $2)',
      [userId, hashedPassword]
    );
    
    console.log(`✅ User created successfully!`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Name: ${name || email.split('@')[0]}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Create your user
createUser('armt18@live.com', 'YourPasswordHere', 'Your Name');

// You can also run with command line args:
// node create-user.js email@example.com password123 "User Name"
if (process.argv.length >= 4) {
  const [,, email, password, name] = process.argv;
  createUser(email, password, name);
}
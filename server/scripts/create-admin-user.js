// Script to create an admin user in the Better-Auth system
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createAdminUser() {
  try {
    console.log('Creating admin user in Better-Auth system...');
    
    const email = 'abdoadmin@tutorapp.com';
    const password = 'Pass123';
    const name = 'Admin User';
    
    // Check if user exists
    const existing = await pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      console.log('Admin user already exists');
      
      // Update to set admin role
      await pool.query(
        'UPDATE "user" SET role = $1 WHERE email = $2',
        ['admin', email]
      );
      console.log('Updated existing user to admin role');
      
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = uuidv4();
      
      await pool.query(
        'INSERT INTO "user" (id, email, name, role) VALUES ($1, $2, $3, $4)',
        [userId, email, name, 'admin']
      );
      
      await pool.query(
        'INSERT INTO "password" ("userId", hash) VALUES ($1, $2)',
        [userId, hashedPassword]
      );
      
      console.log('Admin user created successfully');
    }
    
    console.log('\nAdmin credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('\nYou can now login to the admin dashboard');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await pool.end();
  }
}

createAdminUser();
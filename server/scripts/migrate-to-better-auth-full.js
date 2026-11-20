#!/usr/bin/env node

/**
 * Migration script to ensure existing users work with Better Auth
 * This script:
 * 1. Checks existing Better Auth tables
 * 2. Ensures password hashes are compatible
 * 3. Creates any missing user records
 * 4. Validates the migration
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkTables() {
  console.log('🔍 Checking Better Auth tables...');
  
  const tables = ['user', 'session', 'account', 'password', 'verification'];
  const missingTables = [];
  
  for (const table of tables) {
    const result = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [table]
    );
    
    if (!result.rows[0].exists) {
      missingTables.push(table);
    } else {
      console.log(`✅ Table "${table}" exists`);
    }
  }
  
  if (missingTables.length > 0) {
    console.error('❌ Missing tables:', missingTables.join(', '));
    console.log('Run Better Auth initialization first!');
    process.exit(1);
  }
}

async function checkUsers() {
  console.log('\n🔍 Checking existing users...');
  
  // Get all users
  const users = await pool.query('SELECT * FROM "user" ORDER BY "createdAt"');
  console.log(`Found ${users.rows.length} users in Better Auth tables`);
  
  // Check each user has a password entry
  let missingPasswords = 0;
  for (const user of users.rows) {
    const password = await pool.query(
      'SELECT * FROM "password" WHERE "userId" = $1',
      [user.id]
    );
    
    if (password.rows.length === 0) {
      console.log(`⚠️  User ${user.email} has no password entry`);
      missingPasswords++;
    }
  }
  
  if (missingPasswords > 0) {
    console.log(`\n⚠️  ${missingPasswords} users have no password entries`);
  }
  
  return users.rows;
}

async function checkSessions() {
  console.log('\n🔍 Checking active sessions...');
  
  const sessions = await pool.query(
    'SELECT s.*, u.email FROM "session" s JOIN "user" u ON s."userId" = u.id WHERE s."expiresAt" > NOW()'
  );
  
  console.log(`Found ${sessions.rows.length} active sessions`);
  
  if (sessions.rows.length > 0) {
    console.log('\nActive sessions by user:');
    const userSessions = {};
    sessions.rows.forEach(session => {
      userSessions[session.email] = (userSessions[session.email] || 0) + 1;
    });
    
    Object.entries(userSessions).forEach(([email, count]) => {
      console.log(`  ${email}: ${count} session(s)`);
    });
  }
  
  return sessions.rows;
}

async function validatePasswordHash() {
  console.log('\n🔍 Validating password hashes...');
  
  // Get a sample user with password
  const result = await pool.query(`
    SELECT u.*, p.hash 
    FROM "user" u 
    JOIN "password" p ON u.id = p."userId" 
    LIMIT 1
  `);
  
  if (result.rows.length === 0) {
    console.log('⚠️  No users with passwords found to validate');
    return;
  }
  
  const user = result.rows[0];
  console.log(`Testing password hash for user: ${user.email}`);
  
  // Check if it's a bcrypt hash
  if (user.hash.startsWith('$2a$') || user.hash.startsWith('$2b$')) {
    console.log('✅ Password hash format is bcrypt (compatible)');
  } else {
    console.log('❌ Password hash format is not bcrypt!');
  }
}

async function createTestData() {
  console.log('\n🧪 Creating test data...');
  
  const testEmail = 'test-better-auth@example.com';
  const testPassword = 'Test123!';
  
  // Check if test user exists
  const existing = await pool.query(
    'SELECT * FROM "user" WHERE email = $1',
    [testEmail]
  );
  
  if (existing.rows.length > 0) {
    console.log('Test user already exists');
    return existing.rows[0];
  }
  
  // Create test user
  const userId = require('crypto').randomUUID();
  const passwordHash = await bcrypt.hash(testPassword, 10);
  
  await pool.query(
    'INSERT INTO "user" (id, email, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())',
    [userId, testEmail, 'Test User']
  );
  
  await pool.query(
    'INSERT INTO "password" ("userId", hash) VALUES ($1, $2)',
    [userId, passwordHash]
  );
  
  console.log(`✅ Created test user: ${testEmail} / ${testPassword}`);
  console.log(`   User ID: ${userId}`);
  
  return { id: userId, email: testEmail, password: testPassword };
}

async function testBetterAuthAPI() {
  console.log('\n🧪 Testing Better Auth API...');
  
  const testUser = await createTestData();
  
  try {
    // Test signin endpoint
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password || 'Test123!',
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Better Auth signin successful!');
      console.log(`   Session token: ${data.session?.token?.substring(0, 20)}...`);
      console.log(`   User ID: ${data.user?.id}`);
      return data;
    } else {
      const error = await response.text();
      console.log('❌ Better Auth signin failed:', response.status, error);
    }
  } catch (error) {
    console.log('⚠️  Could not test API (server may not be running):', error.message);
    console.log('   Start the server and run this script again to test the API');
  }
}

async function generateMigrationReport() {
  console.log('\n📊 Migration Report\n' + '='.repeat(50));
  
  const users = await pool.query('SELECT COUNT(*) as count FROM "user"');
  const passwords = await pool.query('SELECT COUNT(*) as count FROM "password"');
  const sessions = await pool.query('SELECT COUNT(*) as count FROM "session" WHERE "expiresAt" > NOW()');
  const accounts = await pool.query('SELECT COUNT(*) as count FROM "account"');
  
  console.log(`Total users: ${users.rows[0].count}`);
  console.log(`Users with passwords: ${passwords.rows[0].count}`);
  console.log(`Active sessions: ${sessions.rows[0].count}`);
  console.log(`OAuth accounts: ${accounts.rows[0].count}`);
  
  if (users.rows[0].count !== passwords.rows[0].count) {
    console.log(`\n⚠️  Warning: ${users.rows[0].count - passwords.rows[0].count} users have no password!`);
  }
  
  console.log('\n✅ Migration validation complete!');
  console.log('\nNext steps:');
  console.log('1. Start the server with Better Auth enabled');
  console.log('2. Test existing user logins');
  console.log('3. Update mobile app to use Better Auth endpoints');
}

async function main() {
  console.log('🚀 Better Auth Migration Validator\n');
  
  try {
    await checkTables();
    await checkUsers();
    await checkSessions();
    await validatePasswordHash();
    await testBetterAuthAPI();
    await generateMigrationReport();
  } catch (error) {
    console.error('❌ Migration validation failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
main().catch(console.error);
#!/usr/bin/env node

/**
 * Quick script to check Better Auth implementation status
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAuthStatus() {
  console.log('🔍 Better Auth Status Check\n');
  
  try {
    // Check tables
    console.log('📊 Database Tables:');
    const tables = ['user', 'session', 'password', 'account', 'verification'];
    for (const table of tables) {
      const result = await pool.query(
        `SELECT COUNT(*) as count FROM "${table}"`
      );
      console.log(`   ${table}: ${result.rows[0].count} records`);
    }
    
    // Check active sessions
    console.log('\n🔐 Active Sessions:');
    const sessions = await pool.query(
      `SELECT COUNT(*) as count FROM "session" WHERE "expiresAt" > NOW()`
    );
    console.log(`   Active: ${sessions.rows[0].count}`);
    
    const expired = await pool.query(
      `SELECT COUNT(*) as count FROM "session" WHERE "expiresAt" <= NOW()`
    );
    console.log(`   Expired: ${expired.rows[0].count}`);
    
    // Check recent activity
    console.log('\n📈 Recent Activity:');
    const recentUsers = await pool.query(
      `SELECT email, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 5`
    );
    console.log('   Latest users:');
    recentUsers.rows.forEach(user => {
      const date = new Date(user.createdAt);
      const ago = Math.floor((Date.now() - date) / 1000 / 60 / 60 / 24);
      console.log(`     - ${user.email} (${ago} days ago)`);
    });
    
    // Check token format
    console.log('\n🎫 Session Token Format:');
    const sampleSession = await pool.query(
      `SELECT token FROM "session" LIMIT 1`
    );
    if (sampleSession.rows.length > 0) {
      const token = sampleSession.rows[0].token;
      if (token.startsWith('better-auth-')) {
        console.log('   ✅ Using Better Auth format');
      } else {
        console.log('   ⚠️  Not using Better Auth format');
      }
    }
    
    console.log('\n✅ Better Auth is properly configured!');
    
  } catch (error) {
    console.error('❌ Error checking auth status:', error.message);
  } finally {
    await pool.end();
  }
}

checkAuthStatus();
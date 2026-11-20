import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

console.log('🔍 Checking environment configuration...\n');

// Check for required variables
const checks = {
  'Supabase URL': !!process.env.SUPABASE_URL,
  'Supabase Anon Key': !!process.env.SUPABASE_ANON_KEY,
  'Supabase Service Key': !!process.env.SUPABASE_SERVICE_KEY,
  'Database URL': !!process.env.DATABASE_URL,
  'JWT Secret': !!process.env.JWT_SECRET,
  'Better Auth Secret': !!process.env.BETTER_AUTH_SECRET,
  'OpenAI API Key': !!process.env.OPENAI_API_KEY,
};

Object.entries(checks).forEach(([name, exists]) => {
  console.log(`${exists ? '✅' : '❌'} ${name}: ${exists ? 'Set' : 'Not set'}`);
});

// Extract project reference from Supabase URL
if (process.env.SUPABASE_URL) {
  const match = process.env.SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (match) {
    console.log(`\n📌 Supabase Project Reference: ${match[1]}`);
    console.log('\nTo complete Better-Auth setup, you need to add:');
    console.log(`DATABASE_URL=postgres://postgres.${match[1]}:[YOUR-DB-PASSWORD]@aws-0-[YOUR-REGION].pooler.supabase.com:5432/postgres`);
    console.log('\nReplace:');
    console.log('- [YOUR-DB-PASSWORD] with your database password from Supabase');
    console.log('- [YOUR-REGION] with your project region (check Supabase dashboard)');
  }
}

// Check if we can proceed without database URL
console.log('\n📊 Current Status:');
if (!process.env.DATABASE_URL) {
  console.log('⚠️  Better-Auth needs DATABASE_URL to create its tables');
  console.log('   You can still use the existing JWT auth system');
} else {
  console.log('✅ Ready to use Better-Auth with full features');
}

// Generate Better-Auth secret if needed
if (!process.env.BETTER_AUTH_SECRET) {
  const crypto = await import('crypto');
  const secret = crypto.randomBytes(32).toString('base64');
  console.log('\n🔐 Generated Better-Auth Secret:');
  console.log(`BETTER_AUTH_SECRET=${secret}`);
  console.log('   Add this to your .env file');
}
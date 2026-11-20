import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupDatabaseURL() {
  console.log('🔧 Database URL Setup for Better-Auth\n');
  
  console.log('Better-Auth needs a direct PostgreSQL connection string.');
  console.log('You can find this in your Supabase project settings:\n');
  console.log('1. Go to https://app.supabase.com/project/YOUR_PROJECT/settings/database');
  console.log('2. Copy the "Connection string" from the "Connection Pooling" section');
  console.log('3. Use the "Transaction" mode connection string\n');
  
  const dbUrl = await question('Enter your Supabase database URL (postgres://...): ');
  
  if (!dbUrl || !dbUrl.startsWith('postgres://')) {
    console.error('❌ Invalid database URL. It should start with postgres://');
    process.exit(1);
  }
  
  // Read current .env
  const envPath = join(process.cwd(), '.env');
  let envContent = readFileSync(envPath, 'utf8');
  
  // Add or update DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${dbUrl}`);
  } else {
    envContent += `\n# Database Connection for Better-Auth\nDATABASE_URL=${dbUrl}\n`;
  }
  
  // Also add SUPABASE_DB_URL as alias
  if (!envContent.includes('SUPABASE_DB_URL=')) {
    envContent += `SUPABASE_DB_URL=${dbUrl}\n`;
  }
  
  writeFileSync(envPath, envContent);
  
  console.log('\n✅ Database URL added to .env file');
  console.log('\nYou can now run the migration script:');
  console.log('  node scripts/migrate-to-better-auth.js');
  
  rl.close();
}

setupDatabaseURL().catch(console.error);
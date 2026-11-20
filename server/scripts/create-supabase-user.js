require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createSupabaseUser() {
  const email = 'armt18@live.com';
  const tempPassword = 'TempPassword123!'; // Temporary password
  
  try {
    console.log('Attempting to create Supabase user for:', email);
    
    // First, try to sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: tempPassword,
      options: {
        data: {
          full_name: 'abdo',
          username: 'abdo'
        }
      }
    });
    
    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        console.log('❌ User already exists in Supabase Auth');
        console.log('\n🔧 Solution: User needs to reset their password');
        console.log('1. Go to the login screen');
        console.log('2. Click "Forgot Password"');
        console.log('3. Enter email: armt18@live.com');
        console.log('4. Check email for reset link');
      } else {
        console.error('❌ Sign up error:', signUpError);
      }
    } else {
      console.log('✅ User created in Supabase Auth!');
      console.log('User ID:', signUpData.user?.id);
      console.log('\n⚠️  IMPORTANT: User needs to:');
      console.log('1. Check their email for confirmation link');
      console.log('2. After confirming, login with:');
      console.log('   Email:', email);
      console.log('   Password:', tempPassword);
      console.log('3. Change password after first login');
      
      // Create/update profile
      if (signUpData.user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: signUpData.user.id,
            email: email,
            username: 'abdo',
            full_name: 'abdo',
            updated_at: new Date().toISOString()
          });
        
        if (profileError) {
          console.error('❌ Profile creation error:', profileError);
        } else {
          console.log('✅ Profile created/updated');
        }
      }
    }
    
    // Check if user exists in auth.users table directly
    console.log('\n--- Checking database directly ---');
    const authUserResult = await pool.query(
      'SELECT id, email, created_at FROM auth.users WHERE email = $1',
      [email]
    );
    
    if (authUserResult.rows.length > 0) {
      console.log('✅ User found in auth.users table:');
      console.log('- ID:', authUserResult.rows[0].id);
      console.log('- Email:', authUserResult.rows[0].email);
      console.log('- Created:', authUserResult.rows[0].created_at);
    } else {
      console.log('❌ User not found in auth.users table');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

createSupabaseUser();
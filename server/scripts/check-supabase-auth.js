require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkSupabaseAuth() {
  const email = 'armt18@live.com';
  
  try {
    // Try to get user by email using admin API
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      filter: `email.eq.${email}`
    });
    
    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }
    
    console.log('Supabase Auth Users matching email:', email);
    console.log('Found users:', users?.length || 0);
    
    if (users && users.length > 0) {
      users.forEach(user => {
        console.log('\n✅ User found in Supabase Auth:');
        console.log('- ID:', user.id);
        console.log('- Email:', user.email);
        console.log('- Email Confirmed:', user.email_confirmed_at ? 'Yes' : 'No');
        console.log('- Created:', user.created_at);
        console.log('- Last Sign In:', user.last_sign_in_at);
        console.log('- App Metadata:', JSON.stringify(user.app_metadata, null, 2));
        console.log('- User Metadata:', JSON.stringify(user.user_metadata, null, 2));
      });
    } else {
      console.log('\n❌ No user found in Supabase Auth with this email');
      console.log('This explains why login is failing!');
    }
    
    // Also check the profiles table
    console.log('\n--- Checking Profiles Table ---');
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .or(`email.eq.${email},username.eq.${email}`);
    
    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
    } else if (profiles && profiles.length > 0) {
      console.log('\n✅ Found profiles:');
      profiles.forEach(profile => {
        console.log('- ID:', profile.id);
        console.log('- Username:', profile.username);
        console.log('- Email:', profile.email);
        console.log('- Full Name:', profile.full_name);
      });
    } else {
      console.log('❌ No profiles found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSupabaseAuth();
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixMissingUsers() {
  console.log('Fixing missing users in users table...\n');
  
  try {
    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }
    
    console.log(`Found ${authUsers.users.length} users in auth system`);
    
    // Get all users from users table
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('id');
    
    if (dbError) {
      console.error('Error fetching users from database:', dbError);
      return;
    }
    
    const dbUserIds = new Set(dbUsers.map(u => u.id));
    console.log(`Found ${dbUsers.length} users in users table`);
    
    // Find missing users
    const missingUsers = authUsers.users.filter(authUser => !dbUserIds.has(authUser.id));
    
    if (missingUsers.length === 0) {
      console.log('\n✅ All auth users exist in users table!');
      return;
    }
    
    console.log(`\n⚠️  Found ${missingUsers.length} users missing from users table:`);
    
    // Insert missing users
    for (const authUser of missingUsers) {
      console.log(`\nProcessing user: ${authUser.email} (${authUser.id})`);
      
      // Insert into users table
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at
        });
      
      if (insertError) {
        if (insertError.code === '23505') {
          console.log('  → User already exists (duplicate key)');
        } else {
          console.error('  → Error inserting user:', insertError.message);
        }
      } else {
        console.log('  → ✅ User added to users table');
      }
      
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUser.id)
        .single();
      
      if (!profile && !profileError) {
        // Create profile
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.name || authUser.email.split('@')[0],
            created_at: authUser.created_at,
            updated_at: new Date().toISOString()
          });
        
        if (profileInsertError) {
          console.error('  → Error creating profile:', profileInsertError.message);
        } else {
          console.log('  → ✅ Profile created');
        }
      } else {
        console.log('  → Profile already exists');
      }
    }
    
    console.log('\n✅ Fix completed!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the fix
fixMissingUsers();
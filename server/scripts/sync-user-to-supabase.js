// Sync Better-Auth users to Supabase profiles
require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function syncUsersToSupabase() {
  try {
    console.log('Syncing Better-Auth users to Supabase...');
    
    // Get all users from Better-Auth
    const users = await pool.query('SELECT * FROM "user"');
    
    for (const user of users.rows) {
      console.log(`\nSyncing user: ${user.email}`);
      
      // Skip if user ID is not a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user.id)) {
        console.log(`Skipping user with invalid UUID: ${user.id}`);
        continue;
      }
      
      // Check if profile exists in Supabase
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking profile:', checkError);
        continue;
      }
      
      if (existingProfile) {
        console.log('Profile already exists, updating...');
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email: user.email,
            full_name: user.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error('Error updating profile:', updateError);
        } else {
          console.log('✅ Profile updated');
        }
      } else {
        console.log('Creating new profile...');
        // Create new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('Error creating profile:', insertError);
        } else {
          console.log('✅ Profile created');
        }
      }
    }
    
    console.log('\n✅ Sync complete');
    
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    await pool.end();
  }
}

syncUsersToSupabase();
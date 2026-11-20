// Create admin user in Supabase admin_users table
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createAdminUser() {
  try {
    const email = 'abdoadmin@tutorapp.com';
    const password = 'Pass123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('Creating admin user in admin_users table...');
    
    // First check if user exists
    const { data: existing, error: checkError } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('email', email)
      .single();
    
    if (existing && !checkError) {
      console.log('Admin user already exists, updating password...');
      
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({
          password_hash: hashedPassword,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);
      
      if (updateError) {
        console.error('Error updating admin user:', updateError);
      } else {
        console.log('✅ Admin user password updated successfully');
      }
    } else {
      // Create new admin user
      const { data, error: insertError } = await supabase
        .from('admin_users')
        .insert({
          email: email,
          password_hash: hashedPassword,
          name: 'Admin User',
          is_active: true
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating admin user:', insertError);
      } else {
        console.log('✅ Admin user created successfully:', data);
      }
    }
    
    console.log('\nAdmin credentials:');
    console.log('Email:', email);
    console.log('Password:', password);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createAdminUser();
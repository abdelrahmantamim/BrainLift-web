require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getSupabase } = require('../config/services.config');
const fs = require('fs');
const path = require('path');

async function setupAdminUser() {
  console.log('Setting up admin user...');
  
  try {
    const supabase = getSupabase();
    
    // First, check if admin_users table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'admin_users');
    
    console.log('Table check result:', { found: tables?.length > 0, error: tableError });
    
    // Try to create admin user directly
    const adminData = {
      email: 'abdoadmin@tutorapp.com',
      password: 'Pass123',
      name: 'Admin User',
      role: 'super_admin',
      is_active: true
    };
    
    // First check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', adminData.email)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for existing user:', checkError);
      // Table might not exist, let's try to create it
      console.log('Attempting to create admin_users table...');
      
      // Read and execute SQL file
      const sqlPath = path.join(__dirname, '../database/admin_users_setup.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      // Note: Supabase client doesn't support raw SQL execution
      // You'll need to run this SQL directly in Supabase dashboard
      console.log('\nPlease run the following SQL in your Supabase dashboard:\n');
      console.log(sql);
      console.log('\n');
      return;
    }
    
    if (existingUser) {
      console.log('Admin user already exists:', existingUser.email);
      
      // Update password to ensure it matches
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ password: adminData.password, updated_at: new Date().toISOString() })
        .eq('email', adminData.email);
      
      if (updateError) {
        console.error('Error updating admin password:', updateError);
      } else {
        console.log('Admin password updated successfully');
      }
    } else {
      // Create new admin user
      const { data: newUser, error: createError } = await supabase
        .from('admin_users')
        .insert([adminData])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating admin user:', createError);
      } else {
        console.log('Admin user created successfully:', newUser);
      }
    }
    
    // List all admin users
    const { data: allAdmins, error: listError } = await supabase
      .from('admin_users')
      .select('id, email, name, role, is_active');
    
    if (listError) {
      console.error('Error listing admin users:', listError);
    } else {
      console.log('\nAll admin users:');
      console.table(allAdmins);
    }
    
  } catch (error) {
    console.error('Setup error:', error);
  }
}

// Run the setup
setupAdminUser();
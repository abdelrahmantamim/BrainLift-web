#!/usr/bin/env node

// Admin user management script for admin_users table
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(dirname(__dirname), '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];
const email = args[1];
const password = args[2];

function showUsage() {
  console.log(`
Admin User Management Script
Usage:
  node manage-admin-user.js list                          - List all admin users
  node manage-admin-user.js create <email> <password>     - Create new admin user
  node manage-admin-user.js reset <email> <new-password>  - Reset admin password
  node manage-admin-user.js activate <email>              - Activate admin user
  node manage-admin-user.js deactivate <email>            - Deactivate admin user
  node manage-admin-user.js delete <email>                - Delete admin user

Examples:
  node manage-admin-user.js create admin@example.com SecurePass123!
  node manage-admin-user.js reset admin@example.com NewPass456!
  node manage-admin-user.js list
`);
}

async function listAdminUsers() {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, is_active, last_login, created_at');
  
  if (error) {
    console.error('Error listing admin users:', error);
    return;
  }
  
  if (data.length === 0) {
    console.log('No admin users found.');
    return;
  }
  
  console.log('\nAdmin Users:');
  console.table(data.map(user => ({
    Email: user.email,
    Name: user.name || 'N/A',
    Active: user.is_active ? 'Yes' : 'No',
    'Last Login': user.last_login ? new Date(user.last_login).toLocaleString() : 'Never',
    Created: new Date(user.created_at).toLocaleDateString()
  })));
}

async function createAdminUser(email, password) {
  if (!email || !password) {
    console.error('Email and password are required');
    showUsage();
    return;
  }
  
  // Validate password strength
  if (password.length < 8) {
    console.error('Password must be at least 8 characters long');
    return;
  }
  
  try {
    // Check if user already exists
    const { data: existing } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .single();
    
    if (existing) {
      console.error(`Admin user with email ${email} already exists`);
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        email: email,
        password_hash: hashedPassword,
        name: email.split('@')[0], // Use email prefix as default name
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating admin user:', error);
    } else {
      console.log('✅ Admin user created successfully');
      console.log('Email:', email);
      console.log('Password:', password);
      console.log('ID:', data.id);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function resetAdminPassword(email, newPassword) {
  if (!email || !newPassword) {
    console.error('Email and new password are required');
    showUsage();
    return;
  }
  
  // Validate password strength
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters long');
    return;
  }
  
  try {
    // Check if user exists
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('email', email)
      .single();
    
    if (!existing) {
      console.error(`Admin user with email ${email} not found`);
      return;
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    const { error } = await supabase
      .from('admin_users')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);
    
    if (error) {
      console.error('Error resetting password:', error);
    } else {
      console.log('✅ Password reset successfully');
      console.log('Email:', email);
      console.log('New Password:', newPassword);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function toggleAdminStatus(email, isActive) {
  if (!email) {
    console.error('Email is required');
    showUsage();
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select()
      .single();
    
    if (error) {
      console.error(`Error ${isActive ? 'activating' : 'deactivating'} admin user:`, error);
    } else if (!data) {
      console.error(`Admin user with email ${email} not found`);
    } else {
      console.log(`✅ Admin user ${isActive ? 'activated' : 'deactivated'} successfully`);
      console.log('Email:', email);
      console.log('Status:', isActive ? 'Active' : 'Inactive');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function deleteAdminUser(email) {
  if (!email) {
    console.error('Email is required');
    showUsage();
    return;
  }
  
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .delete()
      .eq('email', email)
      .select()
      .single();
    
    if (error) {
      console.error('Error deleting admin user:', error);
    } else if (!data) {
      console.error(`Admin user with email ${email} not found`);
    } else {
      console.log('✅ Admin user deleted successfully');
      console.log('Email:', email);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Main execution
async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY');
    return;
  }
  
  switch (command) {
    case 'list':
      await listAdminUsers();
      break;
    case 'create':
      await createAdminUser(email, password);
      break;
    case 'reset':
      await resetAdminPassword(email, password);
      break;
    case 'activate':
      await toggleAdminStatus(email, true);
      break;
    case 'deactivate':
      await toggleAdminStatus(email, false);
      break;
    case 'delete':
      await deleteAdminUser(email);
      break;
    default:
      showUsage();
  }
}

main().catch(console.error);
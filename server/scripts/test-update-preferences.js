#!/usr/bin/env node

import { config } from 'dotenv';
import { initializeDatabase } from '../config/database.config.js';
import { getSupabase } from '../config/services.config.js';

// Load environment variables
config();

async function testUpdatePreferences() {
  // Initialize database first
  await initializeDatabase();
  const supabase = getSupabase();
  const userId = '26e34fec-f7f1-4547-a99a-f94d6c825518';
  
  try {
    // First, fetch current profile
    console.log('Fetching current profile...');
    const { data: current, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      return;
    }
    
    console.log('Current profile:', {
      id: current.id,
      email: current.email,
      student_type: current.student_type,
      preferences: current.preferences
    });
    
    // Now update with preferences
    console.log('\nUpdating preferences...');
    const updateData = {
      preferences: {
        original_student_type: 'adult',
        ai_response_style: 'concise'
      },
      updated_at: new Date().toISOString()
    };
    
    console.log('Update data:', updateData);
    
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating profile:', updateError);
      return;
    }
    
    console.log('\nUpdated profile:', {
      id: updated.id,
      email: updated.email,
      student_type: updated.student_type,
      preferences: updated.preferences
    });
    
    // Verify by fetching again
    console.log('\nVerifying update...');
    const { data: verified, error: verifyError } = await supabase
      .from('profiles')
      .select('id, email, student_type, preferences')
      .eq('id', userId)
      .single();
    
    if (verifyError) {
      console.error('Error verifying:', verifyError);
      return;
    }
    
    console.log('Verified profile:', verified);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testUpdatePreferences();
#!/usr/bin/env node

import { config } from 'dotenv';
import { initializeDatabase } from '../config/database.config.js';
import { getSupabase } from '../config/services.config.js';

// Load environment variables
config();

async function testStudentTypeUpdate() {
  // Initialize database first
  await initializeDatabase();
  const supabase = getSupabase();
  const userId = '26e34fec-f7f1-4547-a99a-f94d6c825518';
  
  try {
    // Test updating to each new student type
    const studentTypes = [
      'elementary_school',
      'middle_school', 
      'high_school',
      'college_university',
      'adult_learner'
    ];
    
    for (const studentType of studentTypes) {
      console.log(`\nTesting update to: ${studentType}`);
      
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({
          student_type: studentType,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('id, email, student_type')
        .single();
      
      if (updateError) {
        console.error(`Error updating to ${studentType}:`, updateError);
      } else {
        console.log(`Successfully updated to: ${updated.student_type}`);
      }
    }
    
    // Final verification
    const { data: final, error: finalError } = await supabase
      .from('profiles')
      .select('id, email, student_type, preferences')
      .eq('id', userId)
      .single();
    
    console.log('\nFinal profile state:', final);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

testStudentTypeUpdate();
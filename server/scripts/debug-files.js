const { getSupabase } = require('../config/services.config');
require('dotenv').config();
const { initializeDatabase } = require('../config/database.config');

async function debugFiles() {
  initializeDatabase();
  
  setTimeout(async () => {
    const supabase = getSupabase();
    
    // The Better-Auth user ID for armt18@live.com
    const userId = '26e34fec-f7f1-4547-a99a-f94d6c825518';
    
    console.log('Debugging files for user:', userId);
    
    // Check Better-Auth user exists
    const { data: user, error: userError } = await supabase
      .from('user')
      .select('*')
      .eq('id', userId)
      .single();
    
    console.log('\nBetter-Auth user:', user ? {
      id: user.id,
      email: user.email,
      name: user.name
    } : 'NOT FOUND');
    
    // Check files with different queries
    console.log('\n--- Checking files table ---');
    
    // Query 1: Direct query
    const { data: files1, error: error1 } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .limit(5);
    
    console.log('\nDirect query result:', files1?.length || 0, 'files');
    if (error1) console.error('Error:', error1);
    
    // Query 2: Check all unique user_ids in files table
    const { data: uniqueUsers, error: error2 } = await supabase
      .from('files')
      .select('user_id')
      .limit(100);
    
    const uniqueUserIds = [...new Set(uniqueUsers?.map(f => f.user_id) || [])];
    console.log('\nUnique user_ids in files table:', uniqueUserIds.slice(0, 5));
    console.log('Does our userId exist in files?', uniqueUserIds.includes(userId));
    
    // Query 3: Case-sensitive check
    const { data: files3, error: error3 } = await supabase
      .from('files')
      .select('id, user_id, name')
      .eq('user_id', userId.toLowerCase())
      .limit(5);
    
    console.log('\nLowercase userId query:', files3?.length || 0, 'files');
    
    // Query 4: Check with ILIKE
    const { data: files4, error: error4 } = await supabase
      .from('files')
      .select('id, user_id, name')
      .ilike('user_id', userId)
      .limit(5);
    
    console.log('\nILIKE query:', files4?.length || 0, 'files');
    
    // Query 5: Show sample files
    console.log('\n--- Sample files for this user ---');
    if (files1 && files1.length > 0) {
      files1.forEach(file => {
        console.log(`- ${file.name} (ID: ${file.id}, Size: ${file.size} bytes)`);
      });
    }
    
    // Query 6: Try with service role if available
    try {
      const { getServiceSupabase } = require('../utils/getServiceSupabase');
      const serviceSupabase = getServiceSupabase();
      
      if (serviceSupabase) {
        const { data: serviceFiles, error: serviceError } = await serviceSupabase
          .from('files')
          .select('*')
          .eq('user_id', userId)
          .limit(5);
        
        console.log('\nService role query:', serviceFiles?.length || 0, 'files');
        if (serviceError) console.error('Service error:', serviceError);
      }
    } catch (e) {
      console.log('\nService role not available');
    }
    
    process.exit(0);
  }, 1000);
}

debugFiles();
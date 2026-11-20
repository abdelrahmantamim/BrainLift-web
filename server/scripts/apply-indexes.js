const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initializeServices, getSupabase } = require('../config/services.config');

async function applyIndexes() {
  console.log('🚀 Applying performance indexes to database...\n');
  
  try {
    // Initialize services before using them
    initializeServices();
    const supabase = getSupabase();
    const indexesSql = fs.readFileSync(
      path.join(__dirname, '..', 'migrations', '005_add_performance_indexes.sql'),
      'utf8'
    );
    
    // Split by semicolon and filter out empty statements
    const statements = indexesSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      if (!statement) continue;
      
      try {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', {
          query: statement + ';'
        });
        
        if (error && error.message?.includes('exec_sql')) {
          // exec_sql function not available, output SQL for manual execution
          console.log('\n⚠️  The exec_sql function is not available in your Supabase database.');
          console.log('⚠️  Please run the following SQL manually in the Supabase SQL editor:');
          console.log('\n================== SQL TO EXECUTE ==================');
          console.log(indexesSql);
          console.log('================== END OF SQL ==================\n');
          console.log('📌 To run this SQL:');
          console.log('   1. Go to your Supabase dashboard');
          console.log('   2. Navigate to SQL Editor');
          console.log('   3. Paste the SQL above and execute it');
          console.log('   4. All indexes will be created to improve performance\n');
          process.exit(0);
        } else if (error) {
          throw error;
        }
        
        successCount++;
        console.log('✅ Success');
      } catch (error) {
        errorCount++;
        console.log(`❌ Error: ${error.message}`);
        
        // Continue with other indexes even if one fails
        if (error.message?.includes('already exists')) {
          console.log('   (Index already exists, skipping)');
          successCount++;
          errorCount--;
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total statements: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 All indexes applied successfully!');
    } else {
      console.log('\n⚠️  Some indexes failed to apply. Check the errors above.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  applyIndexes()
    .then(() => {
      console.log('\n✅ Index application complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Index application failed:', error);
      process.exit(1);
    });
}

module.exports = { applyIndexes };
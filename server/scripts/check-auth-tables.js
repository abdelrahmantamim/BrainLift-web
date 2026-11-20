require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAuthTables() {
  try {
    // Check if password table exists
    const passwordTable = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'password')"
    );
    console.log('Password table exists:', passwordTable.rows[0].exists);
    
    // Check if account table has password column
    const accountColumns = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'account' AND column_name = 'password'"
    );
    console.log('Account table has password column:', accountColumns.rows.length > 0);
    
    // Check password table structure if it exists
    if (passwordTable.rows[0].exists) {
      const passwordColumns = await pool.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'password' ORDER BY ordinal_position"
      );
      console.log('\nPassword table columns:');
      passwordColumns.rows.forEach(col => console.log(`- ${col.column_name}: ${col.data_type}`));
      
      // Check if user has password
      const userPassword = await pool.query(
        'SELECT p.*, u.email FROM "password" p JOIN "user" u ON u.id = p."userId" WHERE u.email = $1',
        ['armt18@live.com']
      );
      console.log('\nPassword record for armt18@live.com:', userPassword.rows.length > 0 ? 'EXISTS' : 'NOT FOUND');
    }
    
    // Check account table
    const accountCheck = await pool.query(
      'SELECT a.*, u.email FROM "account" a JOIN "user" u ON u.id = a."userId" WHERE u.email = $1',
      ['armt18@live.com']
    );
    console.log('\nAccount record for armt18@live.com:', accountCheck.rows.length > 0 ? 'EXISTS' : 'NOT FOUND');
    
    if (accountCheck.rows.length > 0 && accountCheck.rows[0].password) {
      console.log('Account has password hash:', accountCheck.rows[0].password.substring(0, 20) + '...');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAuthTables();
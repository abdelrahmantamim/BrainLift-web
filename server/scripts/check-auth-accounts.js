require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAuthAccounts() {
  try {
    // Check user record
    const userResult = await pool.query(
      'SELECT id, email, name, "emailVerified", "createdAt" FROM "user" WHERE email = $1',
      ['armt18@live.com']
    );
    
    console.log('User record:');
    console.log(userResult.rows[0] || 'Not found');
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      
      // Check account records
      console.log('\nAccount records for this user:');
      const accountResult = await pool.query(
        'SELECT id, "providerId", "accountId", "createdAt" FROM "account" WHERE "userId" = $1',
        [userId]
      );
      
      if (accountResult.rows.length === 0) {
        console.log('❌ No account records found - this user has no way to authenticate!');
      } else {
        accountResult.rows.forEach(acc => {
          console.log(`- Provider: ${acc.providerId}, Account: ${acc.accountId}, Created: ${acc.createdAt}`);
        });
      }
      
      // Check if there's a credential account (for password login)
      const credentialAccount = accountResult.rows.find(acc => acc.providerId === 'credential');
      if (!credentialAccount) {
        console.log('\n❌ No credential account found - user cannot login with password!');
      } else {
        console.log('\n✅ Credential account exists');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkAuthAccounts();
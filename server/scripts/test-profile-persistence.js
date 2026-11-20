#!/usr/bin/env node

/**
 * Test script to verify profile persistence fixes
 * Tests that name and student_type changes persist when app reopens
 */

const axios = require('axios');
const { getSessionByToken } = require('../utils/better-auth-session.js');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

// Test profile updates
const PROFILE_UPDATES = {
  name: 'Test User Updated ' + Date.now(),
  studentType: 'college'
};

async function testProfilePersistence() {
  console.log('🧪 Testing Profile Persistence...\n');
  
  try {
    // Step 1: Sign in to get token
    console.log('1️⃣ Signing in...');
    const signInResponse = await axios.post(`${API_URL}/auth/sign-in/email`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    const { token, user: initialUser } = signInResponse.data;
    console.log(`   ✅ Signed in as: ${initialUser.email}`);
    console.log(`   Initial name: ${initialUser.name}`);
    console.log(`   Initial student_type: ${initialUser.student_type}\n`);
    
    // Step 2: Update profile
    console.log('2️⃣ Updating profile...');
    const updateResponse = await axios.put(
      `${API_URL}/user/profile`,
      {
        name: PROFILE_UPDATES.name,
        studentType: PROFILE_UPDATES.studentType
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const updatedUser = updateResponse.data.user;
    console.log(`   ✅ Profile updated`);
    console.log(`   New name: ${updatedUser.name}`);
    console.log(`   New student_type: ${updatedUser.student_type}\n`);
    
    // Step 3: Simulate app reopen by fetching session directly
    console.log('3️⃣ Simulating app reopen (fetching session)...');
    const sessionData = await getSessionByToken(token);
    
    if (!sessionData) {
      throw new Error('Failed to get session data');
    }
    
    console.log(`   ✅ Session retrieved`);
    console.log(`   Persisted name: ${sessionData.user.name}`);
    console.log(`   Persisted student_type: ${sessionData.user.student_type}\n`);
    
    // Step 4: Verify via /auth/me endpoint
    console.log('4️⃣ Verifying via /auth/me endpoint...');
    const meResponse = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const meUser = meResponse.data.user;
    console.log(`   ✅ /auth/me response`);
    console.log(`   Name from /auth/me: ${meUser.name}`);
    console.log(`   Student_type from /auth/me: ${meUser.student_type}\n`);
    
    // Step 5: Validate persistence
    console.log('5️⃣ Validation Results:');
    
    const nameMatches = 
      sessionData.user.name === PROFILE_UPDATES.name &&
      meUser.name === PROFILE_UPDATES.name;
    
    const studentTypeMatches = 
      sessionData.user.student_type === PROFILE_UPDATES.studentType &&
      meUser.student_type === PROFILE_UPDATES.studentType;
    
    if (nameMatches) {
      console.log('   ✅ Name persisted correctly');
    } else {
      console.log('   ❌ Name did NOT persist');
      console.log(`      Expected: ${PROFILE_UPDATES.name}`);
      console.log(`      Got (session): ${sessionData.user.name}`);
      console.log(`      Got (/auth/me): ${meUser.name}`);
    }
    
    if (studentTypeMatches) {
      console.log('   ✅ Student type persisted correctly');
    } else {
      console.log('   ❌ Student type did NOT persist');
      console.log(`      Expected: ${PROFILE_UPDATES.studentType}`);
      console.log(`      Got (session): ${sessionData.user.student_type}`);
      console.log(`      Got (/auth/me): ${meUser.student_type}`);
    }
    
    console.log('\n' + '='.repeat(50));
    if (nameMatches && studentTypeMatches) {
      console.log('🎉 SUCCESS: Profile changes persist correctly!');
    } else {
      console.log('⚠️  FAILURE: Profile changes do not persist');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the test
testProfilePersistence().then(() => {
  console.log('\n✅ All tests completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
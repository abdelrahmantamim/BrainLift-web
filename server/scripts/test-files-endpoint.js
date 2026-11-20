#!/usr/bin/env node

/**
 * Test script to verify files endpoint is working
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

async function testFilesEndpoint() {
  console.log('🧪 Testing Files Endpoint...\n');
  
  try {
    // Step 1: Sign in to get token
    console.log('1️⃣ Signing in...');
    const signInResponse = await axios.post(`${API_URL}/auth/sign-in/email`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    const { token } = signInResponse.data;
    console.log(`   ✅ Signed in successfully\n`);
    
    // Step 2: Test /files/list endpoint
    console.log('2️⃣ Testing /files/list endpoint...');
    const filesResponse = await axios.get(
      `${API_URL}/files/list`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const files = filesResponse.data.files || [];
    console.log(`   ✅ Files endpoint responded`);
    console.log(`   📁 Found ${files.length} files\n`);
    
    // Step 3: Display file details
    if (files.length > 0) {
      console.log('3️⃣ File Details:');
      files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name}`);
        console.log(`      - ID: ${file.id}`);
        console.log(`      - Type: ${file.type}`);
        console.log(`      - Size: ${file.size} bytes`);
      });
    } else {
      console.log('3️⃣ No files found in the library');
      console.log('   ℹ️  Upload some files to test quiz/flashcard generation from files');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Files endpoint is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
      console.error('   Status:', error.response.status);
    }
    process.exit(1);
  }
}

// Run the test
testFilesEndpoint().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const API_URL = process.env.API_URL || 'http://localhost:5001/api';

async function testShareCreation() {
  try {
    console.log('Testing share creation...');
    console.log('API URL:', API_URL);
    
    // First, we need a valid auth token
    // For testing, we'll use the test endpoint that doesn't require auth
    console.log('\nCreating test share link...');
    
    const testShareData = {
      contentType: 'quiz',
      title: 'Test Quiz Share',
      description: 'This is a test quiz for debugging share functionality',
      metadata: {
        questionCount: 10,
        difficulty: 'Medium',
        subject: 'Testing'
      }
    };
    
    const response = await axios.post(`${API_URL}/share/test-create`, testShareData);
    
    console.log('\nShare creation successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Test the share link retrieval
    if (response.data.shareId) {
      console.log('\nTesting share link retrieval...');
      const shareResponse = await axios.get(`${API_URL}/share/${response.data.shareId}`);
      console.log('Share data:', JSON.stringify(shareResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('\nError testing share creation:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testShareCreation();
#!/usr/bin/env node

/**
 * Concise Mode Testing Script
 * 
 * Tests the concise mode functionality in chat responses by comparing
 * detailed vs concise responses from the chat endpoint.
 * 
 * Usage: node server/scripts/test-concise-mode.js
 */

import axios from 'axios';

// Configuration
const CONFIG = {
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3001',
  TEST_USER_EMAIL: 'test@brainlift.app',
  TEST_USER_PASSWORD: 'TestPassword123!',
  TIMEOUT: 20000
};

// Test questions to compare concise vs detailed responses
const TEST_QUESTIONS = [
  "Explain how photosynthesis works",
  "What is the difference between mitosis and meiosis?",
  "How does the water cycle work?",
  "Explain the theory of evolution",
  "What causes climate change?"
];

class ConciseModeTest {
  constructor() {
    this.authToken = null;
    this.userId = null;
  }

  async authenticate() {
    try {
      console.log('🔐 Authenticating user...');
      
      const loginResponse = await axios.post(`${CONFIG.SERVER_URL}/api/auth/sign-in`, {
        email: CONFIG.TEST_USER_EMAIL,
        password: CONFIG.TEST_USER_PASSWORD
      }, {
        timeout: 5000
      });

      if (loginResponse.data.session) {
        this.authToken = loginResponse.data.session.token;
        this.userId = loginResponse.data.user.id;
        console.log('✅ Authentication successful');
        return true;
      }
      
      throw new Error('No session returned');
    } catch (error) {
      console.log('⚠️  Authentication failed, testing without auth...');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async sendChatMessage(message, aiResponseStyle = 'detailed') {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const requestData = {
      message,
      aiResponseStyle, // This is the key parameter for concise mode
      conversationId: null // New conversation each time for cleaner tests
    };

    const response = await axios.post(
      `${CONFIG.SERVER_URL}/api/chat/message`,
      requestData,
      { 
        headers,
        timeout: CONFIG.TIMEOUT
      }
    );

    return response.data;
  }

  async testConciseMode() {
    console.log('\n📝 Testing Concise Mode vs Detailed Mode...\n');

    const results = [];

    for (let i = 0; i < TEST_QUESTIONS.length; i++) {
      const question = TEST_QUESTIONS[i];
      console.log(`🧪 Testing question ${i + 1}/${TEST_QUESTIONS.length}: "${question}"`);

      try {
        const startTime = Date.now();

        // Send both requests in parallel
        const [detailedResponse, conciseResponse] = await Promise.all([
          this.sendChatMessage(question, 'detailed'),
          this.sendChatMessage(question, 'concise')
        ]);

        const testTime = Date.now() - startTime;

        const detailedText = detailedResponse.response || detailedResponse.message || '';
        const conciseText = conciseResponse.response || conciseResponse.message || '';

        const detailedLength = detailedText.length;
        const conciseLength = conciseText.length;
        const lengthReduction = Math.round((1 - conciseLength / detailedLength) * 100);

        // Count sentences (rough estimate)
        const detailedSentences = (detailedText.match(/[.!?]+/g) || []).length;
        const conciseSentences = (conciseText.match(/[.!?]+/g) || []).length;

        const isEffective = conciseLength < detailedLength && 
                           conciseLength > 50 && // Not too short to be useless
                           lengthReduction > 10; // At least 10% reduction

        results.push({
          question: question.substring(0, 50) + '...',
          detailedLength,
          conciseLength,
          detailedSentences,
          conciseSentences,
          lengthReduction,
          testTime,
          effective: isEffective
        });

        console.log(`   📊 Detailed: ${detailedLength} chars (${detailedSentences} sentences)`);
        console.log(`   📊 Concise: ${conciseLength} chars (${conciseSentences} sentences)`);
        console.log(`   📈 Reduction: ${lengthReduction}% ${isEffective ? '✅' : '❌'}`);
        console.log(`   ⏱️  Time: ${testTime}ms\n`);

        // Show sample responses for first question
        if (i === 0) {
          console.log('   📝 Sample Detailed Response:');
          console.log(`   "${detailedText.substring(0, 150)}..."\n`);
          console.log('   📝 Sample Concise Response:');
          console.log(`   "${conciseText.substring(0, 150)}..."\n`);
        }

      } catch (error) {
        console.log(`   ❌ Failed: ${error.response?.data?.error?.message || error.message}\n`);
        results.push({
          question: question.substring(0, 50) + '...',
          error: error.message,
          effective: false
        });
      }

      // Small delay between requests to be nice to the server
      if (i < TEST_QUESTIONS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  analyzeResults(results) {
    console.log('📊 ANALYSIS RESULTS');
    console.log('==================\n');

    const validResults = results.filter(r => !r.error);
    const effectiveResults = validResults.filter(r => r.effective);

    if (validResults.length === 0) {
      console.log('❌ No valid test results to analyze');
      return false;
    }

    console.log(`✅ Valid tests: ${validResults.length}/${results.length}`);
    console.log(`🎯 Effective concise responses: ${effectiveResults.length}/${validResults.length}`);
    
    const successRate = Math.round((effectiveResults.length / validResults.length) * 100);
    console.log(`📈 Success rate: ${successRate}%\n`);

    // Calculate averages
    const avgDetailedLength = Math.round(validResults.reduce((sum, r) => sum + (r.detailedLength || 0), 0) / validResults.length);
    const avgConciseLength = Math.round(validResults.reduce((sum, r) => sum + (r.conciseLength || 0), 0) / validResults.length);
    const avgReduction = Math.round(validResults.reduce((sum, r) => sum + (r.lengthReduction || 0), 0) / validResults.length);
    const avgTestTime = Math.round(validResults.reduce((sum, r) => sum + (r.testTime || 0), 0) / validResults.length);

    console.log('📊 AVERAGES:');
    console.log(`   Detailed response length: ${avgDetailedLength} characters`);
    console.log(`   Concise response length: ${avgConciseLength} characters`);
    console.log(`   Average length reduction: ${avgReduction}%`);
    console.log(`   Average test time: ${avgTestTime}ms\n`);

    // Show individual results
    console.log('📋 INDIVIDUAL RESULTS:');
    results.forEach((result, index) => {
      if (result.error) {
        console.log(`   ${index + 1}. ❌ ${result.question}: ${result.error}`);
      } else {
        const status = result.effective ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${result.question}: ${result.lengthReduction}% reduction`);
      }
    });

    console.log('\n🏆 OVERALL ASSESSMENT:');
    
    if (successRate >= 80) {
      console.log('✅ Concise mode is working excellently');
    } else if (successRate >= 60) {
      console.log('⚠️  Concise mode is working but could be improved');
    } else {
      console.log('❌ Concise mode needs significant improvement');
    }

    if (avgReduction >= 30) {
      console.log('✅ Good length reduction achieved');
    } else if (avgReduction >= 15) {
      console.log('⚠️  Moderate length reduction');
    } else {
      console.log('❌ Insufficient length reduction');
    }

    const isSuccessful = successRate >= 60 && avgReduction >= 15;
    
    console.log('\n🎯 RECOMMENDATIONS:');
    if (!isSuccessful) {
      if (avgReduction < 15) {
        console.log('- Review concise mode prompt to ensure stronger brevity instructions');
        console.log('- Consider adjusting max token limits for concise responses');
      }
      if (successRate < 60) {
        console.log('- Check if aiResponseStyle parameter is being properly processed');
        console.log('- Verify that the concise system prompt is being applied correctly');
      }
    } else {
      console.log('- Concise mode is working well!');
      console.log('- Consider testing with more complex topics to ensure consistency');
    }

    return isSuccessful;
  }

  async runAllTests() {
    console.log('🧪 CONCISE MODE TEST SUITE');
    console.log('=========================');

    // Authenticate
    await this.authenticate();

    // Test concise mode
    const results = await this.testConciseMode();

    // Analyze results
    const success = this.analyzeResults(results);

    console.log(`\n🏁 FINAL RESULT: ${success ? '✅ PASSED' : '❌ FAILED'}`);
    
    return success;
  }
}

// Main execution
async function main() {
  const tester = new ConciseModeTest();
  
  try {
    const success = await tester.runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  }
}

// Handle timeout
const timeout = setTimeout(() => {
  console.error('⏰ Test suite timed out');
  process.exit(1);
}, CONFIG.TIMEOUT * TEST_QUESTIONS.length + 10000);

// Run tests
main().finally(() => {
  clearTimeout(timeout);
});
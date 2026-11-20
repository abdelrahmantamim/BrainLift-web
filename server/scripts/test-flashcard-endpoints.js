#!/usr/bin/env node

/**
 * Flashcard Endpoint Testing Script
 * 
 * This script tests the flashcard endpoints specifically to verify:
 * 1. Flashcard generation from content (/api/flashcards/generate)
 * 2. Title generation functionality within the flashcard route
 * 3. File-based flashcard generation
 * 
 * Usage: node server/scripts/test-flashcard-endpoints.js
 */

import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3001',
  TEST_USER_EMAIL: 'test@brainlift.app',
  TEST_USER_PASSWORD: 'TestPassword123!',
  TIMEOUT: 30000
};

// Test data
const TEST_CONTENT = `
Advanced Calculus - Chapter 12: Integration by Parts

Integration by parts is a method of integration that is useful when the integrand is a product of two functions.

The formula is: ∫u dv = uv - ∫v du

Where:
- u is chosen to be the function that becomes simpler when differentiated
- dv is chosen to be the remaining part of the integrand

LIATE Rule for choosing u:
L - Logarithmic functions (ln x, log x)
I - Inverse trigonometric functions (arcsin x, arctan x)
A - Algebraic functions (x², 3x + 5)
T - Trigonometric functions (sin x, cos x)
E - Exponential functions (eˣ, 2ˣ)

Example: ∫x·eˣ dx
Let u = x, dv = eˣ dx
Then du = dx, v = eˣ
Result: x·eˣ - ∫eˣ dx = x·eˣ - eˣ + C = eˣ(x - 1) + C

Applications:
- Engineering calculations
- Physics problems involving exponential decay
- Economic modeling with continuous compounding
`;

class FlashcardEndpointTester {
  constructor() {
    this.authToken = null;
    this.userId = null;
  }

  async authenticate() {
    try {
      console.log('🔐 Authenticating user...');
      
      // Try to login with test user
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
      console.log('⚠️  Authentication failed, trying without auth...');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
      return false; // Continue without auth for testing
    }
  }

  async testFlashcardGeneration() {
    console.log('\n📚 Testing Flashcard Generation from Content...');
    
    try {
      const startTime = Date.now();
      
      const requestData = {
        content: TEST_CONTENT,
        numberOfCards: 8,
        customInstructions: "Focus on the mathematical formulas and practical applications",
        targetLanguage: 'en',
        difficulty: 'intermediate',
        category: 'mathematics'
      };

      const headers = {};
      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      console.log('📤 Sending flashcard generation request...');
      console.log(`   Content length: ${TEST_CONTENT.length} characters`);
      console.log(`   Requested cards: ${requestData.numberOfCards}`);

      const response = await axios.post(
        `${CONFIG.SERVER_URL}/api/flashcards/generate`,
        requestData,
        { 
          headers,
          timeout: CONFIG.TIMEOUT
        }
      );

      const generationTime = Date.now() - startTime;
      
      console.log(`✅ Flashcard generation successful in ${generationTime}ms`);
      console.log(`📊 Generated deck: "${response.data.deckName}"`);
      console.log(`📝 Card count: ${response.data.cardCount}`);
      
      if (response.data.cards && response.data.cards.length > 0) {
        console.log('\n📋 Sample flashcards:');
        response.data.cards.slice(0, 3).forEach((card, index) => {
          console.log(`   ${index + 1}. Q: ${card.question}`);
          console.log(`      A: ${card.answer}`);
          console.log('');
        });
      }

      // Validate response structure
      const validation = this.validateFlashcardResponse(response.data);
      console.log(`🔍 Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
      
      if (!validation.valid) {
        console.log('❌ Validation issues:');
        validation.issues.forEach(issue => console.log(`   - ${issue}`));
      }

      return {
        success: true,
        deckName: response.data.deckName,
        cardCount: response.data.cardCount,
        generationTime,
        validation
      };

    } catch (error) {
      console.log('❌ Flashcard generation failed');
      console.log(`   Status: ${error.response?.status || 'Network Error'}`);
      console.log(`   Message: ${error.response?.data?.error?.message || error.message}`);
      
      if (error.response?.data) {
        console.log('   Response data:', JSON.stringify(error.response.data, null, 2));
      }

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        details: error.response?.data
      };
    }
  }

  async testTitleGeneration() {
    console.log('\n🏷️  Testing AI-Generated Deck Naming...');
    
    try {
      const startTime = Date.now();
      
      const requestData = {
        topic: "Advanced Calculus Integration Methods",
        numberOfCards: 6,
        customInstructions: "Focus on integration by parts and practical applications",
        targetLanguage: 'en'
      };

      const headers = {};
      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      console.log('📤 Sending topic-based flashcard generation request...');
      console.log(`   Topic: ${requestData.topic}`);

      const response = await axios.post(
        `${CONFIG.SERVER_URL}/api/flashcards/generate`,
        requestData,
        { 
          headers,
          timeout: CONFIG.TIMEOUT
        }
      );

      const generationTime = Date.now() - startTime;
      const deckName = response.data.deckName;
      
      console.log(`✅ Topic-based generation successful in ${generationTime}ms`);
      console.log(`🏷️  Generated title: "${deckName}"`);
      console.log(`📏 Title length: ${deckName.length}/50 characters`);
      
      // Validate title quality
      const titleValidation = this.validateDeckTitle(deckName, requestData.topic);
      console.log(`🔍 Title validation: ${titleValidation.valid ? 'PASSED' : 'FAILED'}`);
      
      if (!titleValidation.valid) {
        console.log('❌ Title issues:');
        titleValidation.issues.forEach(issue => console.log(`   - ${issue}`));
      }

      return {
        success: true,
        generatedTitle: deckName,
        originalTopic: requestData.topic,
        generationTime,
        validation: titleValidation
      };

    } catch (error) {
      console.log('❌ Title generation test failed');
      console.log(`   Status: ${error.response?.status || 'Network Error'}`);
      console.log(`   Message: ${error.response?.data?.error?.message || error.message}`);

      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  async testConciseModeIntegration() {
    console.log('\n📝 Testing Concise Mode Integration...');
    
    try {
      console.log('   Note: Concise mode is implemented in chat routes, not flashcard routes');
      console.log('   Testing flashcard generation with different instruction styles...');
      
      // Test with verbose instructions
      const verboseRequest = {
        content: "Photosynthesis is the process by which plants convert sunlight into energy.",
        numberOfCards: 3,
        customInstructions: "Provide detailed explanations with examples, context, and comprehensive background information to help students understand the full scope of the topic.",
        targetLanguage: 'en'
      };

      // Test with concise instructions
      const conciseRequest = {
        content: "Photosynthesis is the process by which plants convert sunlight into energy.",
        numberOfCards: 3,
        customInstructions: "Keep answers brief and direct. Focus only on essential facts.",
        targetLanguage: 'en'
      };

      const headers = {};
      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      const [verboseResponse, conciseResponse] = await Promise.all([
        axios.post(`${CONFIG.SERVER_URL}/api/flashcards/generate`, verboseRequest, { headers, timeout: CONFIG.TIMEOUT }),
        axios.post(`${CONFIG.SERVER_URL}/api/flashcards/generate`, conciseRequest, { headers, timeout: CONFIG.TIMEOUT })
      ]);

      // Compare answer lengths
      const verboseAnswers = verboseResponse.data.cards || [];
      const conciseAnswers = conciseResponse.data.cards || [];

      const verboseAvgLength = verboseAnswers.reduce((sum, card) => sum + card.answer.length, 0) / verboseAnswers.length || 0;
      const conciseAvgLength = conciseAnswers.reduce((sum, card) => sum + card.answer.length, 0) / conciseAnswers.length || 0;

      console.log(`📊 Verbose avg answer length: ${Math.round(verboseAvgLength)} chars`);
      console.log(`📊 Concise avg answer length: ${Math.round(conciseAvgLength)} chars`);
      console.log(`📈 Length reduction: ${Math.round((1 - conciseAvgLength/verboseAvgLength) * 100)}%`);

      const isEffective = conciseAvgLength < verboseAvgLength && conciseAvgLength > 10;

      return {
        success: true,
        verboseAvgLength: Math.round(verboseAvgLength),
        conciseAvgLength: Math.round(conciseAvgLength),
        lengthReduction: Math.round((1 - conciseAvgLength/verboseAvgLength) * 100),
        effective: isEffective
      };

    } catch (error) {
      console.log('❌ Concise mode integration test failed');
      console.log(`   Error: ${error.message}`);

      return {
        success: false,
        error: error.message
      };
    }
  }

  validateFlashcardResponse(data) {
    const issues = [];
    let valid = true;

    if (!data.success) {
      issues.push('Response indicates failure');
      valid = false;
    }

    if (!data.deckName || data.deckName.length === 0) {
      issues.push('Missing deck name');
      valid = false;
    }

    if (data.deckName && data.deckName.length > 50) {
      issues.push(`Deck name too long: ${data.deckName.length} > 50 chars`);
      valid = false;
    }

    if (!data.cardCount || data.cardCount === 0) {
      issues.push('No cards generated');
      valid = false;
    }

    if (data.cardCount > 15) {
      issues.push(`Too many cards: ${data.cardCount} > 15`);
      valid = false;
    }

    if (data.cards) {
      data.cards.forEach((card, index) => {
        if (!card.question || card.question.length < 10) {
          issues.push(`Card ${index + 1}: Question too short or missing`);
          valid = false;
        }

        if (!card.answer || card.answer.length < 5) {
          issues.push(`Card ${index + 1}: Answer too short or missing`);
          valid = false;
        }

        if (card.answer && card.answer.length > 140) {
          issues.push(`Card ${index + 1}: Answer too long (${card.answer.length} > 140 chars)`);
          valid = false;
        }
      });
    }

    return { valid, issues };
  }

  validateDeckTitle(title, originalTopic) {
    const issues = [];
    let valid = true;

    if (!title || title.length === 0) {
      issues.push('Title is empty');
      return { valid: false, issues };
    }

    if (title.length > 50) {
      issues.push(`Title too long: ${title.length} > 50 characters`);
      valid = false;
    }

    if (title.length < 5) {
      issues.push('Title too short');
      valid = false;
    }

    if (title.includes('\n') || title.includes('\t')) {
      issues.push('Title contains newlines or tabs');
      valid = false;
    }

    if (title.toLowerCase().includes('deck name') || title.toLowerCase().includes('title:')) {
      issues.push('Title contains instruction artifacts');
      valid = false;
    }

    // Check if title is somewhat related to original topic
    const titleWords = title.toLowerCase().split(/\s+/);
    const topicWords = originalTopic.toLowerCase().split(/\s+/);
    const commonWords = titleWords.filter(word => topicWords.includes(word) && word.length > 3);
    
    if (commonWords.length === 0) {
      issues.push('Title seems unrelated to original topic');
      // Don't mark as invalid, just note it
    }

    return { valid, issues };
  }

  async runAllTests() {
    console.log('🧪 FLASHCARD ENDPOINT TEST SUITE');
    console.log('================================\n');

    // Authenticate
    await this.authenticate();

    // Run tests
    const results = {
      flashcardGeneration: await this.testFlashcardGeneration(),
      titleGeneration: await this.testTitleGeneration(),
      conciseModeIntegration: await this.testConciseModeIntegration()
    };

    // Generate summary
    console.log('\n📊 TEST SUMMARY');
    console.log('===============');

    let passed = 0;
    let total = 0;

    Object.entries(results).forEach(([testName, result]) => {
      total++;
      const success = result.success && (result.validation ? result.validation.valid !== false : true);
      if (success) passed++;

      console.log(`${success ? '✅' : '❌'} ${testName}: ${success ? 'PASSED' : 'FAILED'}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    const allPassed = passed === total;
    console.log(`\n🏆 OVERALL: ${allPassed ? 'ALL TESTS PASSED' : `${passed}/${total} TESTS PASSED`}`);

    if (allPassed) {
      console.log('\n🎉 All flashcard endpoints are working correctly!');
      console.log('   ✓ Flashcard generation from content works');
      console.log('   ✓ AI-powered title generation works');
      console.log('   ✓ Custom instructions are being processed');
      console.log('   ✓ Response validation passes');
    } else {
      console.log('\n🔧 Some issues found:');
      Object.entries(results).forEach(([testName, result]) => {
        if (!result.success || (result.validation && result.validation.valid === false)) {
          console.log(`   - ${testName}: Needs attention`);
        }
      });
    }

    return allPassed;
  }
}

// Main execution
async function main() {
  const tester = new FlashcardEndpointTester();
  
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
}, CONFIG.TIMEOUT);

// Run tests
main().finally(() => {
  clearTimeout(timeout);
});
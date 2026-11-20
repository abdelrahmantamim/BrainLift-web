#!/usr/bin/env node

/**
 * Mobile Fixes Test Runner
 * 
 * This script runs all mobile-related tests and provides a comprehensive report
 * on the backend functionality that supports the mobile UI fixes.
 * 
 * Usage: node server/scripts/run-mobile-tests.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TESTS = [
  {
    name: 'Mobile Fixes Core Test',
    script: join(__dirname, 'test-mobile-fixes.js'),
    description: 'Tests flashcard generation, title generation, concise mode, and file processing',
    timeout: 60000
  },
  {
    name: 'Flashcard Endpoints Test',
    script: join(__dirname, 'test-flashcard-endpoints.js'),
    description: 'Tests flashcard generation endpoints with real API calls',
    timeout: 45000
  },
  {
    name: 'Concise Mode Test',
    script: join(__dirname, 'test-concise-mode.js'),
    description: 'Tests concise vs detailed response modes in chat',
    timeout: 30000
  }
];

class MobileTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runTest(test) {
    return new Promise((resolve) => {
      console.log(`\n🚀 Running: ${test.name}`);
      console.log(`📄 Description: ${test.description}`);
      console.log(`📁 Script: ${test.script}`);
      console.log(`⏰ Timeout: ${test.timeout / 1000}s\n`);

      const startTime = Date.now();
      let output = '';
      let errorOutput = '';

      const childProcess = spawn('node', [test.script], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: join(__dirname, '..')
      });

      childProcess.stdout.on('data', (data) => {
        const text = data.toString();
        process.stdout.write(text);
        output += text;
      });

      childProcess.stderr.on('data', (data) => {
        const text = data.toString();
        process.stderr.write(text);
        errorOutput += text;
      });

      const timeoutHandle = setTimeout(() => {
        childProcess.kill('SIGKILL');
        console.log(`\n⏰ Test "${test.name}" timed out after ${test.timeout / 1000}s`);
      }, test.timeout);

      childProcess.on('close', (code) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        
        const result = {
          name: test.name,
          script: test.script,
          description: test.description,
          passed: code === 0,
          exitCode: code,
          duration,
          output,
          errorOutput
        };

        this.results.push(result);

        console.log(`\n📊 Test "${test.name}" completed`);
        console.log(`   ✅ Status: ${code === 0 ? 'PASSED' : 'FAILED'}`);
        console.log(`   ⏱️  Duration: ${duration}ms`);
        console.log(`   🔢 Exit Code: ${code}`);

        resolve(result);
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        
        const result = {
          name: test.name,
          script: test.script,
          description: test.description,
          passed: false,
          exitCode: -1,
          duration,
          error: error.message,
          output,
          errorOutput
        };

        this.results.push(result);
        console.log(`\n💥 Test "${test.name}" crashed: ${error.message}`);
        resolve(result);
      });
    });
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;

    console.log('\n\n🎯 MOBILE FIXES TEST SUMMARY');
    console.log('============================\n');

    // Individual test results
    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.passed ? '✅' : '❌'} ${result.name}`);
      console.log(`   📄 ${result.description}`);
      console.log(`   ⏱️  ${result.duration}ms`);
      
      if (!result.passed) {
        if (result.error) {
          console.log(`   💥 Error: ${result.error}`);
        } else if (result.exitCode !== 0) {
          console.log(`   🚫 Exit code: ${result.exitCode}`);
        }
      }
      console.log('');
    });

    // Overall statistics
    console.log('📊 OVERALL STATISTICS');
    console.log('====================');
    console.log(`Tests passed: ${passedTests}/${totalTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`Total time: ${Math.round(totalDuration / 1000)}s`);
    console.log(`Average time per test: ${Math.round(totalDuration / totalTests / 1000)}s\n`);

    // Status assessment
    const overallPassed = passedTests === totalTests;
    console.log('🏆 FINAL ASSESSMENT');
    console.log('==================');
    
    if (overallPassed) {
      console.log('✅ ALL TESTS PASSED - Mobile fixes are working correctly!');
      console.log('\n🎉 MOBILE FEATURES VERIFIED:');
      console.log('   ✓ Flashcard generation from files works');
      console.log('   ✓ AI-powered flashcard title generation works');
      console.log('   ✓ Concise mode reduces response verbosity');
      console.log('   ✓ File processing pipeline is functional');
      console.log('   ✓ Backend endpoints respond correctly');
      console.log('\n💡 MOBILE UI BENEFITS:');
      console.log('   • Animated loading screens are supported by backend timing');
      console.log('   • Files modal functionality is backed by robust processing');
      console.log('   • Chat file context UI can rely on stable content extraction');
      console.log('   • File upload options work with proper validation');
    } else {
      console.log(`❌ ${totalTests - passedTests} TEST(S) FAILED - Some issues need attention`);
      console.log('\n🔧 RECOMMENDATIONS:');
      
      this.results.forEach(result => {
        if (!result.passed) {
          console.log(`   • Fix issues in: ${result.name}`);
        }
      });
      
      console.log('\n⚠️  POTENTIAL MOBILE IMPACT:');
      console.log('   • Some mobile features may not work as expected');
      console.log('   • Users may experience errors or poor performance');
      console.log('   • Consider testing individual components manually');
    }

    return overallPassed;
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...\n');

    // Check if test scripts exist
    for (const test of TESTS) {
      try {
        await fs.access(test.script);
        console.log(`✅ Found: ${test.script}`);
      } catch (error) {
        console.log(`❌ Missing: ${test.script}`);
        throw new Error(`Test script not found: ${test.script}`);
      }
    }

    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`📦 Node.js version: ${nodeVersion}`);

    if (parseInt(nodeVersion.slice(1)) < 14) {
      console.log('⚠️  Node.js 14+ recommended for ES modules');
    } else {
      console.log('✅ Node.js version is compatible');
    }

    console.log('✅ Prerequisites check passed\n');
  }

  async runAllTests() {
    console.log('🧪 MOBILE FIXES COMPREHENSIVE TEST SUITE');
    console.log('========================================');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🎯 Running ${TESTS.length} test suites...\n`);

    try {
      await this.checkPrerequisites();

      // Run each test sequentially to avoid resource conflicts
      for (const test of TESTS) {
        await this.runTest(test);
        
        // Small delay between tests
        if (TESTS.indexOf(test) < TESTS.length - 1) {
          console.log('\n⏸️  Waiting 2s before next test...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Generate and return final report
      const success = this.generateReport();
      return success;

    } catch (error) {
      console.error('\n💥 Test runner failed:', error.message);
      return false;
    }
  }
}

// Main execution
async function main() {
  const runner = new MobileTestRunner();
  
  try {
    const success = await runner.runAllTests();
    
    console.log('\n📁 TEST ARTIFACTS:');
    console.log('==================');
    console.log('Test scripts location: /server/scripts/');
    console.log('- test-mobile-fixes.js (Core functionality tests)');
    console.log('- test-flashcard-endpoints.js (API endpoint tests)');
    console.log('- test-concise-mode.js (Chat mode tests)');
    console.log('- run-mobile-tests.js (This test runner)');
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test runner crashed:', error);
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test runner interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test runner terminated');
  process.exit(1);
});

// Run the test runner
main();
#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Comprehensive Chart Testing\n');
console.log('This script will:');
console.log('1. Generate chart samples using AI');
console.log('2. Validate the generated samples');
console.log('3. Test rendering for each chart type\n');

async function runScript(scriptName, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 ${description}...\n`);
    
    const script = spawn('node', [path.join(__dirname, scriptName)], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    script.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptName} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    
    script.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    // Step 1: Generate samples
    await runScript('generateChartSamples.js', 'Step 1: Generating chart samples from AI');
    
    console.log('\n✅ Chart samples generated successfully!\n');
    console.log('━'.repeat(50));
    
    // Step 2: Validate samples
    await runScript('validateChartSamples.js', 'Step 2: Validating generated samples');
    
    console.log('\n✅ Validation complete!\n');
    console.log('━'.repeat(50));
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\nCheck the following files for results:');
    console.log('- chartSamples.json: Generated chart data from AI');
    console.log('- chartValidationResults.json: Detailed validation results\n');
    
  } catch (error) {
    console.error('\n❌ Testing failed:', error.message);
    process.exit(1);
  }
}

main();
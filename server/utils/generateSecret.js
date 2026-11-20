#!/usr/bin/env node

/**
 * Utility to generate a secure JWT secret
 * Run this script to generate a new JWT secret for your .env file
 */

const crypto = require('crypto');

function generateJWTSecret() {
  // Generate a 64-byte (512-bit) random secret
  const secret = crypto.randomBytes(64).toString('hex');
  
  console.log('\n=== JWT Secret Generator ===\n');
  console.log('Add this to your .env file:');
  console.log(`JWT_SECRET=${secret}`);
  console.log('\nWARNING: Keep this secret secure and never commit it to version control!');
  console.log('Each environment (development, staging, production) should have its own unique secret.\n');
  
  return secret;
}

// Run if called directly
if (require.main === module) {
  generateJWTSecret();
}

module.exports = { generateJWTSecret };
#!/usr/bin/env node

import { config } from 'dotenv';
import { initializeRedis, clearCachePattern, closeRedis } from '../config/redis.config.js';

// Load environment variables
config();

async function clearUserCache() {
  console.log('Initializing Redis connection...');
  initializeRedis();
  
  // Wait a bit for Redis to connect
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // Clear all user-related cache patterns
    const patterns = [
      'user:*',
      'api:*',
      'quiz:*',
      'quiz:v2:*',
      'quiz:v3:*',
      'files:*',
      'chat:*'
    ];
    
    console.log('Clearing cache patterns...');
    for (const pattern of patterns) {
      const result = await clearCachePattern(pattern);
      console.log(`Cleared pattern ${pattern}: ${result ? 'success' : 'failed'}`);
    }
    
    console.log('Cache cleared successfully!');
  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    await closeRedis();
    process.exit(0);
  }
}

clearUserCache();
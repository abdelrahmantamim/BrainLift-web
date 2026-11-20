// Script to clear the semantic cache
import semanticCache from '../utils/semanticCache.js';

// Clear all cache entries
semanticCache.cache.clear();

console.log('✅ Semantic cache cleared successfully');
console.log('Cache stats:', semanticCache.getStats());
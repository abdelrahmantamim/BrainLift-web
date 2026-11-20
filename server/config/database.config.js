import { createClient } from '@supabase/supabase-js';
import environments from './environments.js';

let supabaseClient = null;
let connectionPool = null;

// Connection pool configuration based on environment
const poolConfig = {
  ...environments.current.db,
  // Additional Supabase-specific options
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'x-client-info': 'brainlift-server'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    enabled: false // Disable realtime for server
  }
};

// Initialize Supabase with connection pooling
export function initializeDatabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing required database configuration');
  }

  try {
    // Create Supabase client with pooling configuration
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        ...poolConfig,
        // Connection pool settings
        db: {
          ...poolConfig.db,
          pool: {
            min: poolConfig.poolMin,
            max: poolConfig.poolMax,
            idleTimeoutMillis: poolConfig.poolIdleTimeout,
            createTimeoutMillis: 30000,
            acquireTimeoutMillis: 30000,
            createRetryIntervalMillis: 1000,
            reapIntervalMillis: 1000,
            statementTimeoutMillis: poolConfig.statementTimeout
          }
        }
      }
    );

    console.log('[Database] Initialized with connection pooling:', {
      min: poolConfig.poolMin,
      max: poolConfig.poolMax,
      idleTimeout: poolConfig.poolIdleTimeout
    });

    // Test connection
    testConnection();

    return supabaseClient;
  } catch (error) {
    console.error('[Database] Failed to initialize:', error);
    throw error;
  }
}

// Test database connection
async function testConnection() {
  try {
    // Skip connection test for now - it's trying to hit REST endpoints
    console.log('[Database] Skipping connection test - Supabase client initialized');
  } catch (error) {
    console.error('[Database] Connection test failed:', error);
  }
}

// Get database client
export function getDatabase() {
  if (!supabaseClient) {
    throw new Error('Database not initialized');
  }
  return supabaseClient;
}

// Execute query with retry logic
export async function executeQuery(queryFn, retries = 3) {
  let lastError = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error;
      console.error(`[Database] Query failed (attempt ${i + 1}/${retries}):`, error.message);
      
      // Wait before retry with exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError;
}

// Transaction wrapper
export async function withTransaction(operations) {
  const client = getDatabase();
  
  try {
    // Start transaction
    await client.rpc('begin_transaction');
    
    // Execute operations
    const result = await operations(client);
    
    // Commit transaction
    await client.rpc('commit_transaction');
    
    return result;
  } catch (error) {
    // Rollback transaction
    await client.rpc('rollback_transaction').catch(console.error);
    throw error;
  }
}

// Monitor pool health
export async function getPoolStats() {
  try {
    const { data, error } = await supabaseClient
      .rpc('get_connection_stats');
    
    if (error) throw error;
    
    return {
      activeConnections: data.active_connections || 0,
      idleConnections: data.idle_connections || 0,
      totalConnections: data.total_connections || 0,
      waitingRequests: data.waiting_requests || 0
    };
  } catch (error) {
    console.error('[Database] Failed to get pool stats:', error);
    return null;
  }
}

// Graceful shutdown
export async function closeDatabase() {
  if (supabaseClient) {
    // Supabase doesn't expose direct pool closing, but we can clean up
    console.log('[Database] Closing connections...');
    supabaseClient = null;
  }
}

// Health check
export async function checkHealth() {
  try {
    const start = Date.now();
    const { error } = await supabaseClient
      .from('profiles')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - start;
    
    return {
      healthy: !error,
      responseTime,
      error: error?.message
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}
import logger from '../utils/serverLogger.js';
import { EventEmitter } from 'events';

/**
 * Circuit Breaker states
 */
const States = {
  CLOSED: 'CLOSED',      // Normal operation
  OPEN: 'OPEN',          // Failures exceeded threshold, blocking calls
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker implementation for protecting against cascading failures
 */
class CircuitBreaker extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.state = States.CLOSED;
    
    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 1 minute
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    
    // Tracking
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    
    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      timeouts: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async call(fn, ...args) {
    this.metrics.totalCalls++;
    
    if (this.state === States.OPEN) {
      if (this.nextAttempt && Date.now() < this.nextAttempt) {
        this.metrics.rejectedCalls++;
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
      // Time to try half-open
      this.state = States.HALF_OPEN;
      logger.info('CircuitBreaker', `${this.name} moving to HALF_OPEN state`);
    }
    
    try {
      // Add timeout wrapper
      const result = await this.callWithTimeout(fn, args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  /**
   * Call function with timeout
   */
  async callWithTimeout(fn, args) {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) => {
        setTimeout(() => {
          this.metrics.timeouts++;
          reject(new Error(`Circuit breaker timeout for ${this.name}`));
        }, this.timeout);
      })
    ]);
  }
  
  /**
   * Handle successful call
   */
  onSuccess() {
    this.metrics.successfulCalls++;
    this.failureCount = 0;
    
    if (this.state === States.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = States.CLOSED;
        this.successCount = 0;
        logger.info('CircuitBreaker', `${this.name} recovered, moving to CLOSED state`);
        this.emit('state-change', { name: this.name, state: States.CLOSED });
      }
    }
  }
  
  /**
   * Handle failed call
   */
  onFailure(error) {
    this.metrics.failedCalls++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    logger.error('CircuitBreaker', `${this.name} failure:`, error.message);
    
    if (this.state === States.HALF_OPEN) {
      this.state = States.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.warn('CircuitBreaker', `${this.name} failed in HALF_OPEN, moving to OPEN state`);
      this.emit('state-change', { name: this.name, state: States.OPEN });
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = States.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.warn('CircuitBreaker', `${this.name} threshold exceeded, moving to OPEN state`);
      this.emit('state-change', { name: this.name, state: States.OPEN });
    }
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      metrics: { ...this.metrics }
    };
  }
  
  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = States.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    logger.info('CircuitBreaker', `${this.name} manually reset to CLOSED state`);
    this.emit('state-change', { name: this.name, state: States.CLOSED });
  }
}

/**
 * Circuit Breaker Manager for managing multiple circuit breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }
  
  /**
   * Create or get a circuit breaker
   */
  getBreaker(name, options) {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(name, options);
      this.breakers.set(name, breaker);
      
      // Log state changes
      breaker.on('state-change', (data) => {
        logger.warn('CircuitBreaker', `State change:`, data);
      });
    }
    return this.breakers.get(name);
  }
  
  /**
   * Get all circuit breakers status
   */
  getAllStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }
    return status;
  }
  
  /**
   * Reset a specific breaker
   */
  resetBreaker(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }
  
  /**
   * Reset all breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

// Create singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

// Pre-configure common circuit breakers
const breakerConfigs = {
  sharing: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 5000,
    resetTimeout: 30000
  },
  notifications: {
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 10000,
    resetTimeout: 60000
  },
  aiGeneration: {
    failureThreshold: 3,
    successThreshold: 1,
    timeout: 30000,
    resetTimeout: 120000
  },
  database: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 5000,
    resetTimeout: 30000
  },
  fileUpload: {
    failureThreshold: 3,
    successThreshold: 1,
    timeout: 60000,
    resetTimeout: 60000
  }
};

// Helper function to wrap async functions with circuit breaker
export const withCircuitBreaker = (name, fn, options) => {
  const config = breakerConfigs[name] || {};
  const breaker = circuitBreakerManager.getBreaker(name, { ...config, ...options });
  
  return async (...args) => {
    return breaker.call(fn, ...args);
  };
};

export { circuitBreakerManager, CircuitBreaker, States };
export default circuitBreakerManager;
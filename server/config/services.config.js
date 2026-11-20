import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeDatabase, getDatabase } from './database.config.js';
import https from 'https';
import fetch from 'node-fetch';

let openai;
let genAI;

// Create a custom HTTPS agent with keep-alive and connection pooling
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 3000,
  maxSockets: 50, // Increase concurrent connections
  maxFreeSockets: 10,
  timeout: 60000,
  scheduling: 'lifo' // Last-in-first-out scheduling
});

export function initializeServices() {
  // Initialize OpenAI with optimized settings
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000, // 30 second timeout
    maxRetries: 1, // Reduce retries for faster failures
    httpAgent: httpsAgent,
    dangerouslyAllowBrowser: false,
    defaultHeaders: {
      'Connection': 'keep-alive',
      'Accept-Encoding': 'gzip, deflate, br' // Enable compression
    },
    // Use custom fetch with connection reuse
    fetch: fetch
  });

  // Pre-warm the connection by making a minimal request
  if (process.env.OPENAI_API_KEY) {
    console.log('[OpenAI] Pre-warming connection...');
    openai.models.list({ limit: 1 }).catch(err => {
      console.log('[OpenAI] Pre-warm failed (non-critical):', err.message);
    });
  }

  // Initialize Database with connection pooling
  initializeDatabase();

  // Initialize Google Generative AI
  genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
}

export function getOpenAI() {
  return openai;
}

export function getSupabase() {
  return getDatabase();
}

export function getGenAI() {
  return genAI;
}
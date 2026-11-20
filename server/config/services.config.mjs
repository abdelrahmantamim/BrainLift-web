import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

let openai;
let genAI;
let supabase;

export function initializeServices() {
  // Initialize OpenAI with timeout
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000, // 30 second timeout
    maxRetries: 2,
  });

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  // Initialize Google Generative AI
  genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
}

export function getOpenAI() {
  if (!openai) {
    initializeServices();
  }
  return openai;
}

export function getSupabase() {
  if (!supabase) {
    initializeServices();
  }
  return supabase;
}

export function getGenAI() {
  if (!genAI && process.env.GOOGLE_API_KEY) {
    initializeServices();
  }
  return genAI;
}

// Initialize on import
initializeServices();
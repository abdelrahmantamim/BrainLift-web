import { getSupabase } from '../config/services.config.js';

// Model configuration cache
let modelConfig = {
  chat: null,
  files: null,
  testing: null, // Renamed from quiz - covers both quiz and flashcards
  lastRefresh: new Date()
};

// Load model configuration from database
async function loadModelConfig() {
  try {
    console.log('Loading model configuration from database...');
    const supabase = getSupabase();
    
    // Fetch active model assignments with joined model data
    const { data: assignments, error } = await supabase
      .from('model_assignments')
      .select(`
        feature,
        model_id,
        model:ai_models(
          id,
          provider,
          model_name,
          display_name,
          is_active,
          capabilities,
          cost_per_1k_tokens,
          api_endpoint,
          api_key_env_var,
          max_tokens,
          temperature
        )
      `)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error loading model config:', error);
      // Fall back to defaults if database query fails
      useDefaultModels();
      return;
    }
    
    // Update model config
    const newConfig = {
      chat: null,
      files: null,  
      testing: null, // Renamed from quiz - covers both quiz and flashcards
      lastRefresh: new Date()
    };
    
    if (assignments && assignments.length > 0) {
      assignments.forEach(assignment => {
        if (assignment.model) {
          // Add model_id for compatibility (using model_name as model_id)
          assignment.model.model_id = assignment.model.model_name;
          newConfig[assignment.feature] = assignment.model;
        }
      });
      
      console.log('Model assignments found:', assignments.length);
    } else {
      console.log('No model assignments found, using defaults');
      useDefaultModels();
      return;
    }
    
    modelConfig = newConfig;
    console.log('Model configuration loaded:', {
      chat: modelConfig.chat?.display_name,
      files: modelConfig.files?.display_name,
      testing: modelConfig.testing?.display_name
    });
  } catch (error) {
    console.error('Failed to load model config:', error);
    useDefaultModels();
  }
}

// Helper function to set default models
function useDefaultModels() {
  const defaultModel = {
    provider: 'openai',
    model_id: 'gpt-4.1-nano',  // For compatibility
    model_name: 'gpt-4.1-nano',
    display_name: 'GPT-4.1 Nano',
    is_active: true,
    capabilities: {
      vision: true,
      functions: true
    },
    max_tokens: 4096,
    temperature: 0.7
  };
  
  modelConfig = {
    chat: defaultModel,
    files: defaultModel,
    testing: defaultModel, // Renamed from quiz - covers both quiz and flashcards
    lastRefresh: new Date()
  };
  
  console.log('Using default model configuration');
}

function getModelConfig() {
  // Add compatibility layer - both quiz and flashcards use testing model
  const config = { ...modelConfig };
  
  // Map quiz to testing for backward compatibility
  if (!config.quiz && config.testing) {
    config.quiz = config.testing;
  }
  
  // Map flashcards to testing
  if (!config.flashcards && config.testing) {
    config.flashcards = config.testing;
  }
  
  return config;
}

export {
  loadModelConfig,
  getModelConfig
};
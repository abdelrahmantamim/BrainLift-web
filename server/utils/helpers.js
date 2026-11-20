// Helper function to determine which token parameter to use
function getTokenParameter(modelName, context = {}) {
  // Models that use max_completion_tokens (newer models)
  // Also check for model name patterns
  const useMaxCompletionTokens =
    modelName.includes('gpt-5') ||
    modelName.includes('o1') ||
    modelName.includes('o3') ||
    modelName.includes('o4') ||
    [
      'o1-preview',
      'o1-mini',
      'gpt-4.1-nano-2025-04-14',
      'gpt-4.1-mini-2025-04-14',
      'o3-2025-04-16',
      'o4-mini-2025-04-16'
    ].includes(modelName);
  
  // Determine token limit based on context
  let tokenLimit = 2000; // Default
  
  if (context.type === 'title') {
    tokenLimit = 200; // Allow more detailed titles
  } else if (context.isSimpleQuery) {
    tokenLimit = 500; // Much smaller for simple queries like math
  } else if (context.type === 'quiz') {
    tokenLimit = 4000; // More tokens for comprehensive quiz generation
  } else if (context.hasImages) {
    tokenLimit = 3000; // More tokens for image analysis
  } else if (context.hasFiles || context.hasCode) {
    tokenLimit = 4000; // More tokens for code/file analysis
  } else if (context.complexity === 'simple') {
    tokenLimit = 1000; // Simple queries need less
  }
  
  if (useMaxCompletionTokens) {
    const params = { max_completion_tokens: tokenLimit };
    // GPT-5 models are reasoning models - need reasoning_effort
    if (modelName.includes('gpt-5')) {
      params.reasoning_effort = 'low';
    }
    return params;
  }

  // Default to max_tokens for standard models
  return { max_tokens: tokenLimit };
}

// Helper function to get appropriate temperature for model
function getTemperature(modelName) {
  // GPT-5 models (ALL variants including nano/mini) and o-series don't support custom temperature
  // They only accept default (1) - don't even pass temperature parameter
  if (modelName.includes('gpt-5') || modelName.includes('o1') || modelName.includes('o3') || modelName.includes('o4')) {
    return null; // Return null to indicate "don't set temperature"
  }

  // Default temperature for legacy models (GPT-4, GPT-4.1, etc.)
  return 0.7;
}

// Helper function to map database student types to frontend values
const mapStudentTypeToFrontend = (dbType) => {
  const reverseMap = {
    'high_school': 'high_school',     // Direct match
    'university': 'college',          // Map to college
    'graduate': 'college',            // Map to college
    'professional': 'adult',          // Map to adult
    'other': 'adult'                  // Map to adult
  };
  return reverseMap[dbType] || dbType;
};

export {
  getTokenParameter,
  getTemperature,
  mapStudentTypeToFrontend
};
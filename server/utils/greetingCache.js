// Cache for common greetings to improve response time
const greetingPatterns = {
  'hi': [
    "What would you like to learn about?",
    "What topic can I help you with?",
    "What are you studying today?"
  ],
  'hello': [
    "What would you like to learn about?",
    "What can I help you with?",
    "What topic shall we explore?"
  ],
  'hey': [
    "What can I help you with?",
    "What would you like to know?",
    "What are we learning today?"
  ],
  'good morning': [
    "What shall we work on today?",
    "What would you like to learn?",
    "What topic can I help with?"
  ],
  'good afternoon': [
    "What would you like to learn about?",
    "What can I help you with?",
    "What are you working on?"
  ],
  'good evening': [
    "What can I help you with?",
    "What would you like to study?",
    "What topic shall we cover?"
  ]
};

// Simple math evaluation for basic calculations
function isSimpleMath(message) {
  // Match patterns like "5+5", "10 - 3", "4 * 2", "8 / 2", "what is 5+5"
  const mathPattern = /^(what\s+is\s+)?(\d+)\s*([+\-*/])\s*(\d+)\s*\??$/i;
  return mathPattern.test(message.trim());
}

function evaluateSimpleMath(message) {
  const mathPattern = /^(what\s+is\s+)?(\d+)\s*([+\-*/])\s*(\d+)\s*\??$/i;
  const match = message.trim().match(mathPattern);
  
  if (!match) return null;
  
  const num1 = parseFloat(match[2]);
  const operator = match[3];
  const num2 = parseFloat(match[4]);
  
  let result;
  switch (operator) {
    case '+':
      result = num1 + num2;
      break;
    case '-':
      result = num1 - num2;
      break;
    case '*':
      result = num1 * num2;
      break;
    case '/':
      result = num2 !== 0 ? num1 / num2 : null;
      break;
    default:
      return null;
  }
  
  if (result === null) {
    return "I can't divide by zero!";
  }
  
  // Format the response
  const operation = `${num1} ${operator} ${num2}`;
  return `${operation} = ${result}`;
}

function isSimpleGreeting(message) {
  const normalized = message.toLowerCase().trim();
  return greetingPatterns.hasOwnProperty(normalized);
}

function getCachedGreeting(message) {
  const normalized = message.toLowerCase().trim();
  const responses = greetingPatterns[normalized];
  if (responses) {
    // Return a random response from the list
    return responses[Math.floor(Math.random() * responses.length)];
  }
  return null;
}

export {
  isSimpleGreeting,
  getCachedGreeting,
  isSimpleMath,
  evaluateSimpleMath
};
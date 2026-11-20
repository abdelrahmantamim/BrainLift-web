// Structured response handler for getting both chat response and title in one API call

function getStructuredResponseParams(isNewConversation) {
  if (!isNewConversation) {
    return {}; // No functions needed for existing conversations
  }
  
  return {
    functions: [
      {
        name: "send_response",
        description: "Send a response to the user with an optional conversation title",
        parameters: {
          type: "object",
          properties: {
            response: {
              type: "string",
              description: "The main response to the user's message"
            },
            title: {
              type: "string",
              description: "A concise title for this conversation (max 40 characters). Only provide if this is the first message.",
              maxLength: 40
            }
          },
          required: ["response"]
        }
      }
    ],
    function_call: { name: "send_response" }
  };
}

function parseStructuredResponse(completion, isNewConversation) {
  try {
    if (!isNewConversation) {
      // Regular response
      return {
        content: completion.choices[0].message.content,
        title: null
      };
    }
    
    // Parse function call response
    const functionCall = completion.choices[0].message.function_call;
    if (functionCall && functionCall.name === "send_response") {
      const args = JSON.parse(functionCall.arguments);
      return {
        content: args.response,
        title: args.title || null
      };
    }
    
    // Fallback to regular content
    return {
      content: completion.choices[0].message.content,
      title: null
    };
  } catch (error) {
    console.error('[StructuredResponse] Parse error:', error);
    // Fallback to regular content
    return {
      content: completion.choices[0].message?.content || '',
      title: null
    };
  }
}

module.exports = {
  getStructuredResponseParams,
  parseStructuredResponse
};
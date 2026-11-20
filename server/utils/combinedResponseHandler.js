// Handler for combined responses (chat + title in one request)

function createCombinedSystemPrompt(baseSystemMessage, isNewConversation, userLanguage) {
  let prompt = baseSystemMessage;
  
  if (isNewConversation) {
    prompt += `\n\n**IMPORTANT**: Since this is the first message in a new conversation, please also generate a concise title (max 40 characters) for this conversation. 
    
Format your response as:
[TITLE: Your generated title here]
[RESPONSE]
Your actual response to the user here...`;
  }
  
  return prompt;
}

function parseCombinedResponse(response, isNewConversation) {
  if (!isNewConversation || !response) {
    return {
      content: response,
      title: null
    };
  }
  
  // Look for [TITLE: ...] pattern
  const titleMatch = response.match(/\[TITLE:\s*(.+?)\]/);
  
  if (titleMatch) {
    const title = titleMatch[1].trim();
    
    // Try to extract content after [RESPONSE] marker
    let content = response.replace(/\[TITLE:\s*.+?\]\s*\[RESPONSE\]\s*/s, '').trim();
    
    // If content is empty after removing title/response markers, 
    // try removing just the title and keep everything else
    if (!content) {
      content = response.replace(/\[TITLE:\s*.+?\]\s*/s, '').trim();
    }
    
    // If still no content, return the original response
    if (!content) {
      console.warn('[Chat] Warning: Could not extract content after title parsing, using original response');
      return {
        content: response,
        title: null
      };
    }
    
    return {
      content,
      title
    };
  }
  
  // Fallback if pattern not found
  return {
    content: response,
    title: null
  };
}

export {
  createCombinedSystemPrompt,
  parseCombinedResponse
};
class ChatResponseEnhancer {
  constructor() {
    this.pdfTriggers = [
      'create.*pdf',
      'generate.*pdf',
      'make.*pdf',
      'pdf.*report',
      'pdf.*summary',
      'pdf.*document',
      'download.*pdf',
      'save.*as.*pdf',
      'export.*pdf'
    ];

    this.chartTypes = ['pie', 'bar', 'line', 'flow', 'mindmap', 'tree'];
  }

  /**
   * Check if the user's message requests PDF generation
   */
  shouldGeneratePDF(userMessage) {
    const messageLower = userMessage.toLowerCase();
    return this.pdfTriggers.some(trigger => 
      new RegExp(trigger).test(messageLower)
    );
  }

  /**
   * Check if AI response contains chart data
   */
  containsChartData(aiResponse) {
    try {
      // Look for JSON code blocks
      const jsonMatches = aiResponse.match(/```json([\s\S]*?)```/g);
      if (!jsonMatches) return false;

      for (const match of jsonMatches) {
        const jsonContent = match.slice(7, -3).trim();
        try {
          const data = JSON.parse(jsonContent);
          if (data.type && this.chartTypes.includes(data.type)) {
            return true;
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Enhance AI response with PDF generation options
   */
  enhanceResponse(aiResponse, userMessage, conversationId) {
    const response = {
      message: aiResponse,
      actions: []
    };

    // Check if AI indicated PDF should be generated
    const pdfReadyMatch = aiResponse.match(/\[PDF_READY:\s*([^\]]+)\]/i);
    const aiSaidWillPreparePDF = /I'll prepare.*PDF|I will prepare.*PDF|preparing.*PDF.*for you/i.test(aiResponse);
    const aiIndicatedPDF = !!pdfReadyMatch || aiSaidWillPreparePDF;
    
    // Check if user explicitly asked for PDF
    const userWantsPDF = this.shouldGeneratePDF(userMessage);
    
    // Check if response has substantial structured content suitable for PDF
    const hasSubstantialContent = this.hasStructuredContent(aiResponse) && aiResponse.length > 500;
    
    // Check if response contains educational content (quiz, study guide, flashcards, etc.)
    const hasEducationalContent = this.containsQuizData(aiResponse) || 
                                 this.containsStudyContent(aiResponse);

    // Show PDF button ONLY if: AI indicated, or user explicitly asked for PDF
    // Don't show for every chart/diagram unless specifically requested
    if (aiIndicatedPDF || userWantsPDF) {
      // Add PDF generation action
      const contentType = this.detectContentType(aiResponse);
      const topic = this.extractTopic(aiResponse, userMessage);
      
      const pdfAction = {
        type: 'generate_pdf',
        label: 'Download as PDF',
        icon: 'document-download',
        data: {
          conversationId,
          messageId: Date.now().toString(),
          contentType: contentType,
          hasCharts: this.containsChartData(aiResponse),
          topic: pdfReadyMatch ? pdfReadyMatch[1].trim() : topic
        }
      };
      
      // If AI specifically indicated PDF generation, make it primary
      if (aiIndicatedPDF) {
        pdfAction.label = 'Download PDF';
        pdfAction.primary = true;
      }
      
      response.actions.push(pdfAction);
      
      // Clean up the PDF_READY tag from the message if present
      if (aiIndicatedPDF) {
        response.message = aiResponse.replace(/\[PDF_READY:\s*[^\]]+\]/gi, '').trim();
      }
    }

    // Removed non-functional buttons (Save Quiz, Create Flashcards)
    // These features are handled through dedicated screens

    return response;
  }

  /**
   * Detect the type of content for PDF generation
   */
  detectContentType(aiResponse) {
    const lowerResponse = aiResponse.toLowerCase();
    
    if (lowerResponse.includes('quiz') || lowerResponse.includes('test')) {
      return 'quiz';
    } else if (lowerResponse.includes('study guide') || lowerResponse.includes('summary')) {
      return 'study-guide';
    } else if (this.containsChartData(aiResponse)) {
      return 'chart-report';
    } else {
      return 'summary';
    }
  }

  /**
   * Check if response has structured content suitable for PDF
   */
  hasStructuredContent(aiResponse) {
    // Check for markdown headers, lists, tables, etc.
    const patterns = [
      /^#{1,3}\s/m,           // Markdown headers
      /^\d+\.\s/m,            // Numbered lists
      /^[\*\-]\s/m,           // Bullet lists
      /\|.*\|.*\|/,           // Tables
      /```[\s\S]*?```/        // Code blocks
    ];

    return patterns.some(pattern => pattern.test(aiResponse));
  }

  /**
   * Check if response contains quiz data
   */
  containsQuizData(aiResponse) {
    const quizKeywords = ['question', 'answer', 'correct answer', 'options', 'quiz'];
    const lowerResponse = aiResponse.toLowerCase();
    
    return quizKeywords.filter(keyword => 
      lowerResponse.includes(keyword)
    ).length >= 2;
  }

  /**
   * Check if response contains study content
   */
  containsStudyContent(aiResponse) {
    const studyKeywords = ['concept', 'definition', 'example', 'remember', 'important', 'key point'];
    const lowerResponse = aiResponse.toLowerCase();
    
    return studyKeywords.filter(keyword => 
      lowerResponse.includes(keyword)
    ).length >= 2;
  }

  /**
   * Extract topic from AI response
   */
  extractTopic(aiResponse, userMessage) {
    // Try to extract from headers
    const headerMatch = aiResponse.match(/^#{1,3}\s+(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim();
    }
    
    // Try to extract from first line
    const firstLine = aiResponse.split('\n')[0];
    if (firstLine && firstLine.length < 100 && !firstLine.includes('```')) {
      return firstLine.trim();
    }
    
    // Extract topic from user message
    const topicKeywords = ['about', 'explain', 'what is', 'how to', 'guide to', 'summary of'];
    const lowerMessage = userMessage.toLowerCase();
    
    for (const keyword of topicKeywords) {
      const index = lowerMessage.indexOf(keyword);
      if (index !== -1) {
        const afterKeyword = userMessage.substring(index + keyword.length).trim();
        const endIndex = afterKeyword.search(/[.?!,]/) !== -1 ? afterKeyword.search(/[.?!,]/) : afterKeyword.length;
        const topic = afterKeyword.substring(0, endIndex).trim();
        if (topic && topic.length < 50) {
          return topic;
        }
      }
    }
    
    // Default topic based on content type
    return 'Educational Content';
  }

  /**
   * Generate PDF action URL
   */
  generatePDFActionURL(action, baseURL = '') {
    const { conversationId, messageId, contentType } = action.data;
    
    // Create a temporary token for this specific PDF generation
    const params = new URLSearchParams({
      conversation: conversationId,
      message: messageId,
      type: contentType,
      timestamp: Date.now()
    });

    return `${baseURL}/api/pdf/generate-from-message?${params}`;
  }
}

module.exports = new ChatResponseEnhancer();
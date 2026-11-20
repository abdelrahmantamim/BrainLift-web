import axios from '@/services/api';

export interface PDFExportOptions {
  content: string;
  type: 'message' | 'quiz' | 'flashcards' | 'chart' | 'selection' | 'conversation';
  title?: string;
  metadata?: Record<string, unknown>;
}

class PDFService {
  /**
   * Generate PDF from content
   */
  async generatePDF(options: PDFExportOptions): Promise<Blob> {
    const { data } = await axios.post(
      '/pdf/generate-from-chat',
      { content: options.content, type: options.type },
      {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return data;
  }

  /**
   * Generate PDF from a specific message
   */
  async generateFromMessage(messageId: string, conversationId: string, selectedContent?: string): Promise<Blob> {
    const { data } = await axios.post(
      '/pdf/generate-from-message',
      {
        messageId,
        conversationId,
        messageContent: selectedContent,
      },
      {
        responseType: 'blob',
      }
    );
    return data;
  }

  /**
   * Export quiz as PDF
   */
  async exportQuiz(quizId: string, includeAnswers: boolean = true): Promise<Blob> {
    const { data } = await axios.post(
      '/pdf/generate-from-chat',
      { content: { quizId, includeAnswers }, type: 'quiz' },
      {
        responseType: 'blob',
      }
    );
    return data;
  }

  /**
   * Export flashcard deck as PDF
   */
  async exportFlashcards(deckId: string): Promise<Blob> {
    const { data } = await axios.post(
      '/pdf/generate-from-chat',
      { content: { deckId }, type: 'flashcards' },
      {
        responseType: 'blob',
      }
    );
    return data;
  }

  /**
   * Download the PDF blob
   */
  downloadPDF(blob: Blob, filename: string = 'export.pdf'): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Preview PDF in new tab
   */
  previewPDF(blob: Blob): void {
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up after a delay
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  }
}

export const pdfService = new PDFService();

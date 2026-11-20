import axios from '@/services/api';

export interface ShareResponse {
  shareId: string;
  shareUrl: string;
  previewUrl?: string;
  expiresAt?: string;
  qrCodeUrl?: string;
  deepLink?: string;
}

// Raw shape of POST /share/create's response. `shareUrl`/`previewUrl`/
// `deepLink`/`qrCodeUrl` are server-canonical fields (WP3) that may be
// absent when talking to an older server — callers must fall back to the
// per-type URL construction below in that case.
interface ShareCreateApiResponse {
  shareId: string;
  shareUrl?: string;
  previewUrl?: string;
  deepLink?: string;
  qrCodeUrl?: string;
}

export interface ShareOptions {
  expiresIn?: number;    // hours until the link expires
  requiresAuth?: boolean; // recipient must be signed in to import
  maxImports?: number;    // cap on number of imports
}

// Matches the ALLOWED_EVENT_TYPES allowlist in server/routes/share.routes.js
// POST /share/track.
export type ShareTrackEventType = 'view' | 'click' | 'import' | 'share' | 'copy_link' | 'preview';

class SharingService {
  private readonly baseShareUrl = 'https://getbrainlift.app/share';
  private readonly basePreviewUrl = 'https://getbrainlift.app/share/preview';

  /**
   * Share a quiz
   */
  async shareQuiz(quizId: string, options?: ShareOptions): Promise<ShareResponse> {
    const { data } = await axios.post<ShareCreateApiResponse>('/share/create', {
      contentType: 'quiz',
      contentId: quizId,
      settings: options ?? {},
    });

    return {
      ...data,
      shareUrl: data.shareUrl ?? `${this.baseShareUrl}/quiz/${data.shareId}`,
      previewUrl: data.previewUrl ?? `${this.basePreviewUrl}/quiz/${data.shareId}`,
      qrCodeUrl: data.qrCodeUrl,
    };
  }

  /**
   * Share a flashcard deck
   */
  async shareFlashcards(deckId: string, options?: ShareOptions): Promise<ShareResponse> {
    const { data } = await axios.post<ShareCreateApiResponse>('/share/create', {
      contentType: 'flashcards',
      contentId: deckId,
      settings: options ?? {},
    });

    return {
      ...data,
      shareUrl: data.shareUrl ?? `${this.baseShareUrl}/flashcards/${data.shareId}`,
      previewUrl: data.previewUrl ?? `${this.basePreviewUrl}/flashcards/${data.shareId}`,
      qrCodeUrl: data.qrCodeUrl,
    };
  }

  /**
   * Share a chat message or conversation
   */
  async shareMessage(messageId: string, options?: ShareOptions): Promise<ShareResponse> {
    const { data } = await axios.post<ShareCreateApiResponse>('/share/create', {
      contentType: 'message',
      contentId: messageId,
      settings: options ?? {},
    });

    return {
      ...data,
      shareUrl: data.shareUrl ?? `${this.baseShareUrl}/message/${data.shareId}`,
      previewUrl: data.previewUrl,
      qrCodeUrl: data.qrCodeUrl,
    };
  }

  /**
   * Share selected content
   */
  async shareContent(content: string, title: string, options?: ShareOptions): Promise<ShareResponse> {
    const { data } = await axios.post<ShareCreateApiResponse>('/share/create', {
      contentType: 'content',
      contentId: `temp_${Date.now()}`,
      title,
      description: content,
      settings: options ?? {},
    });

    return {
      ...data,
      shareUrl: data.shareUrl ?? `${this.baseShareUrl}/content/${data.shareId}`,
      previewUrl: data.previewUrl,
      qrCodeUrl: data.qrCodeUrl,
    };
  }

  /**
   * Get shared content by ID
   */
  async getSharedContent<T = unknown>(shareId: string, password?: string): Promise<T> {
    const { data } = await axios.get<T>(`/share/${shareId}`, {
      params: password ? { password } : undefined,
    });

    return data;
  }

  /**
   * Delete a share
   */
  async deleteShare(shareId: string): Promise<void> {
    await axios.delete(`/share/${shareId}`);
  }

  /**
   * Copy share URL to clipboard
   */
  async copyShareUrl(shareUrl: string): Promise<void> {
    await navigator.clipboard.writeText(shareUrl);
  }

  /**
   * Track a share event (fire-and-forget — failures shouldn't break the UI).
   */
  async trackEvent(
    shareId: string,
    eventType: ShareTrackEventType,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await axios.post('/share/track', {
        shareId,
        eventType,
        metadata,
        platform: 'web',
      });
    } catch (error) {
      console.error('[SharingService] Failed to track share event:', error);
      // Don't throw — tracking failures shouldn't break the app
    }
  }

  /**
   * Generate a shareable link with tracking
   */
  generateTrackableUrl(shareUrl: string, source?: string): string {
    const url = new URL(shareUrl);
    if (source) {
      url.searchParams.append('utm_source', source);
    }
    url.searchParams.append('utm_medium', 'share');
    return url.toString();
  }
}

export const sharingService = new SharingService();

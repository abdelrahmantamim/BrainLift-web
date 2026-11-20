import axios from '@/services/api';

export interface SharePreviewData {
  id: string;
  type: 'quiz' | 'flashcards';
  title: string;
  sharedBy: {
    username: string;
    avatarUrl?: string;
  };
  itemCount: number;
  difficulty?: string;
  timeLimit?: number;
  category?: string;
  description?: string;
  createdAt: string;
}

class ShareService {
  /**
   * Get share preview data for countdown page
   */
  async getSharePreview(type: 'quiz' | 'flashcards', shareId: string): Promise<SharePreviewData> {
    const { data } = await axios.get<SharePreviewData>(`/share/preview/${type}/${shareId}`);
    return data;
  }
}

export const shareService = new ShareService();
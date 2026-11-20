import { create } from 'zustand';
import type { UploadedFile } from '@/types/file.types';

interface ChatContextState {
  contextFiles: UploadedFile[];
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
}

export const useChatContextStore = create<ChatContextState>((set) => ({
  contextFiles: [],
  
  addFiles: (files) => set((state) => ({
    contextFiles: [...state.contextFiles, ...files.filter(f => 
      !state.contextFiles.some(cf => cf.id === f.id)
    )]
  })),
  
  removeFile: (fileId) => set((state) => ({
    contextFiles: state.contextFiles.filter(f => f.id !== fileId)
  })),
  
  clearFiles: () => set({ contextFiles: [] }),
}));
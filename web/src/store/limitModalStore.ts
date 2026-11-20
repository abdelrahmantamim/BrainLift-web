import { create } from 'zustand';

export interface LimitModalParams {
  limitType: string;
  used: number;
  total: number;
  period?: string;
  placement: string;
}

interface LimitModalState {
  isOpen: boolean;
  params: LimitModalParams | null;

  open: (params: LimitModalParams) => void;
  close: () => void;
}

export const useLimitModalStore = create<LimitModalState>()((set) => ({
  isOpen: false,
  params: null,

  open: (params) => set({ isOpen: true, params }),
  close: () => set({ isOpen: false, params: null }),
}));

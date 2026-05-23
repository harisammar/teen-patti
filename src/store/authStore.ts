import { create } from 'zustand';
import { UserProfile } from '../types';

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile) => void;
  clearUser: () => void;
  updateUserStats: (updates: Partial<UserProfile>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null }),

  updateUserStats: (updates) =>
    set((state) => {
      if (!state.user) return state;
      return { user: { ...state.user, ...updates } };
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));

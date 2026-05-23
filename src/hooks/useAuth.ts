import { useState } from 'react';
import { ConfirmationResult } from 'firebase/auth';
import { useAuthStore } from '../store/authStore';
import * as authService from '../services/authService';
import { UserProfile } from '../types';

interface UseAuthReturn {
  user: UserProfile | null;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string, avatar: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  // Phone auth
  sendPhoneOtp: (phoneNumber: string, recaptchaVerifier: any) => Promise<ConfirmationResult>;
  confirmPhoneOtp: (result: ConfirmationResult, otp: string) => Promise<{ isNewUser: boolean }>;
  // Profile setup (for new phone users)
  completeProfileSetup: (name: string, avatar: string, photoLocalUri?: string) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const { user, isLoading, setUser, clearUser, updateUserStats } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  function clearError(): void {
    setError(null);
  }

  async function signUp(email: string, password: string, name: string, avatar: string): Promise<void> {
    try {
      setError(null);
      const profile = await authService.signUp(email, password, name, avatar);
      setUser(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign up failed.';
      setError(message);
      throw err;
    }
  }

  async function signIn(email: string, password: string): Promise<void> {
    try {
      setError(null);
      const profile = await authService.signIn(email, password);
      setUser(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed.';
      setError(message);
      throw err;
    }
  }

  async function signOut(): Promise<void> {
    try {
      setError(null);
      await authService.signOut();
      clearUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign out failed.';
      setError(message);
      throw err;
    }
  }

  async function updateProfile(data: Partial<UserProfile>): Promise<void> {
    if (!user) throw new Error('Not authenticated.');
    try {
      setError(null);
      await authService.updateProfile(user.uid, data);
      updateUserStats(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile update failed.';
      setError(message);
      throw err;
    }
  }

  async function sendPhoneOtp(
    phoneNumber: string,
    recaptchaVerifier: any,
  ): Promise<ConfirmationResult> {
    try {
      setError(null);
      return await authService.sendPhoneOtp(phoneNumber, recaptchaVerifier);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP.';
      setError(message);
      throw err;
    }
  }

  async function confirmPhoneOtp(
    result: ConfirmationResult,
    otp: string,
  ): Promise<{ isNewUser: boolean }> {
    try {
      setError(null);
      const { profile, isNewUser } = await authService.confirmPhoneOtp(result, otp);
      setUser(profile);
      return { isNewUser };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OTP verification failed.';
      setError(message);
      throw err;
    }
  }

  async function completeProfileSetup(
    name: string,
    avatar: string,
    photoLocalUri?: string,
  ): Promise<void> {
    if (!user) throw new Error('Not authenticated.');
    try {
      setError(null);
      const updated = await authService.completeProfileSetup(user.uid, name, avatar, photoLocalUri);
      setUser(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile setup failed.';
      setError(message);
      throw err;
    }
  }

  return {
    user,
    isLoading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    sendPhoneOtp,
    confirmPhoneOtp,
    completeProfileSetup,
    error,
    clearError,
  };
}

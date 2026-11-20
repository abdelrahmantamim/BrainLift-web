import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, Loader } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import api from '@/services/api';

export const AppleCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleAppleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAppleCallback = async () => {
    try {
      // Get parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        throw new Error(`Apple Sign-In failed: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received from Apple');
      }

      // Exchange code for session
      const response = await api.post('/auth/apple/callback', {
        code,
        state
      }, {
        withCredentials: true
      });

      if (response.data.user) {
        // Update auth store
        useAuthStore.setState({
          user: response.data.user,
          isAuthenticated: true
        });

        toast.success('Successfully signed in with Apple!');
        navigate('/dashboard');
      } else {
        throw new Error('No user data received');
      }
    } catch (err: unknown) {
      console.error('Apple callback error:', err);
      const errorData = err as { message?: string };
      setError(errorData.message || 'Failed to complete Apple Sign-In');

      // Redirect to login after delay
      setTimeout(() => {
        navigate('/auth/login');
      }, 3000);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-pg-cream flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="pg-card shadow-clay-coral p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-pg-coral/20 rounded-full mb-4">
              <Brain className="w-10 h-10 text-pg-coral" />
            </div>
            <h2 className="text-2xl font-heading font-bold text-pg-navy mb-2">Sign-In Failed</h2>
            <p className="text-pg-text-secondary font-body mb-6">{error}</p>
            <p className="text-sm text-pg-text-secondary font-body">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="pg-card shadow-clay-teal p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-pg-indigo/20 rounded-full mb-4">
            <Loader className="w-10 h-10 text-pg-indigo animate-spin" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-pg-navy mb-2">Completing Sign-In</h2>
          <p className="text-pg-text-secondary font-body">Please wait while we complete your Apple Sign-In...</p>
        </div>
      </div>
    </div>
  );
};

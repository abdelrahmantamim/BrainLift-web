import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Lock, ArrowRight } from 'lucide-react';
import { BrainLifting } from '@/components/common/BrainLifting';
import { useAuthStore } from '@/store/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { AuthLayout } from '@/components/auth/AuthLayout';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [isLoading, setIsLoading] = useState(false);
  const { isWebLoginEnabled, isLoading: isCheckingFlags } = useFeatureFlags();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data);
      navigate('/dashboard');
    } catch {
      // Error is handled by the store with toast
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingFlags) {
    return (
      <AuthLayout>
        <BrainLifting message="Checking system status..." size="sm" />
      </AuthLayout>
    );
  }

  if (!isWebLoginEnabled) {
    return (
      <AuthLayout>
        <div className="glass-auth p-8 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-pg-navy border-3 border-pg-navy flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-heading text-2xl text-pg-navy mb-2">Login Unavailable</h1>
            <p className="text-pg-text-secondary text-sm">
              Web login is currently disabled. Please try again later or use the mobile app.
            </p>
          </div>
          <Link to="/" className="pg-btn pg-btn-coral w-full justify-center">
            Back to Home
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="glass-auth p-8">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl text-pg-navy mb-2">Welcome Back!</h1>
          <p className="text-pg-text-secondary">Sign in to continue your learning adventure</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-pg-text mb-1.5">
              Email
            </label>
            <input
              {...register('email')}
              type="email"
              id="email"
              className="w-full input-auth"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-pg-coral font-medium">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-pg-text mb-1.5">
              Password
            </label>
            <input
              {...register('password')}
              type="password"
              id="password"
              className="w-full input-auth"
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-pg-coral font-medium">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-2 border-pg-navy accent-[var(--pg-coral)]"
              />
              <span className="ml-2 text-sm text-pg-text-secondary font-medium">Remember me</span>
            </label>
            <Link to="/auth/forgot-password" className="text-sm link-auth">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-gradient py-3.5 text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-pg-text-secondary">
            Don't have an account?{' '}
            <Link to="/auth/register" className="link-auth">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

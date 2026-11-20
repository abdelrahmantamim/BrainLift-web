import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ChevronLeft, CheckCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services/auth.service';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthLayout } from '@/components/auth/AuthLayout';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await authService.forgotPassword(data.email);
      setIsSuccess(true);
    } catch (error: unknown) {
      const errorData = error as { response?: { data?: { message?: string } } };
      toast.error(errorData.response?.data?.message || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout>
        <div className="glass-auth p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-green-500 border-3 border-pg-navy flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="font-heading text-3xl text-pg-navy mb-2">Check Your Email</h1>
            <p className="text-pg-text-secondary text-center">
              We've sent a password reset link to<br />
              <span className="text-pg-navy font-semibold">{getValues('email')}</span>
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-pg-text-secondary text-center text-sm">
              Please check your inbox and spam folder. Password reset links expire after 1 hour.
            </p>

            <Link
              to="/auth/login"
              className="w-full btn-gradient py-3.5 text-base flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="glass-auth p-8">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl text-pg-navy mb-2">Reset Password</h1>
          <p className="text-pg-text-secondary">We'll send you reset instructions</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-pg-text mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-pg-text-secondary" />
              </div>
              <input
                {...register('email')}
                type="email"
                id="email"
                className="w-full pl-10 input-auth"
                placeholder="you@example.com"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-pg-coral font-medium">{errors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-gradient py-3.5 text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/auth/login"
            className="inline-flex items-center text-sm link-auth"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};

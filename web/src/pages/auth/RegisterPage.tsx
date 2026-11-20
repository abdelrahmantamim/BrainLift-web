import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Lock, ArrowRight, Star } from 'lucide-react';
import { BrainLifting } from '@/components/common/BrainLifting';
import { useAuthStore } from '@/store/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { AuthLayout } from '@/components/auth/AuthLayout';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
  studentType: z.string().min(1, 'Please select a student type'),
  terms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const [isLoading, setIsLoading] = useState(false);
  const { isWebLoginEnabled, isLoading: isCheckingFlags } = useFeatureFlags();

  const studentTypes = [
    { value: 'elementary', label: 'Elementary' },
    { value: 'middle_school', label: 'Middle School' },
    { value: 'high_school', label: 'High School' },
    { value: 'college', label: 'College' },
    { value: 'adult', label: 'Adult Learner' },
  ];

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await register({
        name: data.name,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        studentType: data.studentType,
      });
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
            <h1 className="font-heading text-2xl text-pg-navy mb-2">Registration Unavailable</h1>
            <p className="text-pg-text-secondary text-sm">
              Account creation is currently disabled. Please try again later or use the mobile app.
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
        <div className="text-center mb-6">
          <h1 className="font-heading text-3xl text-pg-navy mb-2">Join BrainLift!</h1>
          <p className="text-pg-text-secondary">Start your learning adventure today</p>
          {/* XP teaser */}
          <div className="mt-3 inline-flex items-center gap-2 bg-pg-yellow/20 border-2 border-pg-navy rounded-pill px-4 py-1.5">
            <Star size={14} className="text-pg-yellow" fill="currentColor" />
            <span className="font-heading text-sm text-pg-navy font-semibold">Earn 10 XP just for signing up!</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-pg-text mb-1.5">
              Full Name
            </label>
            <input
              {...formRegister('name')}
              type="text"
              id="name"
              className="w-full input-auth"
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-pg-coral font-medium">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-pg-text mb-1.5">
              Email
            </label>
            <input
              {...formRegister('email')}
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
              {...formRegister('password')}
              type="password"
              id="password"
              className="w-full input-auth"
              placeholder="Min 8 chars, mixed case, number & symbol"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-pg-coral font-medium">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-pg-text mb-1.5">
              Confirm Password
            </label>
            <input
              {...formRegister('confirmPassword')}
              type="password"
              id="confirmPassword"
              className="w-full input-auth"
              placeholder="Repeat your password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-pg-coral font-medium">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="studentType" className="block text-sm font-semibold text-pg-text mb-1.5">
              I am a...
            </label>
            <select
              {...formRegister('studentType')}
              id="studentType"
              className="w-full input-auth"
            >
              <option value="">Select your level</option>
              {studentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.studentType && (
              <p className="mt-1 text-sm text-pg-coral font-medium">{errors.studentType.message}</p>
            )}
          </div>

          <div className="flex items-start">
            <input
              {...formRegister('terms')}
              type="checkbox"
              id="terms"
              className="w-4 h-4 mt-0.5 rounded border-2 border-pg-navy accent-[var(--pg-coral)]"
            />
            <label htmlFor="terms" className="ml-2 text-sm text-pg-text-secondary">
              I agree to the{' '}
              <Link to="/terms-of-service" className="link-auth">Terms of Service</Link>{' '}
              and{' '}
              <Link to="/privacy-policy" className="link-auth">Privacy Policy</Link>
            </label>
          </div>
          {errors.terms && (
            <p className="text-sm text-pg-coral font-medium">{errors.terms.message}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-gradient py-3.5 text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create Account
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-pg-text-secondary">
            Already have an account?{' '}
            <Link to="/auth/login" className="link-auth">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

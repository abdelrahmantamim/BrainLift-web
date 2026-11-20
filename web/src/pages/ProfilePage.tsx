import React, { useState, useRef, useEffect } from 'react';
import { Camera, Lock, User, Mail, Calendar, Shield, Eye, EyeOff, Image, Trash2, LogOut, ChevronDown, Award, TrendingUp, Trophy } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/auth.service';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/common/Modal';
import { XPBar } from '@/components/ui/XPBar';
import { useDashboardStore } from '@/store/dashboardStore';
import { xpService, type Achievement } from '@/services/xp.service';
import { getAccentColor } from '@/styles/playground-theme';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile, logout } = useAuthStore();
  const { dashboardData, fetchDashboardData } = useDashboardStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [chatBackground, setChatBackground] = useState<string | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [availableAchievements, setAvailableAchievements] = useState<Achievement[]>([]);
  const [achievementsError, setAchievementsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    studentType: user?.student_type || 'high_school',
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateProfile(profileForm);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(passwordForm.newPassword);
    const hasLowerCase = /[a-z]/.test(passwordForm.newPassword);
    const hasNumbers = /\d/.test(passwordForm.newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      toast.error('Password must contain uppercase, lowercase, numbers, and special characters');
      return;
    }

    setPasswordLoading(true);

    try {
      await authService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: unknown) {
      const errorData = error as { response?: { data?: { error?: { message?: string } } } };
      const errorMessage = errorData.response?.data?.error?.message || 'Failed to change password';
      toast.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB for base64 storage)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    setAvatarLoading(true);

    // Read file as data URL
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;

        await authService.uploadAvatar(base64);

        // Update local user data
        await updateProfile({ ...user, avatar_url: base64 });

        toast.success('Avatar updated successfully');
      } catch {
        toast.error('Failed to upload avatar');
      } finally {
        setAvatarLoading(false);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
      setAvatarLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleChatBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB for backgrounds to store as base64)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    setBackgroundLoading(true);

    // Read file as data URL
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64 = reader.result as string;

        await authService.uploadChatBackground(base64);
        setChatBackground(base64);
        // Update auth store so it persists across navigation
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
          const updated = { ...currentUser, chat_background: base64, chat_background_url: base64 };
          localStorage.setItem('user_data', JSON.stringify(updated));
        }
        toast.success('Chat background updated successfully');
      } catch {
        toast.error('Failed to upload chat background');
      } finally {
        setBackgroundLoading(false);
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
      setBackgroundLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveChatBackground = async () => {
    setBackgroundLoading(true);

    try {
      await authService.removeChatBackground();
      setChatBackground(null);
      // Update auth store
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        const updated = { ...currentUser, chat_background: null, chat_background_url: null };
        localStorage.setItem('user_data', JSON.stringify(updated));
      }
      toast.success('Chat background removed');
    } catch {
      toast.error('Failed to remove chat background');
    } finally {
      setBackgroundLoading(false);
    }
  };

  // Fetch dashboard data on mount if not already loaded
  useEffect(() => {
    if (!dashboardData) {
      fetchDashboardData();
    }
  }, [dashboardData, fetchDashboardData]);

  // Load chat background on mount
  useEffect(() => {
    const bg = user?.chat_background_url || user?.chat_background;
    if (bg) {
      setChatBackground(bg);
    }
  }, [user]);

  // Fetch real achievements on mount
  useEffect(() => {
    let cancelled = false;
    xpService
      .getAchievements()
      .then((data) => {
        if (cancelled) return;
        setUnlockedAchievements(data.unlocked);
        setAvailableAchievements(data.available);
      })
      .catch(() => {
        if (!cancelled) setAchievementsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  if (!user) return null;

  // Get XP from dashboard data or default to 0
  const totalXP = dashboardData?.user?.totalXP || 0;

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-heading font-bold text-pg-navy mb-1">Profile Settings</h1>
                <p className="text-pg-text-secondary font-body">Manage your account information and preferences</p>
              </div>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="px-4 py-2 border-2 border-pg-coral rounded-lg bg-pg-surface hover:bg-pg-coral/10 transition-all text-pg-coral font-body font-semibold flex items-center gap-2 cursor-pointer hover:-translate-y-0.5"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

        {/* Profile Section */}
        <div className="border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-heading font-bold text-pg-navy">Profile Information</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all cursor-pointer"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Avatar Section */}
          <div className="flex items-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-3 border-pg-navy shadow-clay-coral p-0.5 bg-pg-surface">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-pg-coral to-pg-lilac flex items-center justify-center overflow-hidden">
                  {(user.avatar_url || user.avatarUrl) ? (
                    <img
                      src={user.avatar_url || user.avatarUrl}
                      alt={user.name || user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-12 h-12 text-white" />
                  )}
                </div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="absolute bottom-0 right-0 p-2 bg-pg-teal border-2 border-pg-navy rounded-full hover:bg-pg-teal/80 transition-all cursor-pointer disabled:opacity-50 shadow-clay-navy hover:-translate-y-0.5"
              >
                {avatarLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="ml-6 flex-1">
              <h3 className="text-lg font-heading font-bold text-pg-navy">{user.name || user.username || user.email.split('@')[0]}</h3>
              <p className="text-pg-text-secondary font-body">@{user.username || user.email.split('@')[0]}</p>

              {/* XP Bar */}
              <div className="mt-4">
                <XPBar
                  currentXP={totalXP}
                  level={dashboardData?.user?.level}
                  levelName={dashboardData?.user?.levelName}
                  showLabel
                  showHint
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">Full Name</label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body outline-none disabled:opacity-50 disabled:bg-pg-cream/30"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">Username</label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body outline-none disabled:opacity-50 disabled:bg-pg-cream/30"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">Email</label>
                <div className="flex items-center px-4 py-3 bg-pg-cream/30 border-2 border-pg-navy/30 rounded-xl">
                  <Mail className="w-5 h-5 text-pg-text-secondary mr-3" />
                  <span className="text-pg-text-secondary font-body">{user.email}</span>
                </div>
              </div>

              {/* Student Type */}
              <div>
                <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">Student Type</label>
                <div className="relative">
                  <select
                    value={profileForm.studentType}
                    onChange={(e) => setProfileForm({ ...profileForm, studentType: e.target.value })}
                    disabled={!isEditing}
                    className="w-full px-4 py-3 pr-10 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body outline-none disabled:opacity-50 disabled:bg-pg-cream/30 appearance-none cursor-pointer"
                  >
                    <option value="elementary">Elementary</option>
                    <option value="middle_school">Middle School</option>
                    <option value="high_school">High School</option>
                    <option value="college">College</option>
                    <option value="adult">Adult Learner</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-pg-text-secondary pointer-events-none" />
                </div>
              </div>
            </div>

              {/* Member Since */}
              <div>
                <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">Member Since</label>
                <div className="flex items-center px-4 py-3 border-2 border-pg-navy/30 rounded-xl bg-pg-cream/30">
                  <Calendar className="w-5 h-5 text-pg-text-secondary mr-3" />
                  <span className="text-pg-text-secondary font-body">
                    {new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

            {/* Form Actions */}
            {isEditing && (
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setProfileForm({
                      name: user.name || '',
                      username: user.username || '',
                      studentType: user.student_type || 'high_school',
                    });
                  }}
                  className="px-4 py-2 rounded-xl border-2 border-pg-navy bg-pg-surface hover:bg-pg-cream transition-all font-heading font-semibold text-pg-navy cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            )}
          </form>
        </div>

          {/* Stats Section */}
          <div className="border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-yellow p-8 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-heading font-bold text-pg-navy mb-2">Learning Stats</h2>
                <p className="text-pg-text-secondary font-body">Your progress and achievements</p>
              </div>
              <TrendingUp className="w-6 h-6 text-pg-teal" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="pg-stat-pill">
                <Trophy className="w-5 h-5 text-pg-coral" />
                <div>
                  <div className="text-2xl font-heading font-bold text-pg-navy">{dashboardData?.currentStats.totalQuizzes || 0}</div>
                  <div className="text-xs text-pg-text-secondary font-body">Quizzes</div>
                </div>
              </div>
              <div className="pg-stat-pill">
                <Award className="w-5 h-5 text-pg-teal" />
                <div>
                  <div className="text-2xl font-heading font-bold text-pg-navy">{dashboardData?.currentStats.currentStreak || 0}</div>
                  <div className="text-xs text-pg-text-secondary font-body">Day Streak</div>
                </div>
              </div>
              <div className="pg-stat-pill">
                <TrendingUp className="w-5 h-5 text-pg-yellow" />
                <div>
                  <div className="text-2xl font-heading font-bold text-pg-navy">{Math.round((dashboardData?.currentStats.totalStudyMinutes || 0) / 60)}h</div>
                  <div className="text-xs text-pg-text-secondary font-body">Study Time</div>
                </div>
              </div>
              <div className="pg-stat-pill">
                <Award className="w-5 h-5 text-pg-lilac" />
                <div>
                  <div className="text-2xl font-heading font-bold text-pg-navy">{totalXP}</div>
                  <div className="text-xs text-pg-text-secondary font-body">Total XP</div>
                </div>
              </div>
            </div>
          </div>

          {/* Achievements Section */}
          {!achievementsError && (unlockedAchievements.length > 0 || availableAchievements.length > 0) && (
            <div className="border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-lilac p-8 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-heading font-bold text-pg-navy mb-2">Achievements</h2>
                  <p className="text-pg-text-secondary font-body">Badges you've earned</p>
                </div>
                <Award className="w-6 h-6 text-pg-lilac" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {unlockedAchievements.map((achievement, index) => {
                  const color = getAccentColor(index);
                  return (
                    <div
                      key={achievement.key}
                      className={`border-2 border-pg-navy rounded-xl p-4 text-center transition-all cursor-pointer hover:-translate-y-1 bg-pg-${color} shadow-clay-${color}`}
                    >
                      <div className="text-3xl mb-2">{achievement.icon}</div>
                      <div className="text-sm font-heading font-semibold text-[#1A2B4A] dark:text-pg-text">{achievement.name}</div>
                    </div>
                  );
                })}
                {availableAchievements.map((achievement) => (
                  <div
                    key={achievement.key}
                    className="border-2 border-pg-navy rounded-xl p-4 text-center bg-pg-cream/30 opacity-50"
                  >
                    <div className="text-3xl mb-2">{achievement.icon}</div>
                    <div className="text-sm font-heading font-semibold text-[#1A2B4A] dark:text-pg-text">{achievement.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customization Section */}
          <div className="border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal p-8 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-heading font-bold text-pg-navy mb-2">Customization</h2>
                <p className="text-pg-text-secondary font-body">Personalize your app experience</p>
              </div>
              <Image className="w-6 h-6 text-pg-teal" />
            </div>

            <button
              onClick={() => setShowBackgroundModal(true)}
              className="w-full md:w-auto px-6 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-teal/10 transition-all cursor-pointer hover:-translate-y-0.5 flex items-center gap-3 font-body font-semibold text-pg-text"
            >
              <Image className="w-5 h-5" />
              Chat Background
            </button>
          </div>

          {/* Security Section */}
          <div className="border-2 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-heading font-bold text-pg-navy mb-2">Security</h2>
                <p className="text-pg-text-secondary font-body">Manage your password and security settings</p>
              </div>
              <Shield className="w-6 h-6 text-pg-coral" />
            </div>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full md:w-auto px-6 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-coral/10 transition-all cursor-pointer hover:-translate-y-0.5 flex items-center gap-3 font-body font-semibold text-pg-text"
            >
              <Lock className="w-5 h-5" />
              Change Password
            </button>
          </div>

          {/* Password Change Modal */}
          {showPasswordModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-coral max-w-md w-full p-6">
              <h3 className="text-xl font-heading font-bold text-pg-navy mb-6">Change Password</h3>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="w-full px-4 py-3 pr-12 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-pg-navy/10 rounded cursor-pointer"
                    >
                      {showPasswords.current ? (
                        <EyeOff className="w-4 h-4 text-pg-text-secondary" />
                      ) : (
                        <Eye className="w-4 h-4 text-pg-text-secondary" />
                      )}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-4 py-3 pr-12 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-pg-navy/10 rounded cursor-pointer"
                    >
                      {showPasswords.new ? (
                        <EyeOff className="w-4 h-4 text-pg-text-secondary" />
                      ) : (
                        <Eye className="w-4 h-4 text-pg-text-secondary" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-heading font-semibold mb-2 text-pg-navy">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 pr-12 border-2 border-pg-navy rounded-xl focus:ring-2 focus:ring-pg-coral bg-pg-surface text-pg-text font-body outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-pg-navy/10 rounded cursor-pointer"
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="w-4 h-4 text-pg-text-secondary" />
                      ) : (
                        <Eye className="w-4 h-4 text-pg-text-secondary" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="border-2 border-pg-navy/30 rounded-xl p-4 bg-pg-cream/20">
                  <p className="font-heading font-semibold mb-2 text-sm text-pg-navy">Password must contain:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-pg-text-secondary font-body">
                    <li>At least 8 characters</li>
                    <li>One uppercase letter</li>
                    <li>One lowercase letter</li>
                    <li>One number</li>
                    <li>One special character</li>
                  </ul>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                    }}
                    className="px-4 py-2 rounded-xl border-2 border-pg-navy bg-pg-surface hover:bg-pg-cream transition-all font-heading font-semibold text-pg-navy cursor-pointer"
                    disabled={passwordLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-4 py-2 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {passwordLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Changing...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

          {/* Chat Background Modal */}
          {showBackgroundModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-teal max-w-md w-full p-6">
              <h3 className="text-xl font-heading font-bold text-pg-navy mb-6">Chat Background</h3>

              {/* Current Background Preview */}
              {chatBackground ? (
                <div className="mb-6">
                  <p className="text-sm text-pg-text-secondary font-body mb-2">Current Background:</p>
                  <div className="relative rounded-xl overflow-hidden h-48 border-2 border-pg-navy">
                    <img
                      src={chatBackground}
                      alt="Chat background"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                  </div>
                </div>
              ) : (
                <p className="text-pg-text-secondary font-body mb-6">No background set</p>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => backgroundInputRef.current?.click()}
                  disabled={backgroundLoading}
                  className="w-full px-4 py-3 btn-gradient text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {backgroundLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Image className="w-5 h-5" />
                      Choose Background
                    </>
                  )}
                </button>

                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleChatBackgroundChange}
                  className="hidden"
                />

                {chatBackground && (
                  <button
                    onClick={handleRemoveChatBackground}
                    disabled={backgroundLoading}
                    className="w-full px-4 py-3 bg-pg-surface border-2 border-pg-coral text-pg-coral rounded-xl hover:bg-pg-coral/10 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-3 font-heading font-semibold"
                  >
                    <Trash2 className="w-5 h-5" />
                    Remove Background
                  </button>
                )}

                <button
                  onClick={() => setShowBackgroundModal(false)}
                  className="w-full px-4 py-3 border-2 border-pg-navy rounded-xl bg-pg-surface hover:bg-pg-cream transition-all cursor-pointer font-heading font-semibold text-pg-navy"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Modal */}
        <Modal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          title="Confirm Logout"
        >
          <p className="text-pg-text-secondary font-body mb-6">
            Are you sure you want to logout? You'll need to sign in again to access your account.
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="px-4 py-2 rounded-xl border-2 border-pg-navy bg-pg-surface hover:bg-pg-cream transition-all font-heading font-semibold text-pg-navy cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gradient-to-r from-pg-coral to-pg-lilac text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-coral hover:shadow-clay-coral-hover hover:-translate-y-1 transition-all cursor-pointer"
            >
              Logout
            </button>
          </div>
        </Modal>
      </div>
    </div>
  </div>
  );
};

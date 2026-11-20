import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Modal } from '@/components/common/Modal';
import {
  Home,
  MessageSquare,
  FolderOpen,
  BookOpen,
  BrainCircuit,
  User,
  Settings,
  Menu,
  ChevronLeft,
  LogOut
} from 'lucide-react';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/chat', label: 'AI Chat', icon: MessageSquare },
  { path: '/files', label: 'Files', icon: FolderOpen },
  { path: '/flashcards', label: 'Flashcards', icon: BookOpen },
  { path: '/quizzes', label: 'Quizzes', icon: BrainCircuit },
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-pg-surface border-r-3 border-pg-navy transition-all duration-300 z-50",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-3 border-pg-navy">
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <img src={BrainLiftLogo} alt="BrainLift" className="h-10 w-auto" />
          {!isCollapsed && (
            <h1 className="text-xl font-heading font-bold text-pg-coral">
              BrainLift
            </h1>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-navy"
        >
          {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onMouseEnter={() => setHoveredItem(item.path)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={cn(
                    "relative sidebar-item",
                    isActive && "sidebar-item-active",
                    isCollapsed && "justify-center"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {!isCollapsed && <span className="font-body font-semibold">{item.label}</span>}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && hoveredItem === item.path && (
                    <div className="absolute left-full ml-2 px-3 py-2 bg-pg-navy text-white text-sm font-body rounded-lg whitespace-nowrap shadow-clay-coral z-50">
                      {item.label}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t-3 border-pg-navy">
        <div className={cn("space-y-2", isCollapsed && "flex flex-col items-center")}>
          <button
            onClick={() => setShowLogoutModal(true)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-text-secondary hover:text-pg-navy font-body font-semibold",
              isCollapsed && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

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
            className="px-4 py-2 rounded-lg hover:bg-pg-cream transition-colors font-body font-semibold text-pg-navy"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-pg-coral text-white font-heading font-semibold rounded-lg border-2 border-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover hover:-translate-y-1 transition-all duration-200"
          >
            Logout
          </button>
        </div>
      </Modal>
    </aside>
  );
};

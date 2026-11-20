import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Home,
  MessageSquare,
  FolderOpen,
  BookOpen,
  BrainCircuit,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Home', icon: Home },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/files', label: 'Files', icon: FolderOpen },
  { path: '/flashcards', label: 'Cards', icon: BookOpen },
  { path: '/quizzes', label: 'Quiz', icon: BrainCircuit },
];

export const BottomNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-pg-surface border-t-3 border-pg-navy z-50 safe-area-pb">
      <ul className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <li key={item.path} className="flex-1">
              <Link
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 transition-all duration-200",
                  isActive
                    ? "text-pg-coral"
                    : "text-pg-text-secondary hover:text-pg-navy"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
                <span className="text-xs font-body font-semibold">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-pg-coral" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

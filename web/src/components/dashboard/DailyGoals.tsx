import React from 'react';
import { Trophy, MessageSquare, BookOpen, BrainCircuit } from 'lucide-react';
import type { DailyGoals as DailyGoalsType } from '@/services/stats.service';
import { DailyGoalSkeleton } from '@/components/common/LoadingSkeletons';

interface DailyGoalsProps {
  goals: DailyGoalsType;
  isLoading?: boolean;
}

interface GoalItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  current: number;
  target: number;
  color: string;
}

const GoalItem: React.FC<GoalItemProps> = ({
  icon: Icon,
  label,
  current,
  target,
  color
}) => {
  const percentage = Math.min((current / target) * 100, 100);
  const isCompleted = current >= target;

  return (
    <div className={`pg-card shadow-clay-${color} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-pg-${color} border-2 border-pg-navy flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-body font-semibold text-pg-navy">{label}</span>
        </div>
        <span className={`text-sm font-heading font-bold ${isCompleted ? 'text-pg-teal' : 'text-pg-text-secondary'}`}>
          {isCompleted ? '✓' : `${current}/${target}`}
        </span>
      </div>
      <div className="w-full bg-pg-cream rounded-full h-3 border-2 border-pg-navy overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isCompleted ? 'bg-pg-teal' : `bg-pg-${color}`
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export const DailyGoals: React.FC<DailyGoalsProps> = ({ goals, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="pg-card shadow-clay-coral p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-heading font-bold text-pg-navy">Daily Quests</h2>
          <div className="animate-pulse bg-pg-cream rounded w-16 h-6 border-2 border-pg-navy" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <DailyGoalSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  const questItems = [
    {
      icon: MessageSquare,
      label: 'Chat with AI tutor',
      current: goals.progress.chatSessions,
      target: goals.goals.chatSessions,
      color: 'coral',
    },
    {
      icon: BrainCircuit,
      label: 'Complete a quiz',
      current: goals.progress.quizzes,
      target: goals.goals.quizzes,
      color: 'yellow',
    },
    {
      icon: BookOpen,
      label: 'Review flashcards',
      current: goals.progress.flashcards,
      target: goals.goals.flashcards,
      color: 'teal',
    },
  ];

  return (
    <div className="pg-card shadow-clay-coral p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pg-coral border-2 border-pg-navy flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-pg-navy">Daily Quests</h2>
        </div>
        <div className={`px-4 py-2 rounded-pill text-sm font-heading font-bold border-2 border-pg-navy ${
          goals.isCompleted
            ? 'bg-pg-teal text-white shadow-clay-navy'
            : 'bg-pg-yellow text-[#2C3E50] shadow-clay-navy'
        }`}>
          {goals.completionPercentage}% Complete
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {questItems.map((item, index) => (
          <GoalItem key={index} {...item} />
        ))}
      </div>

      {goals.isCompleted && (
        <div className="mt-6 pg-card shadow-clay-teal p-4 bg-pg-teal">
          <div className="flex items-center gap-3 text-white">
            <Trophy className="w-6 h-6" />
            <span className="font-heading font-bold">Congratulations! You've completed all your daily quests!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyGoals;

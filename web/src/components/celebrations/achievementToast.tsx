import toast from 'react-hot-toast';

export function showAchievementToast(a: { name: string; description?: string; icon?: string; points?: number }) {
  toast.custom(
    () => (
      <div className="flex items-center gap-3 bg-pg-surface border-3 border-pg-navy rounded-2xl px-4 py-3 shadow-clay-yellow">
        <span className="text-2xl">{a.icon || '🏆'}</span>
        <div>
          <p className="font-heading font-bold text-pg-navy">Achievement unlocked!</p>
          <p className="text-sm font-body text-pg-text-secondary">
            {a.name}
            {a.points ? ` · +${a.points} XP` : ''}
          </p>
        </div>
      </div>
    ),
    { duration: 4000 }
  );
}

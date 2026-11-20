import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, UserX } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

// Mirrors mobile/src/screens/profile/BlocklistScreen.tsx's BlockedUser shape —
// server returns full_name (not `name`) on the joined profile.
interface BlockedUser {
  id: string;
  blocked_user_id: string;
  blocked_user: {
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
  blocked_at: string;
  reason?: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const BlocklistSection: React.FC = () => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/user/blocklist');
      setBlockedUsers(data.blockedUsers || []);
    } catch (error) {
      console.error('Failed to load blocklist:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlockedUsers();
  }, [loadBlockedUsers]);

  const handleUnblock = async (user: BlockedUser) => {
    setUnblockingId(user.id);
    // Optimistic removal
    const previous = blockedUsers;
    setBlockedUsers((prev) => prev.filter((u) => u.id !== user.id));

    try {
      await api.delete(`/user/blocklist/${user.blocked_user_id}`);
      toast.success('User unblocked');
    } catch (error) {
      console.error('Failed to unblock user:', error);
      // Revert on failure
      setBlockedUsers(previous);
      toast.error('Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <div className="border-3 border-pg-navy rounded-2xl bg-pg-surface shadow-clay-lilac p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-pg-navy" />
        <h3 className="text-lg font-heading font-bold text-pg-navy">Blocked users</h3>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-pg-coral border-t-transparent" />
        </div>
      ) : blockedUsers.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-pg-text-secondary font-body">You haven't blocked anyone.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {blockedUsers.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-pg-navy/20 bg-pg-cream/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full border-2 border-pg-navy bg-pg-coral/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {user.blocked_user.avatar_url ? (
                    <img
                      src={user.blocked_user.avatar_url}
                      alt={user.blocked_user.full_name || user.blocked_user.email}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserX className="w-5 h-5 text-pg-navy" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-pg-navy truncate">
                    {user.blocked_user.full_name || user.blocked_user.email}
                  </p>
                  {user.blocked_user.full_name && (
                    <p className="text-sm text-pg-text-secondary truncate font-body">
                      {user.blocked_user.email}
                    </p>
                  )}
                  <p className="text-xs text-pg-text-secondary font-body">
                    Blocked on {formatDate(user.blocked_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleUnblock(user)}
                disabled={unblockingId === user.id}
                className="px-3 py-2 text-sm font-heading font-semibold rounded-lg border-2 border-pg-coral text-pg-coral bg-pg-coral/10 hover:bg-pg-coral/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {unblockingId === user.id ? 'Unblocking...' : 'Unblock'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

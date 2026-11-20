import React, { useState } from 'react';
import { MessageSquare, Trash2, Clock, AlertCircle } from 'lucide-react';
import type { ChatSession } from '@/types/chat.types';
import { cn } from '@/lib/utils';
import { safeFormatDistanceToNow } from '@/utils/dateUtils';

interface SessionListProps {
  sessions: ChatSession[];
  selectedSessionId?: string;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onCreateSession: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
  onCreateSession
}) => {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (sessionId: string) => {
    onDeleteSession(sessionId);
    setDeleteConfirm(null);
  };
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b-3 border-pg-navy bg-pg-cream/30">
        <button
          onClick={onCreateSession}
          className="w-full py-3 bg-pg-teal hover:bg-pg-coral text-white font-heading font-bold rounded-xl transition-all duration-200 border-2 border-pg-navy shadow-clay-teal hover:shadow-clay-coral cursor-pointer"
        >
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 font-body">
            <MessageSquare className="w-16 h-16 mx-auto text-pg-teal mb-3" />
            <p className="text-pg-text-secondary">No conversations yet</p>
            <p className="text-sm text-pg-text-secondary/70 mt-1">Start a new chat to begin</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session)}
              className={cn(
                "p-3 rounded-xl cursor-pointer transition-all duration-200 group border-2",
                "hover:bg-pg-coral/10 hover:border-pg-coral",
                selectedSessionId === session.id
                  ? "bg-pg-teal/20 border-pg-teal shadow-clay-teal"
                  : "border-transparent"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-bold text-pg-navy truncate">
                    {session.title || 'Untitled Chat'}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-pg-text-secondary font-body">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {session.messageCount || session.message_count || 0} messages
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {safeFormatDistanceToNow(session.updatedAt || session.updated_at, { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-pg-coral/20 transition-all border-2 border-transparent hover:border-pg-coral cursor-pointer"
                  title="Delete session"
                >
                  <Trash2 className="w-4 h-4 text-pg-coral" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-pg-navy/50 flex items-center justify-center z-50 p-4">
          <div className="bg-pg-surface border-3 border-pg-navy rounded-2xl shadow-clay-coral max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-pg-coral/20 flex items-center justify-center border-2 border-pg-coral">
                <AlertCircle className="w-6 h-6 text-pg-coral" />
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-pg-navy">Delete Chat?</h3>
                <p className="text-sm text-pg-text-secondary font-body">This action cannot be undone.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-xl font-body font-semibold hover:bg-pg-cream transition-colors border-2 border-pg-navy cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-pg-coral hover:bg-pg-coral/80 text-white font-body font-semibold rounded-xl transition-colors border-2 border-pg-navy shadow-clay-coral cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { X, Send, MessageSquare, Bug, Sparkles, HelpCircle } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface FeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const categories = [
  { value: 'feedback', label: 'General Feedback', icon: MessageSquare, color: 'text-pg-teal' },
  { value: 'support', label: 'Technical Support', icon: HelpCircle, color: 'text-pg-indigo' },
  { value: 'bug', label: 'Report a Bug', icon: Bug, color: 'text-pg-coral' },
  { value: 'feature', label: 'Feature Request', icon: Sparkles, color: 'text-pg-yellow' }
];

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ isOpen, onClose }) => {
  const [type, setType] = useState('feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/support/contact', {
        type,
        subject,
        message
      });

      toast.success('Message sent successfully! We\'ll get back to you soon.');
      onClose();

      // Reset form
      setType('feedback');
      setSubject('');
      setMessage('');
    } catch (_error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative pg-card shadow-clay-teal w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-pg-navy/10">
          <h2 className="text-xl font-heading font-bold text-pg-navy">
            Contact Us
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-pg-text-secondary hover:text-pg-navy hover:bg-pg-cream transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-pg-text mb-3 font-body">
              How can we help you?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((category) => {
                const Icon = category.icon;
                const isSelected = type === category.value;
                return (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => setType(category.value)}
                    className={`
                      flex items-center gap-2 p-3 rounded-btn border-2 transition-all cursor-pointer
                      ${isSelected
                        ? 'border-pg-coral bg-pg-coral/10 shadow-clay-coral'
                        : 'border-pg-navy/20 hover:border-pg-navy/40 hover:bg-pg-cream'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-pg-coral' : category.color}`} />
                    <span className={`text-sm font-body font-semibold ${
                      isSelected ? 'text-pg-coral' : 'text-pg-navy'
                    }`}>
                      {category.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject */}
          <div className="mb-4">
            <label htmlFor="subject" className="block text-sm font-semibold text-pg-text mb-2 font-body">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full input-auth"
              placeholder="Brief description of your issue or feedback"
              required
            />
          </div>

          {/* Message */}
          <div className="mb-6">
            <label htmlFor="message" className="block text-sm font-semibold text-pg-text mb-2 font-body">
              Message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full input-auth resize-none"
              placeholder="Tell us more about what you need help with..."
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 pg-btn pg-btn-outline justify-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 pg-btn pg-btn-coral justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Message</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

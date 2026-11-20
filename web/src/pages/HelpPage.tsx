import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, BookOpen, FileText, HelpCircle, Send, Bug, Sparkles, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '@/config/constants';

const faqs = [
  {
    q: 'How do I upload study materials?',
    a: 'Go to the Files section from your dashboard. You can upload PDFs, documents, and images. BrainLift will automatically process them for use with AI tutoring, quizzes, and flashcards.',
  },
  {
    q: 'How does the AI tutor work?',
    a: 'The AI tutor uses your uploaded materials to answer questions, explain concepts, and help you study. Just open a chat session and start asking questions about your topics.',
  },
  {
    q: 'How are flashcards generated?',
    a: 'You can create flashcards manually or have the AI generate them from your uploaded documents. Spaced repetition helps you review at optimal intervals.',
  },
  {
    q: 'How does the XP and leveling system work?',
    a: 'You earn XP by chatting with the AI tutor, completing quizzes, and reviewing flashcards. As you accumulate XP, you level up through 10 ranks from Curious Learner to Legend.',
  },
  {
    q: 'Can I share content with other users?',
    a: 'Yes! You can share quizzes and flashcard decks with other users via email. They will receive a notification and can import the content into their own library.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Click "Forgot Password" on the login page and enter your email. You will receive a link to reset your password.',
  },
];

const features = [
  { icon: <MessageCircle size={24} />, title: 'AI Chat Tutor', desc: 'Ask questions and get explanations on any topic from your materials.' },
  { icon: <BookOpen size={24} />, title: 'Smart Flashcards', desc: 'Auto-generated or manual flashcards with spaced repetition.' },
  { icon: <HelpCircle size={24} />, title: 'Quizzes', desc: 'Test your knowledge with AI-generated quizzes from your documents.' },
  { icon: <FileText size={24} />, title: 'Document Processing', desc: 'Upload PDFs and documents to create study materials instantly.' },
];

const categories = [
  { value: 'feedback', label: 'General Feedback', icon: MessageCircle, color: 'text-pg-teal' },
  { value: 'support', label: 'Technical Support', icon: HelpCircle, color: 'text-pg-indigo' },
  { value: 'bug', label: 'Report a Bug', icon: Bug, color: 'text-pg-coral' },
  { value: 'feature', label: 'Feature Request', icon: Sparkles, color: 'text-pg-yellow dark:text-[#FFE066]' },
];

const HelpPage: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '', type: 'support' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/support/public-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || 'Failed to send message');
      }

      setSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '', type: 'support' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-pg-cream dark:bg-[#1A1625]">
      {/* Header */}
      <header className="border-b-[3px] border-pg-navy dark:border-[#4A3F66] bg-white dark:bg-[#241E35]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to="/" className="inline-flex items-center text-pg-navy dark:text-[#D4CCE8] hover:text-pg-coral transition mb-4 font-[Nunito] font-semibold">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">
            Help & Support
          </h1>
          <p className="text-pg-text-secondary dark:text-[#B8AEDE] mt-2 font-[Nunito]">Everything you need to get the most out of BrainLift</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-10">
        {/* Features Overview */}
        <section className="bg-white dark:bg-[#241E35] border-[3px] border-pg-navy dark:border-[#4A3F66] rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(44,62,80,0.15)]">
          <h2 className="text-2xl font-semibold mb-6 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">Getting Started</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4 p-4 rounded-xl bg-pg-cream/50 dark:bg-[#1A1625]/50 border-2 border-pg-navy/10 dark:border-[#4A3F66]/50">
                <div className="text-pg-coral shrink-0 mt-1">{f.icon}</div>
                <div>
                  <h3 className="font-semibold font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">{f.title}</h3>
                  <p className="text-sm text-pg-text-secondary dark:text-[#B8AEDE] font-[Nunito]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="bg-white dark:bg-[#241E35] border-[3px] border-pg-navy dark:border-[#4A3F66] rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(44,62,80,0.15)]">
          <h2 className="text-2xl font-semibold mb-6 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <h3 className="text-lg font-semibold font-[Fredoka] text-pg-navy dark:text-[#F5F0FF] mb-2">{faq.q}</h3>
                <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section className="bg-white dark:bg-[#241E35] border-[3px] border-pg-navy dark:border-[#4A3F66] rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(44,62,80,0.15)]">
          <h2 className="text-2xl font-semibold mb-2 font-[Fredoka] text-pg-navy dark:text-[#F5F0FF]">Contact Us</h2>
          <p className="text-pg-text-secondary dark:text-[#B8AEDE] font-[Nunito] mb-6">
            Can't find the answer? Send us a message and we'll get back to you.
          </p>

          {submitted ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="w-16 h-16 text-pg-teal mb-4" />
              <h3 className="text-xl font-semibold font-[Fredoka] text-pg-navy dark:text-[#F5F0FF] mb-2">Message Sent!</h3>
              <p className="text-pg-text dark:text-[#B8AEDE] font-[Nunito] mb-4">We'll get back to you at your email as soon as possible.</p>
              <button
                onClick={() => setSubmitted(false)}
                className="text-pg-coral font-semibold font-[Nunito] hover:underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-pg-text dark:text-[#F5F0FF] mb-3 font-[Nunito]">
                  How can we help you?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = formData.type === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: cat.value }))}
                        className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-pg-coral bg-pg-coral/10 shadow-[2px_2px_0px_0px_rgba(255,127,80,0.3)]'
                            : 'border-pg-navy/20 dark:border-[#4A3F66] hover:border-pg-navy/40 dark:hover:border-[#4A3F66]/80 hover:bg-pg-cream/50 dark:hover:bg-[#1A1625]/50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-pg-coral' : cat.color}`} />
                        <span className={`text-sm font-[Nunito] font-semibold ${
                          isSelected ? 'text-pg-coral' : 'text-pg-navy dark:text-[#F5F0FF]'
                        }`}>
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="help-name" className="block text-sm font-semibold text-pg-text dark:text-[#F5F0FF] mb-2 font-[Nunito]">
                    Your Name
                  </label>
                  <input
                    id="help-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-pg-navy/20 dark:border-[#4A3F66] bg-white dark:bg-[#1A1625] text-pg-navy dark:text-[#F5F0FF] font-[Nunito] focus:outline-none focus:border-pg-coral transition"
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="help-email" className="block text-sm font-semibold text-pg-text dark:text-[#F5F0FF] mb-2 font-[Nunito]">
                    Your Email
                  </label>
                  <input
                    id="help-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border-2 border-pg-navy/20 dark:border-[#4A3F66] bg-white dark:bg-[#1A1625] text-pg-navy dark:text-[#F5F0FF] font-[Nunito] focus:outline-none focus:border-pg-coral transition"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="help-subject" className="block text-sm font-semibold text-pg-text dark:text-[#F5F0FF] mb-2 font-[Nunito]">
                  Subject
                </label>
                <input
                  id="help-subject"
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border-2 border-pg-navy/20 dark:border-[#4A3F66] bg-white dark:bg-[#1A1625] text-pg-navy dark:text-[#F5F0FF] font-[Nunito] focus:outline-none focus:border-pg-coral transition"
                  placeholder="Brief description of your issue or feedback"
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label htmlFor="help-message" className="block text-sm font-semibold text-pg-text dark:text-[#F5F0FF] mb-2 font-[Nunito]">
                  Message
                </label>
                <textarea
                  id="help-message"
                  value={formData.message}
                  onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border-2 border-pg-navy/20 dark:border-[#4A3F66] bg-white dark:bg-[#1A1625] text-pg-navy dark:text-[#F5F0FF] font-[Nunito] focus:outline-none focus:border-pg-coral transition resize-none"
                  placeholder="Tell us more about what you need help with..."
                  required
                />
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-500 text-sm font-[Nunito]">{error}</p>
              )}

              {/* Submit */}
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-pg-coral text-white font-semibold font-[Nunito] rounded-xl border-[3px] border-pg-navy shadow-[3px_3px_0px_0px_rgba(44,62,80,0.2)] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(44,62,80,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Send Message
                    </>
                  )}
                </button>
                <span className="text-sm text-pg-text-secondary dark:text-[#B8AEDE] font-[Nunito]">
                  or email us at{' '}
                  <a href="mailto:support@getbrainlift.app" className="text-pg-coral hover:underline">
                    support@getbrainlift.app
                  </a>
                </span>
              </div>
            </form>
          )}
        </section>

        {/* Links */}
        <div className="flex gap-6 justify-center text-sm font-[Nunito]">
          <Link to="/privacy" className="text-pg-text-secondary dark:text-[#B8AEDE] hover:text-pg-coral transition">Privacy Policy</Link>
          <Link to="/terms" className="text-pg-text-secondary dark:text-[#B8AEDE] hover:text-pg-coral transition">Terms of Service</Link>
        </div>
      </main>
    </div>
  );
};

export default HelpPage;

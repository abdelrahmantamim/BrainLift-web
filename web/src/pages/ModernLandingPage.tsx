import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Brain, Target, Users, Zap, Star, Check, Lock, Menu, X,
  Trophy, Sparkles, Crown, ArrowRight, Upload,
} from 'lucide-react';
import { featureFlagsService } from '@/services/featureFlags.service';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

const ModernLandingPage: React.FC = () => {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [xpCount, setXpCount] = useState(0);

  useEffect(() => {
    const check = async () => {
      try {
        const enabled = await featureFlagsService.isWebLoginEnabled();
        setIsWebLoginEnabled(enabled);
      } catch {
        setIsWebLoginEnabled(true);
      }
    };
    check();
  }, []);

  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const target = 1250;
    const duration = 2000;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setXpCount(Math.floor(progress * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, 800);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, []);

  const features = [
    { icon: <Brain size={24} />, title: 'AI-Powered Quizzes', desc: 'Upload any document and watch our AI instantly create interactive quizzes tailored to your material. Study smarter, not harder.', color: 'coral' as const, badge: null },
    { icon: <Zap size={24} />, title: 'Smart Flashcards', desc: 'Auto-generated flashcards with spaced repetition. Our algorithm ensures you review at the perfect moment for long-term memory.', color: 'yellow' as const, badge: 'POPULAR' },
    { icon: <Target size={24} />, title: 'AI Tutor Chat', desc: 'Ask questions, get explanations, and dive deeper into any topic. Your personal tutor available 24/7, always patient and helpful.', color: 'teal' as const, badge: 'NEW' },
    { icon: <Users size={24} />, title: 'Share & Compete', desc: 'Send quizzes and flashcards to friends. Challenge classmates and climb the leaderboard together. Learning is better with friends.', color: 'lilac' as const, badge: null },
  ];

  const stats = [
    { num: 'AI', label: 'Powered Learning', color: 'bg-pg-coral text-white' },
    { num: '∞', label: 'Quizzes & Flashcards', color: 'bg-pg-yellow text-pg-navy' },
    { num: '24/7', label: 'AI Tutor Available', color: 'bg-pg-teal text-white' },
    { num: 'Free', label: 'To Get Started', color: 'bg-pg-lilac text-white' },
  ];

  const steps = [
    { num: 1, title: 'Upload Your Material', desc: 'Drop in PDFs, images, notes, or any document. Our AI reads it all in seconds.', icon: <Upload size={20} /> },
    { num: 2, title: 'AI Creates Your Study Kit', desc: 'Quizzes, flashcards, and summaries generated automatically. Choose your study mode.', icon: <Sparkles size={20} /> },
    { num: 3, title: 'Learn & Level Up', desc: 'Study with spaced repetition, track your progress, earn XP, and master any subject.', icon: <Trophy size={20} /> },
  ];

  const pricingPlans = [
    { name: 'Free', price: '$0', period: '', note: '', variant: 'teal' as const, popular: false, features: ['Quizzes and flashcards from photos, PDFs or a topic', 'AI tutor chat', 'Spaced repetition review', 'XP, streaks and daily quests', 'Monthly usage limits'] },
    { name: 'Premium', price: '$6.99', period: '/mo', note: 'or $49.99 a year', variant: 'coral' as const, popular: true, features: ['Everything in Free', 'Higher monthly limits for quizzes, decks and uploads', 'Practice-my-mistakes decks', 'Priority access to new features', 'Cancel anytime in your App Store settings'] },
  ];

  const scenarios = [
    { title: 'The night before a quiz', text: 'Photograph the three pages you covered this week. BrainLift turns them into a 10-question quiz. Miss two? They become a flashcard deck you review tomorrow.', color: 'coral' },
    { title: 'A 60-page lecture PDF', text: 'Upload the slides once. Pick the difficulty and question count. Study the deck in short sessions on the bus instead of rereading the whole file.', color: 'teal' },
    { title: 'A study group of four', text: 'Each person makes a quiz from their chapter and shares it by link or QR code. Everyone takes all four. The group finds its weak spots fast.', color: 'yellow' },
  ];

  const accentBg = (color: string) => `bg-pg-${color}`;

  const AuthButton = ({ to, variant, children, size = 'md' }: { to: string; variant: string; children: React.ReactNode; size?: string }) => {
    const sizeClass = size === 'sm' ? 'px-4 py-2 text-sm' : size === 'lg' ? 'px-9 py-4 text-lg' : 'px-6 py-3 text-base';
    if (!isWebLoginEnabled) {
      return (
        <span className={`pg-btn pg-btn-${variant} ${sizeClass} opacity-50 cursor-not-allowed`}>
          <Lock size={14} /> {children}
        </span>
      );
    }
    return (
      <Link to={to} className={`pg-btn pg-btn-${variant} ${sizeClass}`}>
        {children}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-pg-cream font-body text-pg-text overflow-x-hidden">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-pg-surface border-b-4 border-transparent shadow-pg-subtle"
        style={{ borderImage: 'linear-gradient(90deg, var(--pg-coral), var(--pg-yellow), var(--pg-teal), var(--pg-lilac)) 1' }}>
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-[72px]">
          <a href="#" className="flex items-center gap-2.5 no-underline">
            <img src={BrainLiftLogo} alt="BrainLift Logo" className="h-12 w-auto animate-hero-bounce" />
            <span className="font-heading font-bold text-2xl text-pg-navy">BrainLift</span>
          </a>
          <ul className="hidden md:flex items-center gap-7 list-none">
            <li><a href="#features" className="no-underline font-semibold text-pg-text-secondary hover:text-pg-coral transition-colors text-[0.95rem]">Features</a></li>
            <li><a href="#how-it-works" className="no-underline font-semibold text-pg-text-secondary hover:text-pg-coral transition-colors text-[0.95rem]">How It Works</a></li>
            <li><a href="#pricing" className="no-underline font-semibold text-pg-text-secondary hover:text-pg-coral transition-colors text-[0.95rem]">Pricing</a></li>
            <li><a href="/blog/" className="no-underline font-semibold text-pg-text-secondary hover:text-pg-coral transition-colors text-[0.95rem]">Blog</a></li>
          </ul>
          <div className="hidden md:flex items-center gap-3">
            <AuthButton to="/auth/login" variant="outline" size="sm">Log In</AuthButton>
            <AuthButton to="/auth/register" variant="coral" size="sm">Sign Up Free</AuthButton>
          </div>
          <button className="md:hidden p-2 bg-transparent border-none cursor-pointer" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X size={24} className="text-pg-navy" /> : <Menu size={24} className="text-pg-navy" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-[72px] left-0 right-0 bg-pg-surface border-b-3 border-pg-navy p-6 shadow-pg-subtle z-50">
            <a href="#features" className="block py-3 font-semibold text-pg-text no-underline border-b border-dashed border-gray-200" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block py-3 font-semibold text-pg-text no-underline border-b border-dashed border-gray-200" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
            <a href="#pricing" className="block py-3 font-semibold text-pg-text no-underline border-b border-dashed border-gray-200" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="/blog/" className="block py-3 font-semibold text-pg-text no-underline" onClick={() => setMobileMenuOpen(false)}>Blog</a>
            <div className="flex gap-3 mt-4 pt-4 border-t-2 border-gray-200">
              <AuthButton to="/auth/login" variant="outline" size="sm">Log In</AuthButton>
              <AuthButton to="/auth/register" variant="coral" size="sm">Sign Up Free</AuthButton>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="py-20 md:py-24 relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col-reverse md:flex-row items-center gap-8 md:gap-16">
          <div className="flex-1 text-center md:text-left animate-fade-in-up">
            <h1 className="font-heading text-4xl md:text-[3.5rem] leading-tight text-pg-navy mb-5">
              Level up your{' '}
              <span className="text-pg-coral relative inline-block">
                learning
                <span className="absolute bottom-1 left-0 right-0 h-2.5 bg-pg-yellow/60 -z-10 rounded" />
              </span>{' '}
              adventure!
            </h1>
            <p className="text-lg md:text-xl text-pg-text-secondary leading-relaxed mb-8 max-w-[520px] mx-auto md:mx-0">
              Upload any study material and let AI create quizzes, flashcards, and summaries.
              Track your progress, earn XP, and master any subject.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-10 justify-center md:justify-start">
              <AuthButton to="/auth/register" variant="coral" size="lg">
                Start Learning Free <ArrowRight size={18} />
              </AuthButton>
              <a href="#how-it-works" className="pg-btn pg-btn-outline px-9 py-4 text-lg">
                See How It Works
              </a>
            </div>
            {/* XP Bar Demo */}
            <div className="max-w-[480px] mx-auto md:mx-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-heading font-semibold text-sm text-pg-navy">{xpCount.toLocaleString()} / 2,000 XP</span>
                <span className="pg-level-badge">
                  <Star size={12} /> Level 3
                </span>
              </div>
              <div className="pg-xp-track">
                <div className="pg-xp-fill animate-xp-fill" style={{ '--xp-width': '65%' } as React.CSSProperties} />
              </div>
              <p className="mt-1.5 text-xs text-pg-text-secondary italic">750 XP to Knowledge Seeker</p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center relative animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative z-10">
              <img src={BrainLiftLogo} alt="BrainLift" className="w-[200px] md:w-[300px] h-auto animate-hero-bounce drop-shadow-[6px_6px_0px_rgba(0,0,0,0.1)]" />
            </div>
            {/* Decorative circles */}
            <div className="absolute w-[60px] h-[60px] rounded-full border-3 border-pg-yellow bg-pg-yellow/15 -top-5 -right-8 animate-float" />
            <div className="absolute w-10 h-10 rounded-full border-3 border-pg-teal bg-pg-teal/15 bottom-5 -left-5 animate-float" style={{ animationDelay: '0.5s' }} />
            <div className="absolute w-6 h-6 rounded-full border-3 border-pg-coral bg-pg-coral/15 top-10 left-2.5 animate-float" style={{ animationDelay: '1s' }} />
            <Star size={20} className="absolute top-2.5 left-10 text-pg-yellow animate-wobble" />
            <Star size={16} className="absolute -bottom-2.5 right-5 text-pg-lilac animate-wobble" style={{ animationDelay: '0.5s' }} />
          </div>
        </div>
      </section>

      {/* Stats Pills */}
      <section className="py-12">
        <div className="flex justify-center gap-3 md:gap-5 flex-wrap max-w-[1200px] mx-auto px-6">
          {stats.map((stat, i) => (
            <div key={i} className={`pg-stat-pill ${stat.color} shadow-clay-navy animate-fade-in-up`} style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="text-xl font-bold">{stat.num}</span>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="font-heading text-center text-3xl md:text-[2.4rem] text-pg-navy mb-3">
            Everything you need to ace your studies
          </h2>
          <p className="text-center text-pg-text-secondary text-lg mb-12 max-w-[560px] mx-auto leading-relaxed">
            Powered by AI, designed for results. Create study materials in seconds, not hours.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className={`pg-card pg-card-${feature.color} p-8 relative overflow-hidden group`}
              >
                {feature.badge && (
                  <span className={`absolute top-3 right-3 font-heading font-bold text-[0.7rem] px-2.5 py-1 rounded-pill border-2 border-pg-navy animate-wiggle ${
                    feature.badge === 'NEW' ? 'bg-pg-coral text-white' : 'bg-pg-yellow text-pg-navy'
                  }`}>
                    {feature.badge}
                  </span>
                )}
                <div className={`w-14 h-14 rounded-full border-3 border-pg-navy flex items-center justify-center mb-4 text-white ${accentBg(feature.color)} ${feature.color === 'yellow' ? '!text-pg-navy' : ''}`}>
                  {feature.icon}
                </div>
                <h3 className="font-heading text-xl text-pg-navy mb-2">{feature.title}</h3>
                <p className="text-pg-text-secondary leading-relaxed text-[0.95rem]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 relative">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="font-heading text-center text-3xl md:text-[2.4rem] text-pg-navy mb-3">
            Start learning in 3 simple steps
          </h2>
          <p className="text-center text-pg-text-secondary text-lg mb-12 max-w-[560px] mx-auto leading-relaxed">
            From upload to mastery in minutes. No setup, no hassle.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-10 md:gap-12 relative">
            {/* Dashed path connector */}
            <div className="hidden md:block absolute top-8 left-1/2 -translate-x-1/2 w-[60%] border-t-4 border-dashed border-pg-lilac" />
            {steps.map((step, i) => {
              const colors = ['bg-pg-coral', 'bg-pg-yellow text-pg-navy', 'bg-pg-teal'];
              return (
                <div key={i} className="flex-1 max-w-[300px] text-center relative z-10 mx-auto">
                  <div className={`w-16 h-16 rounded-full border-3 border-pg-navy flex items-center justify-center font-heading font-bold text-2xl mx-auto mb-4 text-white ${colors[i]}`}>
                    {step.num}
                  </div>
                  <h3 className="font-heading text-lg text-pg-navy mb-2">{step.title}</h3>
                  <p className="text-pg-text-secondary leading-relaxed text-sm">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="font-heading text-center text-3xl md:text-[2.4rem] text-pg-navy mb-3">
            Simple, fair pricing
          </h2>
          <p className="text-center text-pg-text-secondary text-lg mb-12 max-w-[560px] mx-auto leading-relaxed">
            Start free. Upgrade inside the app when you hit the limits. Prices in USD; App Store prices can vary by region.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-[760px] mx-auto">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className={`pg-card pg-card-${plan.variant} p-8 text-center relative ${plan.popular ? 'md:scale-105 border-pg-coral' : ''}`}
              >
                {plan.popular && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-pg-yellow border-2 border-pg-navy rounded-pill px-4 py-1 font-heading font-bold text-xs text-pg-navy flex items-center gap-1 animate-wiggle">
                    <Crown size={14} /> Most popular
                  </span>
                )}
                <h3 className="font-heading font-semibold text-xl text-pg-navy mt-2 mb-2">{plan.name}</h3>
                <div className="font-heading font-bold text-5xl text-pg-navy leading-tight">
                  {plan.price}
                  {plan.period && <span className="text-base font-medium text-pg-text-secondary">{plan.period}</span>}
                </div>
                {plan.note && <div className="text-sm text-pg-text-secondary mt-1">{plan.note}</div>}
                <ul className="list-none my-6 text-left space-y-0">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-center gap-2.5 py-2 text-sm text-pg-text border-b border-dashed border-gray-200 last:border-b-0">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white ${accentBg(plan.variant)}`}>
                        <Check size={12} />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <AuthButton to="/auth/register" variant={plan.variant} size="md">
                  {plan.name === 'Free' ? 'Start free' : 'Start free, upgrade in app'}
                </AuthButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How students use it */}
      <section id="use-cases" className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="font-heading text-center text-3xl md:text-[2.4rem] text-pg-navy mb-3">
            Three ways students use it this week
          </h2>
          <p className="text-center text-pg-text-secondary text-lg mb-12 max-w-[560px] mx-auto leading-relaxed">
            BrainLift launched in 2026. No made-up reviews here, just what the app does. Try it free and tell us what to build next.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 max-w-[1000px] mx-auto">
            {scenarios.map((sc) => (
              <div key={sc.title} className={`pg-card pg-card-${sc.color} p-7`}>
                <h3 className="font-heading font-semibold text-xl text-pg-navy mb-3">{sc.title}</h3>
                <p className="text-[0.95rem] leading-relaxed text-pg-text">{sc.text}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="/for/" className="no-underline font-semibold text-pg-navy border-b-3 border-pg-coral pb-0.5">See how it fits nursing, med, law, AP and language courses</a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="bg-pg-navy border-3 border-pg-navy rounded-3xl p-12 md:p-16 text-center relative overflow-hidden shadow-[6px_6px_0px_var(--pg-coral)]">
            {/* Decorative circles */}
            <div className="absolute w-[200px] h-[200px] rounded-full bg-pg-coral/10 -top-16 -right-10" />
            <div className="absolute w-[140px] h-[140px] rounded-full bg-pg-yellow/10 -bottom-12 -left-8" />
            <div className="absolute w-20 h-20 rounded-full bg-pg-teal/10 top-8 left-16" />
            <h2 className="font-heading text-3xl md:text-[2.4rem] text-white mb-4 relative z-10">
              Ready to transform your learning?
            </h2>
            <p className="text-white/70 text-lg mb-8 max-w-[500px] mx-auto relative z-10 leading-relaxed">
              Upload any study material and let AI create quizzes, flashcards, and summaries. Start free today.
            </p>
            <div className="flex justify-center gap-4 relative z-10 flex-wrap">
              <AuthButton to="/auth/register" variant="coral" size="lg">
                Start Learning Free <ArrowRight size={18} />
              </AuthButton>
              <a
                href="https://apps.apple.com/us/app/brainlift-ai-quiz-flashcard/id6749842070"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl border-3 border-black hover:bg-gray-900 transition-colors no-underline"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div className="text-left">
                  <div className="text-[10px] leading-none opacity-80">Download on the</div>
                  <div className="text-sm font-semibold leading-tight">App Store</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t-3 border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 flex-wrap">
            <div className="max-w-[280px] text-center md:text-left">
              <a href="#" className="flex items-center gap-2 no-underline mb-3 justify-center md:justify-start">
                <img src={BrainLiftLogo} alt="BrainLift" className="h-10 w-auto" />
                <span className="font-heading font-bold text-xl text-pg-navy">BrainLift</span>
              </a>
              <p className="text-pg-text-secondary text-sm leading-relaxed">
                Turn notes, PDFs and photos of your textbook into quizzes and flashcards, then study them with spaced repetition. AI-generated content can contain mistakes, so check important answers against your course materials.
              </p>
            </div>
            <div>
              <h4 className="font-heading text-[0.95rem] text-pg-navy mb-3">Product</h4>
              <a href="#features" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Features</a>
              <a href="#pricing" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Pricing</a>
              <a href="/for/" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Who it's for</a>
              <a href="/compare/" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Compare study apps</a>
              <a href="/blog/" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Blog</a>
              <a href="/press/" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Press kit</a>
            </div>
            <div>
              <h4 className="font-heading text-[0.95rem] text-pg-navy mb-3">Legal</h4>
              <Link to="/privacy" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Terms of Service</Link>
            </div>
            <div>
              <h4 className="font-heading text-[0.95rem] text-pg-navy mb-3">Support</h4>
              <Link to="/help" className="block text-pg-text-secondary text-sm no-underline mb-2 hover:text-pg-coral transition-colors">Help center</Link>
            </div>
            <div>
              <h4 className="font-heading text-[0.95rem] text-pg-navy mb-3">Get the App</h4>
              <a
                href="https://apps.apple.com/us/app/brainlift-ai-quiz-flashcard/id6749842070"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl no-underline hover:bg-gray-900 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                <div className="text-left">
                  <div className="text-[9px] leading-none opacity-80">Download on the</div>
                  <div className="text-xs font-semibold leading-tight">App Store</div>
                </div>
              </a>
            </div>
          </div>
          <div className="text-center mt-10 pt-6 border-t-2 border-dashed border-gray-200 text-pg-text-secondary text-xs">
            &copy; {new Date().getFullYear()} BrainLift. All rights reserved. Made with{' '}
            <span className="text-pg-coral">love</span> for learners everywhere.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ModernLandingPage;

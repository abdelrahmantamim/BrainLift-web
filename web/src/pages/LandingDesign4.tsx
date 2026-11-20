import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { featureFlagsService } from '@/services/featureFlags.service';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';
import { Lock, ArrowRight, Star, Check, Zap, Brain, Target, Users, Trophy, Sparkles, Crown } from 'lucide-react';
import { DesignSwitcher } from '@/components/DesignSwitcher';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap');

:root {
  --bg-cream: #FFF8F0;
  --card-white: #FFFFFF;
  --text-primary: #2D2D2D;
  --text-secondary: #7A7A7A;
  --coral: #FF6B6B;
  --yellow: #FFD93D;
  --teal: #4ECDC4;
  --lilac: #C3ACD0;
  --navy: #2C3E50;
  --shadow: rgba(0,0,0,0.08);
  --radius-card: 16px;
  --radius-btn: 12px;
  --radius-pill: 999px;
}

@keyframes heroBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(3deg); }
  75% { transform: rotate(-3deg); }
}
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(5deg); }
}
@keyframes floatReverse {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(10px) rotate(-5deg); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes xpFill {
  from { width: 0%; }
  to { width: 65%; }
}
@keyframes wiggle {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}

.playground-landing * { box-sizing: border-box; margin: 0; padding: 0; }
.playground-landing {
  font-family: 'Nunito', sans-serif;
  background: var(--bg-cream);
  color: var(--text-primary);
  overflow-x: hidden;
  min-height: 100vh;
}
.playground-landing h1,
.playground-landing h2,
.playground-landing h3,
.playground-landing h4 {
  font-family: 'Fredoka', sans-serif;
}
.pg-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

.pg-nav {
  position: sticky; top: 0; z-index: 100; background: var(--card-white);
  border-bottom: 4px solid transparent;
  border-image: linear-gradient(90deg, var(--coral), var(--yellow), var(--teal), var(--lilac)) 1;
  box-shadow: 0 2px 12px var(--shadow);
}
.pg-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 72px; }
.pg-nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.pg-nav-logo img { height: 48px; width: auto; animation: heroBounce 2.4s ease-in-out infinite; }
.pg-nav-logo span { font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 1.5rem; color: var(--navy); }
.pg-nav-links { display: flex; align-items: center; gap: 28px; list-style: none; }
.pg-nav-links a { text-decoration: none; font-weight: 600; color: var(--text-secondary); transition: color 0.2s; font-size: 0.95rem; }
.pg-nav-links a:hover { color: var(--coral); }
.pg-nav-auth { display: flex; align-items: center; gap: 12px; }

.pg-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 1rem;
  padding: 12px 24px; border-radius: var(--radius-btn);
  border: 2px solid var(--text-primary); cursor: pointer;
  transition: all 0.18s ease; text-decoration: none; white-space: nowrap;
}
.pg-btn:hover { transform: translateY(-2px); }
.pg-btn:active { transform: translateY(1px); }
.pg-btn-coral { background: var(--coral); color: #fff; box-shadow: 4px 4px 0px var(--navy); }
.pg-btn-coral:hover { box-shadow: 2px 6px 0px var(--navy); }
.pg-btn-teal { background: var(--teal); color: #fff; box-shadow: 4px 4px 0px var(--navy); }
.pg-btn-teal:hover { box-shadow: 2px 6px 0px var(--navy); }
.pg-btn-yellow { background: var(--yellow); color: var(--navy); box-shadow: 4px 4px 0px var(--navy); }
.pg-btn-yellow:hover { box-shadow: 2px 6px 0px var(--navy); }
.pg-btn-outline { background: transparent; color: var(--navy); box-shadow: none; }
.pg-btn-outline:hover { background: var(--bg-cream); }
.pg-btn-disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
.pg-btn-sm { padding: 8px 16px; font-size: 0.875rem; }
.pg-btn-lg { padding: 16px 36px; font-size: 1.15rem; }

.pg-hero { padding: 80px 0 60px; position: relative; overflow: hidden; }
.pg-hero-inner { display: flex; align-items: center; gap: 60px; }
.pg-hero-text { flex: 1; animation: fadeInUp 0.7s ease-out; }
.pg-hero-text h1 { font-size: 3.5rem; line-height: 1.15; color: var(--navy); margin-bottom: 20px; }
.pg-hero-text h1 .highlight-coral { color: var(--coral); position: relative; display: inline-block; }
.pg-hero-text h1 .highlight-coral::after {
  content: ''; position: absolute; bottom: 4px; left: 0; right: 0;
  height: 10px; background: var(--yellow); z-index: -1; border-radius: 4px; opacity: 0.6;
}
.pg-hero-text p { font-size: 1.2rem; color: var(--text-secondary); line-height: 1.7; margin-bottom: 32px; max-width: 520px; }
.pg-hero-ctas { display: flex; gap: 16px; margin-bottom: 40px; flex-wrap: wrap; }
.pg-hero-visual { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; animation: fadeInUp 0.7s ease-out 0.2s both; }
.pg-hero-logo-wrap { position: relative; z-index: 2; }
.pg-hero-logo-wrap img { width: 300px; height: auto; animation: heroBounce 2.4s ease-in-out infinite; filter: drop-shadow(6px 6px 0px rgba(0,0,0,0.1)); }
.pg-deco-circle { position: absolute; border-radius: 50%; border: 3px solid; z-index: 1; }
.pg-deco-circle-1 { width: 60px; height: 60px; border-color: var(--yellow); top: -20px; right: -30px; animation: float 3s ease-in-out infinite; background: rgba(255,217,61,0.15); }
.pg-deco-circle-2 { width: 40px; height: 40px; border-color: var(--teal); bottom: 20px; left: -20px; animation: floatReverse 3.5s ease-in-out infinite; background: rgba(78,205,196,0.15); }
.pg-deco-circle-3 { width: 24px; height: 24px; border-color: var(--coral); top: 40px; left: 10px; animation: float 2.8s ease-in-out infinite 0.5s; background: rgba(255,107,107,0.15); }
.pg-deco-star { position: absolute; z-index: 1; animation: wobble 2s ease-in-out infinite; }
.pg-deco-star-1 { top: 10px; left: 40px; color: var(--yellow); }
.pg-deco-star-2 { bottom: -10px; right: 20px; color: var(--lilac); animation-delay: 0.5s; }

.pg-xp-bar-wrap { max-width: 480px; }
.pg-xp-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.pg-xp-label span { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 0.9rem; color: var(--navy); }
.pg-xp-label .pg-xp-level { display: inline-flex; align-items: center; gap: 4px; background: var(--yellow); border: 2px solid var(--navy); border-radius: var(--radius-pill); padding: 2px 12px; font-size: 0.8rem; }
.pg-xp-track { height: 20px; background: #E8E8E8; border-radius: var(--radius-pill); border: 2px solid var(--navy); overflow: hidden; position: relative; }
.pg-xp-fill { height: 100%; border-radius: var(--radius-pill); background: linear-gradient(90deg, var(--coral), var(--yellow)); animation: xpFill 1.5s ease-out 0.5s both; position: relative; }
.pg-xp-fill::after { content: ''; position: absolute; top: 3px; left: 8px; right: 8px; height: 5px; background: rgba(255,255,255,0.35); border-radius: var(--radius-pill); }
.pg-xp-hint { margin-top: 6px; font-size: 0.8rem; color: var(--text-secondary); font-style: italic; }

.pg-section { padding: 80px 0; }
.pg-section-title { text-align: center; margin-bottom: 12px; font-size: 2.4rem; color: var(--navy); }
.pg-section-subtitle { text-align: center; color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 48px; max-width: 560px; margin-left: auto; margin-right: auto; line-height: 1.6; }

.pg-features-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
.pg-feature-card { background: var(--card-white); border: 3px solid var(--text-primary); border-radius: var(--radius-card); padding: 32px; transition: all 0.2s ease; position: relative; overflow: hidden; }
.pg-feature-card:hover { transform: translateY(-4px); }
.pg-feature-card--coral { box-shadow: 4px 4px 0px var(--coral); }
.pg-feature-card--coral:hover { box-shadow: 2px 8px 0px var(--coral); }
.pg-feature-card--yellow { box-shadow: 4px 4px 0px var(--yellow); }
.pg-feature-card--yellow:hover { box-shadow: 2px 8px 0px var(--yellow); }
.pg-feature-card--teal { box-shadow: 4px 4px 0px var(--teal); }
.pg-feature-card--teal:hover { box-shadow: 2px 8px 0px var(--teal); }
.pg-feature-card--lilac { box-shadow: 4px 4px 0px var(--lilac); }
.pg-feature-card--lilac:hover { box-shadow: 2px 8px 0px var(--lilac); }
.pg-feature-icon { width: 56px; height: 56px; border-radius: 50%; border: 3px solid var(--text-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #fff; }
.pg-feature-icon--coral { background: var(--coral); }
.pg-feature-icon--yellow { background: var(--yellow); color: var(--navy); }
.pg-feature-icon--teal { background: var(--teal); }
.pg-feature-icon--lilac { background: var(--lilac); }
.pg-feature-card h3 { font-size: 1.25rem; margin-bottom: 8px; color: var(--navy); }
.pg-feature-card p { color: var(--text-secondary); line-height: 1.6; font-size: 0.95rem; }
.pg-feature-badge { position: absolute; top: 12px; right: 12px; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 0.7rem; padding: 4px 10px; border-radius: var(--radius-pill); border: 2px solid var(--navy); animation: wiggle 1.5s ease-in-out infinite; }
.pg-badge-new { background: var(--coral); color: #fff; }
.pg-badge-popular { background: var(--yellow); color: var(--navy); }

.pg-stats { padding: 48px 0; position: relative; }
.pg-stats-inner { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
.pg-stat-pill { display: flex; align-items: center; gap: 10px; padding: 14px 28px; border-radius: var(--radius-pill); border: 3px solid var(--text-primary); font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 1rem; animation: fadeInUp 0.6s ease-out both; }
.pg-stat-pill:nth-child(1) { background: var(--coral); color: #fff; box-shadow: 3px 3px 0px var(--navy); animation-delay: 0s; }
.pg-stat-pill:nth-child(2) { background: var(--yellow); color: var(--navy); box-shadow: 3px 3px 0px var(--navy); animation-delay: 0.1s; }
.pg-stat-pill:nth-child(3) { background: var(--teal); color: #fff; box-shadow: 3px 3px 0px var(--navy); animation-delay: 0.2s; }
.pg-stat-pill:nth-child(4) { background: var(--lilac); color: #fff; box-shadow: 3px 3px 0px var(--navy); animation-delay: 0.3s; }
.pg-stat-pill .pg-stat-num { font-size: 1.3rem; font-weight: 700; }

.pg-how { position: relative; }
.pg-how-steps { display: flex; justify-content: center; gap: 40px; position: relative; }
.pg-how-step { flex: 1; max-width: 300px; text-align: center; position: relative; z-index: 2; }
.pg-how-number { width: 64px; height: 64px; border-radius: 50%; border: 3px solid var(--navy); display: flex; align-items: center; justify-content: center; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 1.5rem; margin: 0 auto 16px; color: #fff; position: relative; }
.pg-how-step:nth-child(2) .pg-how-number { background: var(--coral); }
.pg-how-step:nth-child(3) .pg-how-number { background: var(--yellow); color: var(--navy); }
.pg-how-step:nth-child(4) .pg-how-number { background: var(--teal); }
.pg-how-step h3 { font-size: 1.15rem; margin-bottom: 8px; color: var(--navy); }
.pg-how-step p { color: var(--text-secondary); line-height: 1.6; font-size: 0.9rem; }
.pg-how-path { position: absolute; top: 32px; left: 50%; transform: translateX(-50%); width: 60%; height: 4px; z-index: 1; }
.pg-how-path-line { width: 100%; height: 100%; border-top: 4px dashed var(--lilac); }

.pg-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: start; }
.pg-pricing-card { background: var(--card-white); border: 3px solid var(--text-primary); border-radius: var(--radius-card); padding: 32px; text-align: center; transition: all 0.2s ease; position: relative; }
.pg-pricing-card:hover { transform: translateY(-4px); }
.pg-pricing-card--free { box-shadow: 4px 4px 0px var(--teal); }
.pg-pricing-card--free:hover { box-shadow: 2px 8px 0px var(--teal); }
.pg-pricing-card--pro { box-shadow: 4px 4px 0px var(--coral); border-color: var(--coral); transform: scale(1.04); }
.pg-pricing-card--pro:hover { transform: scale(1.04) translateY(-4px); box-shadow: 2px 8px 0px var(--coral); }
.pg-pricing-card--team { box-shadow: 4px 4px 0px var(--lilac); }
.pg-pricing-card--team:hover { box-shadow: 2px 8px 0px var(--lilac); }
.pg-pricing-crown { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); background: var(--yellow); border: 2px solid var(--navy); border-radius: var(--radius-pill); padding: 4px 16px; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 0.75rem; color: var(--navy); display: flex; align-items: center; gap: 4px; animation: wiggle 2s ease-in-out infinite; }
.pg-pricing-name { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 1.2rem; color: var(--navy); margin-bottom: 8px; margin-top: 8px; }
.pg-pricing-price { font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 2.8rem; color: var(--navy); line-height: 1.1; }
.pg-pricing-price span { font-size: 1rem; font-weight: 500; color: var(--text-secondary); }
.pg-pricing-features { list-style: none; margin: 24px 0; text-align: left; }
.pg-pricing-features li { display: flex; align-items: center; gap: 10px; padding: 8px 0; font-size: 0.9rem; color: var(--text-primary); border-bottom: 1px dashed #eee; }
.pg-pricing-features li:last-child { border-bottom: none; }
.pg-pricing-check { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pg-pricing-check--teal { background: var(--teal); color: #fff; }
.pg-pricing-check--coral { background: var(--coral); color: #fff; }
.pg-pricing-check--lilac { background: var(--lilac); color: #fff; }
.pg-pricing-free-badge { display: inline-block; background: var(--teal); color: #fff; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 0.7rem; padding: 2px 10px; border-radius: var(--radius-pill); border: 2px solid var(--navy); margin-bottom: 8px; }

.pg-testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.pg-testimonial-card { background: var(--card-white); border: 3px solid var(--text-primary); border-radius: var(--radius-card); padding: 28px; position: relative; margin-bottom: 20px; transition: all 0.2s ease; }
.pg-testimonial-card:hover { transform: translateY(-3px); }
.pg-testimonial-card:nth-child(1) { box-shadow: 4px 4px 0px var(--coral); }
.pg-testimonial-card:nth-child(2) { box-shadow: 4px 4px 0px var(--teal); }
.pg-testimonial-card:nth-child(3) { box-shadow: 4px 4px 0px var(--yellow); }
.pg-testimonial-card::after { content: ''; position: absolute; bottom: -14px; left: 36px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 14px solid var(--text-primary); }
.pg-testimonial-card::before { content: ''; position: absolute; bottom: -10px; left: 38px; width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 12px solid var(--card-white); z-index: 2; }
.pg-testimonial-stars { display: flex; gap: 3px; margin-bottom: 12px; color: var(--yellow); }
.pg-testimonial-text { font-size: 0.95rem; line-height: 1.65; color: var(--text-primary); margin-bottom: 16px; font-style: italic; }
.pg-testimonial-author { display: flex; align-items: center; gap: 12px; }
.pg-testimonial-avatar { width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--navy); display: flex; align-items: center; justify-content: center; font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 0.85rem; color: #fff; }
.pg-testimonial-card:nth-child(1) .pg-testimonial-avatar { background: var(--coral); }
.pg-testimonial-card:nth-child(2) .pg-testimonial-avatar { background: var(--teal); }
.pg-testimonial-card:nth-child(3) .pg-testimonial-avatar { background: var(--lilac); }
.pg-testimonial-name { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 0.95rem; color: var(--navy); }
.pg-testimonial-role { font-size: 0.8rem; color: var(--text-secondary); }

.pg-cta { padding: 80px 0; }
.pg-cta-box { background: var(--navy); border: 3px solid var(--text-primary); border-radius: 24px; padding: 60px 40px; text-align: center; position: relative; overflow: hidden; box-shadow: 6px 6px 0px var(--coral); }
.pg-cta-box h2 { font-size: 2.4rem; color: #fff; margin-bottom: 16px; position: relative; z-index: 2; }
.pg-cta-box p { color: rgba(255,255,255,0.7); font-size: 1.1rem; margin-bottom: 32px; max-width: 500px; margin-left: auto; margin-right: auto; position: relative; z-index: 2; line-height: 1.6; }
.pg-cta-buttons { display: flex; justify-content: center; gap: 16px; position: relative; z-index: 2; flex-wrap: wrap; }
.pg-cta-deco { position: absolute; border-radius: 50%; opacity: 0.12; }
.pg-cta-deco-1 { width: 200px; height: 200px; background: var(--coral); top: -60px; right: -40px; }
.pg-cta-deco-2 { width: 140px; height: 140px; background: var(--yellow); bottom: -50px; left: -30px; }
.pg-cta-deco-3 { width: 80px; height: 80px; background: var(--teal); top: 30px; left: 60px; }

.pg-footer { padding: 48px 0 32px; border-top: 3px solid #eee; }
.pg-footer-inner { display: flex; justify-content: space-between; align-items: start; gap: 40px; flex-wrap: wrap; }
.pg-footer-brand { max-width: 280px; }
.pg-footer-brand-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; text-decoration: none; }
.pg-footer-brand-logo img { height: 40px; width: auto; }
.pg-footer-brand-logo span { font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 1.25rem; color: var(--navy); }
.pg-footer-brand p { color: var(--text-secondary); font-size: 0.85rem; line-height: 1.6; }
.pg-footer-col h4 { font-size: 0.95rem; color: var(--navy); margin-bottom: 12px; }
.pg-footer-col a { display: block; color: var(--text-secondary); text-decoration: none; font-size: 0.85rem; margin-bottom: 8px; transition: color 0.2s; }
.pg-footer-col a:hover { color: var(--coral); }
.pg-footer-bottom { text-align: center; margin-top: 40px; padding-top: 24px; border-top: 2px dashed #eee; color: var(--text-secondary); font-size: 0.8rem; }

.pg-mobile-toggle { display: none; background: none; border: none; cursor: pointer; padding: 8px; }
.pg-mobile-toggle span { display: block; width: 24px; height: 3px; background: var(--navy); border-radius: 2px; margin: 5px 0; transition: all 0.3s; }
.pg-mobile-menu { display: none; }

@media (max-width: 1024px) {
  .pg-hero-text h1 { font-size: 2.8rem; }
  .pg-hero-logo-wrap img { width: 240px; }
  .pg-features-grid { gap: 20px; }
}
@media (max-width: 768px) {
  .pg-nav-links, .pg-nav-auth { display: none; }
  .pg-mobile-toggle { display: block; }
  .pg-mobile-menu { display: none; position: absolute; top: 72px; left: 0; right: 0; background: var(--card-white); border-bottom: 3px solid var(--navy); padding: 24px; z-index: 99; box-shadow: 0 8px 24px var(--shadow); }
  .pg-mobile-menu.open { display: block; }
  .pg-mobile-menu a { display: block; padding: 12px 0; font-weight: 600; color: var(--text-primary); text-decoration: none; border-bottom: 1px dashed #eee; }
  .pg-mobile-menu a:last-child { border-bottom: none; }
  .pg-mobile-menu-auth { display: flex; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 2px solid #eee; }
  .pg-hero-inner { flex-direction: column-reverse; text-align: center; gap: 32px; }
  .pg-hero-text h1 { font-size: 2.2rem; }
  .pg-hero-text p { margin: 0 auto 28px; }
  .pg-hero-ctas { justify-content: center; }
  .pg-hero-logo-wrap img { width: 200px; }
  .pg-features-grid { grid-template-columns: 1fr; }
  .pg-how-steps { flex-direction: column; align-items: center; gap: 32px; }
  .pg-how-path { display: none; }
  .pg-pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
  .pg-pricing-card--pro { transform: none; }
  .pg-pricing-card--pro:hover { transform: translateY(-4px); }
  .pg-testimonials-grid { grid-template-columns: 1fr; max-width: 440px; margin: 0 auto; }
  .pg-xp-bar-wrap { margin: 0 auto; }
  .pg-section-title { font-size: 1.9rem; }
  .pg-footer-inner { flex-direction: column; text-align: center; align-items: center; }
  .pg-footer-brand { text-align: center; }
  .pg-stats-inner { gap: 12px; }
  .pg-stat-pill { padding: 10px 18px; font-size: 0.85rem; }
  .pg-cta-box { padding: 40px 24px; }
  .pg-cta-box h2 { font-size: 1.8rem; }
}
@media (max-width: 480px) {
  .pg-hero-text h1 { font-size: 1.8rem; }
  .pg-hero-ctas { flex-direction: column; align-items: center; }
  .pg-stat-pill { font-size: 0.75rem; padding: 8px 14px; }
  .pg-cta-buttons { flex-direction: column; align-items: center; }
}
`;

const LandingDesign4: React.FC = () => {
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
    { num: '10,000+', label: 'Learners' },
    { num: '500K+', label: 'Quizzes Created' },
    { num: '95%', label: 'Pass Rate' },
    { num: '4.9', label: 'App Rating' },
  ];

  const steps = [
    { num: 1, title: 'Upload Your Material', desc: 'Drop in PDFs, images, notes, or any document. Our AI reads it all in seconds.' },
    { num: 2, title: 'AI Creates Your Study Kit', desc: 'Quizzes, flashcards, and summaries generated automatically. Choose your study mode.' },
    { num: 3, title: 'Learn & Level Up', desc: 'Study with spaced repetition, track your progress, earn XP, and master any subject.' },
  ];

  const pricingPlans = [
    { name: 'Free', price: '$0', period: '', variant: 'free' as const, features: ['5 quizzes per month', '10 flashcard decks', 'AI tutor (basic)', 'Share with 2 friends', 'Basic analytics'] },
    { name: 'Pro', price: '$9.99', period: '/mo', variant: 'pro' as const, features: ['Unlimited quizzes', 'Unlimited flashcards', 'AI tutor (advanced)', 'Unlimited sharing', 'Detailed analytics', 'Priority support', 'Custom study paths'] },
    { name: 'Team', price: '$29.99', period: '/mo', variant: 'team' as const, features: ['Everything in Pro', 'Up to 25 members', 'Team dashboard', 'Shared library', 'Admin controls', 'API access'] },
  ];

  const testimonials = [
    { name: 'Sarah Chen', role: 'Medical Student', text: 'BrainLift is literally a game changer! I uploaded my anatomy notes and had a full quiz ready in under a minute. My grades have never been better.', avatar: 'SC', rating: 5 },
    { name: 'Marcus Rodriguez', role: 'Language Learner', text: 'The flashcards with spaced repetition helped me learn 300 Japanese characters in two weeks. The progress tracking keeps me motivated every day!', avatar: 'MR', rating: 5 },
    { name: 'Priya Patel', role: 'High School Teacher', text: 'I create quizzes for my students in minutes instead of hours. They love the gamified experience and actually look forward to studying. Best tool I have found.', avatar: 'PP', rating: 5 },
  ];

  const checkColor = (variant: string) => {
    if (variant === 'free') return 'teal';
    if (variant === 'pro') return 'coral';
    if (variant === 'team') return 'lilac';
    return 'teal';
  };

  return (
    <div className="playground-landing">
      <style>{STYLES}</style>

      <nav className="pg-nav">
        <div className="pg-container pg-nav-inner">
          <a href="#" className="pg-nav-logo">
            <img src={BrainLiftLogo} alt="BrainLift Logo" />
            <span>BrainLift</span>
          </a>
          <ul className="pg-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#testimonials">Reviews</a></li>
          </ul>
          <div className="pg-nav-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="pg-btn pg-btn-outline pg-btn-sm">Log In</Link>
                <Link to="/auth/register" className="pg-btn pg-btn-coral pg-btn-sm">Sign Up Free</Link>
              </>
            ) : (
              <>
                <span className="pg-btn pg-btn-outline pg-btn-sm pg-btn-disabled"><Lock size={14} /> Log In</span>
                <span className="pg-btn pg-btn-coral pg-btn-sm pg-btn-disabled"><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
          <button className="pg-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>
        <div className={`pg-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
          <div className="pg-mobile-menu-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="pg-btn pg-btn-outline pg-btn-sm" style={{ flex: 1 }}>Log In</Link>
                <Link to="/auth/register" className="pg-btn pg-btn-coral pg-btn-sm" style={{ flex: 1 }}>Sign Up Free</Link>
              </>
            ) : (
              <>
                <span className="pg-btn pg-btn-outline pg-btn-sm pg-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Log In</span>
                <span className="pg-btn pg-btn-coral pg-btn-sm pg-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="pg-hero">
        <div className="pg-container pg-hero-inner">
          <div className="pg-hero-text">
            <h1>
              <span className="highlight-coral">Level up</span> your<br />
              learning adventure!
            </h1>
            <p>
              Transform any document into quizzes, flashcards, and study materials
              with AI. Earn XP, track progress, and make studying actually fun.
            </p>
            <div className="pg-hero-ctas">
              {isWebLoginEnabled ? (
                <>
                  <Link to="/auth/register" className="pg-btn pg-btn-coral pg-btn-lg">
                    Start Learning Free <ArrowRight size={18} />
                  </Link>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="pg-btn pg-btn-outline pg-btn-lg">
                    Get the App
                  </a>
                </>
              ) : (
                <>
                  <span className="pg-btn pg-btn-coral pg-btn-lg pg-btn-disabled">
                    <Lock size={18} /> Coming Soon
                  </span>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="pg-btn pg-btn-outline pg-btn-lg">
                    Get the App
                  </a>
                </>
              )}
            </div>
            <div className="pg-xp-bar-wrap">
              <div className="pg-xp-label">
                <span>
                  <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {xpCount.toLocaleString()} XP
                </span>
                <span className="pg-xp-level">
                  <Trophy size={12} /> Level 0
                </span>
              </div>
              <div className="pg-xp-track">
                <div className="pg-xp-fill" />
              </div>
              <p className="pg-xp-hint">You are at Level 0 -- Start your journey!</p>
            </div>
          </div>
          <div className="pg-hero-visual">
            <div className="pg-hero-logo-wrap">
              <img src={BrainLiftLogo} alt="BrainLift brain mascot lifting a barbell" />
              <div className="pg-deco-circle pg-deco-circle-1" />
              <div className="pg-deco-circle pg-deco-circle-2" />
              <div className="pg-deco-circle pg-deco-circle-3" />
              <div className="pg-deco-star pg-deco-star-1"><Star size={28} fill="currentColor" /></div>
              <div className="pg-deco-star pg-deco-star-2"><Star size={20} fill="currentColor" /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="pg-stats">
        <div className="pg-container pg-stats-inner">
          {stats.map((stat, i) => (
            <div className="pg-stat-pill" key={i}>
              <span className="pg-stat-num">{stat.num}</span>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pg-section" id="features">
        <div className="pg-container">
          <h2 className="pg-section-title">Everything you need to ace it</h2>
          <p className="pg-section-subtitle">
            Powerful AI tools wrapped in a playful experience. Learning has never felt this good.
          </p>
          <div className="pg-features-grid">
            {features.map((feat, i) => (
              <div className={`pg-feature-card pg-feature-card--${feat.color}`} key={i}>
                {feat.badge && (
                  <span className={`pg-feature-badge ${feat.badge === 'NEW' ? 'pg-badge-new' : 'pg-badge-popular'}`}>
                    {feat.badge === 'NEW' ? <Sparkles size={10} /> : <Star size={10} />}
                    {' '}{feat.badge}
                  </span>
                )}
                <div className={`pg-feature-icon pg-feature-icon--${feat.color}`}>{feat.icon}</div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pg-section pg-how" id="how-it-works">
        <div className="pg-container">
          <h2 className="pg-section-title">How it works</h2>
          <p className="pg-section-subtitle">
            Three simple steps to transform any material into your personal study companion.
          </p>
          <div className="pg-how-steps">
            <div className="pg-how-path"><div className="pg-how-path-line" /></div>
            {steps.map((step, i) => (
              <div className="pg-how-step" key={i}>
                <div className="pg-how-number">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pg-section" id="pricing">
        <div className="pg-container">
          <h2 className="pg-section-title">Pick your plan</h2>
          <p className="pg-section-subtitle">
            Start free and upgrade when you are ready. No credit card required.
          </p>
          <div className="pg-pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div className={`pg-pricing-card pg-pricing-card--${plan.variant}`} key={i}>
                {plan.variant === 'pro' && (
                  <div className="pg-pricing-crown"><Crown size={14} /> MOST POPULAR</div>
                )}
                {plan.variant === 'free' && <span className="pg-pricing-free-badge">FREE</span>}
                <div className="pg-pricing-name">{plan.name}</div>
                <div className="pg-pricing-price">
                  {plan.price}
                  {plan.period && <span>{plan.period}</span>}
                </div>
                <ul className="pg-pricing-features">
                  {plan.features.map((feat, j) => (
                    <li key={j}>
                      <span className={`pg-pricing-check pg-pricing-check--${checkColor(plan.variant)}`}>
                        <Check size={13} />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                {isWebLoginEnabled ? (
                  <Link
                    to="/auth/register"
                    className={`pg-btn ${plan.variant === 'pro' ? 'pg-btn-coral' : plan.variant === 'team' ? 'pg-btn-teal' : 'pg-btn-yellow'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {plan.variant === 'free' ? 'Get Started' : plan.variant === 'pro' ? 'Go Pro' : 'Contact Us'}
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <span
                    className={`pg-btn ${plan.variant === 'pro' ? 'pg-btn-coral' : plan.variant === 'team' ? 'pg-btn-teal' : 'pg-btn-yellow'} pg-btn-disabled`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Lock size={14} /> Coming Soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pg-section" id="testimonials">
        <div className="pg-container">
          <h2 className="pg-section-title">Loved by learners everywhere</h2>
          <p className="pg-section-subtitle">
            Join thousands of students and educators who are leveling up their study game.
          </p>
          <div className="pg-testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="pg-testimonial-card" key={i}>
                <div className="pg-testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="pg-testimonial-text">"{t.text}"</p>
                <div className="pg-testimonial-author">
                  <div className="pg-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="pg-testimonial-name">{t.name}</div>
                    <div className="pg-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pg-cta">
        <div className="pg-container">
          <div className="pg-cta-box">
            <div className="pg-cta-deco pg-cta-deco-1" />
            <div className="pg-cta-deco pg-cta-deco-2" />
            <div className="pg-cta-deco pg-cta-deco-3" />
            <h2>Ready to start your learning adventure?</h2>
            <p>
              Join 10,000+ learners who are already leveling up with BrainLift.
              It is free to start -- no credit card needed.
            </p>
            <div className="pg-cta-buttons">
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="pg-btn pg-btn-coral pg-btn-lg">
                  Create Free Account <ArrowRight size={18} />
                </Link>
              ) : (
                <span className="pg-btn pg-btn-coral pg-btn-lg pg-btn-disabled">
                  <Lock size={18} /> Coming Soon
                </span>
              )}
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="pg-btn pg-btn-yellow pg-btn-lg">
                Download App
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="pg-footer">
        <div className="pg-container">
          <div className="pg-footer-inner">
            <div className="pg-footer-brand">
              <a href="#" className="pg-footer-brand-logo">
                <img src={BrainLiftLogo} alt="BrainLift" />
                <span>BrainLift</span>
              </a>
              <p>
                Making studying feel like play. Upload your materials, let AI do the heavy lifting, and
                level up your knowledge every day.
              </p>
            </div>
            <div className="pg-footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#testimonials">Reviews</a>
            </div>
            <div className="pg-footer-col">
              <h4>Download</h4>
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer">iOS App</a>
              <a href="https://play.google.com/store/apps/details?id=com.brainlift.app" target="_blank" rel="noopener noreferrer">Android App</a>
            </div>
            <div className="pg-footer-col">
              <h4>Legal</h4>
              <Link to="/privacy-policy">Privacy Policy</Link>
              <Link to="/terms-of-service">Terms of Service</Link>
            </div>
          </div>
          <div className="pg-footer-bottom">
            &copy; {new Date().getFullYear()} BrainLift. All rights reserved. Made with love for learners everywhere.
          </div>
        </div>
      </footer>
      <DesignSwitcher />
    </div>
  );
};

export default LandingDesign4;

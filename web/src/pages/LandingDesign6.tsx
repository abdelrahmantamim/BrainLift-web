import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { featureFlagsService } from '@/services/featureFlags.service';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';
import { Lock, ArrowRight, Star, Check, Zap, Brain, Target, Users, Sparkles, Heart, Crown } from 'lucide-react';
import { DesignSwitcher } from '@/components/DesignSwitcher';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap');

:root {
  --candy-pink: #FF69B4;
  --candy-pink-light: #FFB6D9;
  --candy-pink-dark: #E0559E;
  --candy-mint: #98FF98;
  --candy-mint-dark: #6BD66B;
  --candy-lavender: #E6E6FA;
  --candy-lavender-dark: #C5C5E8;
  --candy-peach: #FFDAB9;
  --candy-peach-dark: #FFBE8A;
  --candy-blue: #87CEEB;
  --candy-blue-dark: #5FB8DB;
  --candy-white: #FFFFFF;
  --candy-bg: #FFF0F5;
  --candy-text: #4A2040;
  --candy-text-light: #8B6B80;
  --candy-shadow: rgba(255, 105, 180, 0.15);
  --candy-radius: 20px;
  --candy-radius-pill: 999px;
}

/* ==================== KEYFRAME ANIMATIONS ==================== */

@keyframes candyFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-15px) scale(1.05); }
}
@keyframes candyFloatReverse {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(12px) scale(0.97); }
}
@keyframes candySpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes candyPulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.15); opacity: 1; }
}
@keyframes candyBounce {
  0%, 100% { transform: translateY(0); }
  40% { transform: translateY(-20px); }
  60% { transform: translateY(-10px); }
}
@keyframes candyFadeInUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes candyFadeInScale {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes candyXpFill {
  from { width: 0%; }
  to { width: 72%; }
}
@keyframes candyShimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes candyGradientBorder {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes candyWiggle {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes confettiFall1 {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.6; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
@keyframes confettiFall2 {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
  10% { opacity: 0.5; }
  90% { opacity: 0.5; }
  100% { transform: translateY(110vh) rotate(-540deg); opacity: 0; }
}
@keyframes confettiFall3 {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
  10% { opacity: 0.4; }
  90% { opacity: 0.4; }
  100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
}
@keyframes bubbleRise {
  0% { transform: translateY(100%) scale(0.5); opacity: 0; }
  20% { opacity: 0.3; }
  80% { opacity: 0.3; }
  100% { transform: translateY(-100vh) scale(1.2); opacity: 0; }
}
@keyframes heartBeat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.15); }
  30% { transform: scale(1); }
  45% { transform: scale(1.1); }
}
@keyframes candyStripe {
  0% { background-position: 0 0; }
  100% { background-position: 40px 0; }
}

/* ==================== SCROLL REVEAL ==================== */

.candy-reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.candy-reveal.candy-visible {
  opacity: 1;
  transform: translateY(0);
}

/* ==================== BASE STYLES ==================== */

.candy-landing * { box-sizing: border-box; margin: 0; padding: 0; }
.candy-landing {
  font-family: 'Quicksand', sans-serif;
  background: linear-gradient(180deg, #FFF0F5 0%, #FFFFFF 30%, #FFF5FA 60%, #FFFFFF 100%);
  color: var(--candy-text);
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
}
.candy-landing h1,
.candy-landing h2,
.candy-landing h3,
.candy-landing h4 {
  font-family: 'Baloo 2', cursive;
}

/* ==================== CONFETTI BACKGROUND ==================== */

.candy-confetti {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.candy-confetti-dot {
  position: absolute;
  border-radius: 50%;
}
.candy-confetti-dot:nth-child(1) { width: 12px; height: 12px; background: var(--candy-pink-light); left: 5%; animation: confettiFall1 18s linear infinite; animation-delay: 0s; }
.candy-confetti-dot:nth-child(2) { width: 8px; height: 8px; background: var(--candy-mint); left: 15%; animation: confettiFall2 22s linear infinite; animation-delay: 2s; }
.candy-confetti-dot:nth-child(3) { width: 10px; height: 10px; background: var(--candy-lavender); left: 25%; animation: confettiFall3 20s linear infinite; animation-delay: 4s; }
.candy-confetti-dot:nth-child(4) { width: 6px; height: 6px; background: var(--candy-peach); left: 35%; animation: confettiFall1 24s linear infinite; animation-delay: 1s; }
.candy-confetti-dot:nth-child(5) { width: 14px; height: 14px; background: var(--candy-blue); left: 45%; animation: confettiFall2 19s linear infinite; animation-delay: 3s; }
.candy-confetti-dot:nth-child(6) { width: 9px; height: 9px; background: var(--candy-pink); left: 55%; animation: confettiFall3 21s linear infinite; animation-delay: 5s; opacity: 0.3; }
.candy-confetti-dot:nth-child(7) { width: 7px; height: 7px; background: var(--candy-mint); left: 65%; animation: confettiFall1 23s linear infinite; animation-delay: 0.5s; }
.candy-confetti-dot:nth-child(8) { width: 11px; height: 11px; background: var(--candy-lavender-dark); left: 75%; animation: confettiFall2 17s linear infinite; animation-delay: 2.5s; }
.candy-confetti-dot:nth-child(9) { width: 8px; height: 8px; background: var(--candy-peach-dark); left: 85%; animation: confettiFall3 25s linear infinite; animation-delay: 1.5s; }
.candy-confetti-dot:nth-child(10) { width: 13px; height: 13px; background: var(--candy-blue-dark); left: 92%; animation: confettiFall1 20s linear infinite; animation-delay: 4.5s; }
.candy-confetti-dot:nth-child(11) { width: 6px; height: 6px; background: var(--candy-pink-light); left: 10%; animation: confettiFall2 26s linear infinite; animation-delay: 6s; }
.candy-confetti-dot:nth-child(12) { width: 10px; height: 10px; background: var(--candy-mint-dark); left: 50%; animation: confettiFall1 16s linear infinite; animation-delay: 7s; }

/* Bubble shapes rising from bottom */
.candy-bubble {
  position: absolute;
  border-radius: 50%;
  border: 2px solid;
  opacity: 0;
}
.candy-bubble:nth-child(13) { width: 30px; height: 30px; border-color: var(--candy-pink-light); left: 8%; bottom: 0; animation: bubbleRise 15s ease-in infinite; animation-delay: 0s; }
.candy-bubble:nth-child(14) { width: 20px; height: 20px; border-color: var(--candy-lavender); left: 30%; bottom: 0; animation: bubbleRise 18s ease-in infinite; animation-delay: 3s; }
.candy-bubble:nth-child(15) { width: 25px; height: 25px; border-color: var(--candy-mint); left: 60%; bottom: 0; animation: bubbleRise 14s ease-in infinite; animation-delay: 6s; }
.candy-bubble:nth-child(16) { width: 18px; height: 18px; border-color: var(--candy-peach); left: 80%; bottom: 0; animation: bubbleRise 20s ease-in infinite; animation-delay: 9s; }

.candy-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }

/* ==================== FROSTED GLASS NAV ==================== */

.candy-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 2px solid rgba(255, 105, 180, 0.15);
  box-shadow: 0 4px 30px rgba(255, 105, 180, 0.08);
}
.candy-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}
.candy-nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.candy-nav-logo img {
  height: 46px;
  width: auto;
  animation: candyBounce 3s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(255, 105, 180, 0.3));
}
.candy-nav-logo span {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 1.55rem;
  background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.candy-nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
  list-style: none;
}
.candy-nav-links a {
  text-decoration: none;
  font-weight: 600;
  color: var(--candy-text-light);
  transition: color 0.25s, transform 0.25s;
  font-size: 0.95rem;
  position: relative;
}
.candy-nav-links a::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--candy-pink), var(--candy-peach));
  border-radius: 2px;
  transition: width 0.3s ease;
}
.candy-nav-links a:hover { color: var(--candy-pink); }
.candy-nav-links a:hover::after { width: 100%; }
.candy-nav-auth { display: flex; align-items: center; gap: 12px; }

/* ==================== BUTTONS ==================== */

.candy-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'Baloo 2', cursive;
  font-weight: 600;
  font-size: 1rem;
  padding: 12px 28px;
  border-radius: var(--candy-radius-pill);
  border: none;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  text-decoration: none;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}
.candy-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  transition: left 0.5s;
}
.candy-btn:hover::before { left: 100%; }
.candy-btn:hover { transform: translateY(-3px) scale(1.03); }
.candy-btn:active { transform: translateY(0) scale(0.98); }

.candy-btn-pink {
  background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark));
  color: #fff;
  box-shadow: 0 6px 20px rgba(255, 105, 180, 0.35);
}
.candy-btn-pink:hover { box-shadow: 0 8px 28px rgba(255, 105, 180, 0.5); }

.candy-btn-mint {
  background: linear-gradient(135deg, var(--candy-mint), var(--candy-mint-dark));
  color: var(--candy-text);
  box-shadow: 0 6px 20px rgba(152, 255, 152, 0.35);
}
.candy-btn-mint:hover { box-shadow: 0 8px 28px rgba(152, 255, 152, 0.5); }

.candy-btn-lavender {
  background: linear-gradient(135deg, var(--candy-lavender), var(--candy-lavender-dark));
  color: var(--candy-text);
  box-shadow: 0 6px 20px rgba(230, 230, 250, 0.5);
}

.candy-btn-peach {
  background: linear-gradient(135deg, var(--candy-peach), var(--candy-peach-dark));
  color: var(--candy-text);
  box-shadow: 0 6px 20px rgba(255, 218, 185, 0.5);
}

.candy-btn-outline {
  background: transparent;
  color: var(--candy-pink);
  border: 2px solid var(--candy-pink-light);
  box-shadow: none;
}
.candy-btn-outline:hover {
  background: rgba(255, 105, 180, 0.06);
  border-color: var(--candy-pink);
}

.candy-btn-disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
.candy-btn-sm { padding: 8px 20px; font-size: 0.9rem; }
.candy-btn-lg { padding: 16px 36px; font-size: 1.15rem; }

/* ==================== HERO ==================== */

.candy-hero {
  padding: 90px 0 70px;
  position: relative;
  overflow: hidden;
}
.candy-hero-inner {
  display: flex;
  align-items: center;
  gap: 60px;
}
.candy-hero-text {
  flex: 1;
  animation: candyFadeInUp 0.8s ease-out;
}
.candy-hero-text h1 {
  font-size: 3.6rem;
  line-height: 1.12;
  color: var(--candy-text);
  margin-bottom: 20px;
  font-weight: 800;
}
.candy-hero-text h1 .candy-highlight {
  position: relative;
  display: inline-block;
  background: linear-gradient(135deg, var(--candy-pink), #FF1493);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.candy-hero-text h1 .candy-highlight::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: -4px;
  right: -4px;
  height: 12px;
  background: linear-gradient(90deg, var(--candy-pink-light), var(--candy-peach));
  z-index: -1;
  border-radius: 6px;
  opacity: 0.5;
}
.candy-hero-text p {
  font-size: 1.2rem;
  color: var(--candy-text-light);
  line-height: 1.75;
  margin-bottom: 36px;
  max-width: 520px;
  font-weight: 500;
}
.candy-hero-ctas {
  display: flex;
  gap: 16px;
  margin-bottom: 44px;
  flex-wrap: wrap;
}
.candy-hero-visual {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: candyFadeInUp 0.8s ease-out 0.2s both;
}
.candy-hero-logo-wrap {
  position: relative;
  z-index: 2;
}
.candy-hero-logo-wrap img {
  width: 280px;
  height: auto;
  animation: candyFloat 3.5s ease-in-out infinite;
  filter: drop-shadow(0 12px 30px rgba(255, 105, 180, 0.25));
}

/* Hero decorative candy elements */
.candy-deco {
  position: absolute;
  border-radius: 50%;
  z-index: 1;
}
.candy-deco-1 {
  width: 70px;
  height: 70px;
  background: linear-gradient(135deg, var(--candy-pink-light), var(--candy-peach));
  top: -25px;
  right: -20px;
  animation: candyFloat 4s ease-in-out infinite;
  opacity: 0.7;
}
.candy-deco-2 {
  width: 45px;
  height: 45px;
  background: linear-gradient(135deg, var(--candy-mint), var(--candy-blue));
  bottom: 15px;
  left: -30px;
  animation: candyFloatReverse 3.5s ease-in-out infinite;
  opacity: 0.6;
}
.candy-deco-3 {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, var(--candy-lavender), var(--candy-pink-light));
  top: 50px;
  left: 15px;
  animation: candyPulse 3s ease-in-out infinite;
  opacity: 0.65;
}
.candy-deco-4 {
  width: 20px;
  height: 20px;
  background: var(--candy-peach);
  bottom: -10px;
  right: 50px;
  animation: candyPulse 2.8s ease-in-out infinite 0.5s;
  opacity: 0.55;
}
.candy-deco-heart {
  position: absolute;
  z-index: 1;
  animation: heartBeat 2s ease-in-out infinite;
}
.candy-deco-heart-1 { top: 5px; left: 50px; color: var(--candy-pink); }
.candy-deco-heart-2 { bottom: 0; right: 30px; color: var(--candy-peach-dark); animation-delay: 0.4s; }

/* ==================== XP PROGRESS BAR (CANDY STYLE) ==================== */

.candy-xp-wrap { max-width: 500px; }
.candy-xp-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.candy-xp-label span {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--candy-text);
}
.candy-xp-level {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, var(--candy-peach), var(--candy-pink-light));
  border-radius: var(--candy-radius-pill);
  padding: 3px 14px;
  font-size: 0.8rem;
  color: var(--candy-text);
  box-shadow: 0 2px 8px rgba(255, 105, 180, 0.2);
}
.candy-xp-track {
  height: 22px;
  background: linear-gradient(135deg, #FFF0F5, #FAE6F0);
  border-radius: var(--candy-radius-pill);
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
}
.candy-xp-fill {
  height: 100%;
  border-radius: var(--candy-radius-pill);
  background: linear-gradient(90deg, var(--candy-pink), var(--candy-peach), var(--candy-pink));
  background-size: 200% 100%;
  animation: candyXpFill 2s ease-out 0.5s both, candyShimmer 3s ease-in-out infinite 2.5s;
  position: relative;
}
.candy-xp-fill::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 10px;
  right: 10px;
  height: 6px;
  background: rgba(255,255,255,0.4);
  border-radius: var(--candy-radius-pill);
}
.candy-xp-hint {
  margin-top: 8px;
  font-size: 0.82rem;
  color: var(--candy-text-light);
  font-weight: 500;
}

/* ==================== SECTION COMMON ==================== */

.candy-section { padding: 90px 0; }
.candy-section-title {
  text-align: center;
  margin-bottom: 14px;
  font-size: 2.5rem;
  color: var(--candy-text);
  font-weight: 800;
}
.candy-section-subtitle {
  text-align: center;
  color: var(--candy-text-light);
  font-size: 1.1rem;
  margin-bottom: 52px;
  max-width: 580px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.7;
  font-weight: 500;
}

/* ==================== STATS BUBBLES ==================== */

.candy-stats { padding: 50px 0; }
.candy-stats-inner {
  display: flex;
  justify-content: center;
  gap: 28px;
  flex-wrap: wrap;
}
.candy-stat-bubble {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.candy-stat-bubble:hover { transform: scale(1.1) translateY(-5px); }
.candy-stat-bubble::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  padding: 3px;
  background: linear-gradient(135deg, var(--candy-pink), var(--candy-mint), var(--candy-lavender), var(--candy-peach));
  background-size: 300% 300%;
  animation: candyGradientBorder 4s ease infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
.candy-stat-bubble:nth-child(1) { background: linear-gradient(135deg, #FFF0F5, #FFE4EE); }
.candy-stat-bubble:nth-child(2) { background: linear-gradient(135deg, #F0FFF0, #E8FFE8); }
.candy-stat-bubble:nth-child(3) { background: linear-gradient(135deg, #F0F0FF, #E8E8FF); }
.candy-stat-bubble:nth-child(4) { background: linear-gradient(135deg, #FFF5E6, #FFEEDD); }
.candy-stat-bubble:nth-child(1) .candy-stat-num { color: var(--candy-pink); }
.candy-stat-bubble:nth-child(2) .candy-stat-num { color: var(--candy-mint-dark); }
.candy-stat-bubble:nth-child(3) .candy-stat-num { color: #9999DD; }
.candy-stat-bubble:nth-child(4) .candy-stat-num { color: var(--candy-peach-dark); }
.candy-stat-num {
  font-family: 'Baloo 2', cursive;
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1.1;
}
.candy-stat-label {
  font-size: 0.8rem;
  color: var(--candy-text-light);
  font-weight: 600;
  margin-top: 2px;
}

/* ==================== FEATURES GRID ==================== */

.candy-features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 28px;
}
.candy-feature-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: var(--candy-radius);
  padding: 36px;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  border: 1px solid rgba(255, 105, 180, 0.1);
}
.candy-feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: var(--candy-radius) var(--candy-radius) 0 0;
}
.candy-feature-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(255, 105, 180, 0.15);
}
.candy-feature-card--pink::before { background: linear-gradient(90deg, var(--candy-pink), var(--candy-peach)); }
.candy-feature-card--mint::before { background: linear-gradient(90deg, var(--candy-mint), var(--candy-blue)); }
.candy-feature-card--lavender::before { background: linear-gradient(90deg, var(--candy-lavender), var(--candy-pink-light)); }
.candy-feature-card--blue::before { background: linear-gradient(90deg, var(--candy-blue), var(--candy-mint)); }

/* Animated gradient border on featured card */
.candy-feature-card--featured {
  border: 3px solid transparent;
  background-clip: padding-box;
  position: relative;
}
.candy-feature-card--featured::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--candy-radius) + 3px);
  padding: 3px;
  background: linear-gradient(90deg, var(--candy-pink), var(--candy-mint), var(--candy-lavender), var(--candy-peach), var(--candy-pink));
  background-size: 300% 100%;
  animation: candyGradientBorder 4s ease infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  z-index: -1;
}

.candy-feature-icon {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}
.candy-feature-icon--pink { background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark)); color: #fff; }
.candy-feature-icon--mint { background: linear-gradient(135deg, var(--candy-mint), var(--candy-mint-dark)); color: var(--candy-text); }
.candy-feature-icon--lavender { background: linear-gradient(135deg, var(--candy-lavender), var(--candy-lavender-dark)); color: var(--candy-text); }
.candy-feature-icon--blue { background: linear-gradient(135deg, var(--candy-blue), var(--candy-blue-dark)); color: #fff; }

.candy-feature-card h3 {
  font-size: 1.25rem;
  margin-bottom: 10px;
  color: var(--candy-text);
  font-weight: 700;
}
.candy-feature-card p {
  color: var(--candy-text-light);
  line-height: 1.7;
  font-size: 0.95rem;
  font-weight: 500;
}
.candy-feature-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.7rem;
  padding: 4px 12px;
  border-radius: var(--candy-radius-pill);
  animation: candyWiggle 2s ease-in-out infinite;
}
.candy-badge-new {
  background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark));
  color: #fff;
  box-shadow: 0 2px 8px rgba(255, 105, 180, 0.3);
}
.candy-badge-popular {
  background: linear-gradient(135deg, var(--candy-peach), var(--candy-peach-dark));
  color: var(--candy-text);
  box-shadow: 0 2px 8px rgba(255, 218, 185, 0.4);
}

/* ==================== HOW IT WORKS ==================== */

.candy-how { position: relative; }
.candy-how-steps {
  display: flex;
  justify-content: center;
  gap: 48px;
  position: relative;
}
.candy-how-step {
  flex: 1;
  max-width: 300px;
  text-align: center;
  position: relative;
  z-index: 2;
}
.candy-how-number {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 1.6rem;
  margin: 0 auto 18px;
  color: #fff;
  position: relative;
  box-shadow: 0 6px 20px rgba(0,0,0,0.1);
}
.candy-how-step:nth-child(1) .candy-how-number { background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark)); }
.candy-how-step:nth-child(2) .candy-how-number { background: linear-gradient(135deg, var(--candy-mint), var(--candy-mint-dark)); color: var(--candy-text); }
.candy-how-step:nth-child(3) .candy-how-number { background: linear-gradient(135deg, var(--candy-blue), var(--candy-blue-dark)); }
.candy-how-path {
  position: absolute;
  top: 34px;
  left: 50%;
  transform: translateX(-50%);
  width: 55%;
  height: 4px;
  z-index: 1;
}
.candy-how-path-line {
  width: 100%;
  height: 100%;
  background: repeating-linear-gradient(
    90deg,
    var(--candy-pink-light) 0px,
    var(--candy-pink-light) 10px,
    transparent 10px,
    transparent 20px
  );
  border-radius: 2px;
}
.candy-how-step h3 {
  font-size: 1.15rem;
  margin-bottom: 10px;
  color: var(--candy-text);
  font-weight: 700;
}
.candy-how-step p {
  color: var(--candy-text-light);
  line-height: 1.7;
  font-size: 0.92rem;
  font-weight: 500;
}

/* ==================== PRICING ==================== */

.candy-pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  align-items: start;
}
.candy-pricing-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: var(--candy-radius);
  padding: 36px;
  text-align: center;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
}
.candy-pricing-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 40px rgba(255, 105, 180, 0.12);
}

/* Candy stripe top border */
.candy-pricing-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  background-size: 40px 40px;
  animation: candyStripe 1.5s linear infinite;
}
.candy-pricing-card--free::before {
  background: repeating-linear-gradient(
    45deg,
    var(--candy-mint) 0px,
    var(--candy-mint) 10px,
    #fff 10px,
    #fff 20px
  );
  background-size: 28px 28px;
  animation: candyStripe 1.5s linear infinite;
}
.candy-pricing-card--pro::before {
  background: repeating-linear-gradient(
    45deg,
    var(--candy-pink) 0px,
    var(--candy-pink) 10px,
    #fff 10px,
    #fff 20px
  );
  background-size: 28px 28px;
  animation: candyStripe 1.5s linear infinite;
}
.candy-pricing-card--team::before {
  background: repeating-linear-gradient(
    45deg,
    var(--candy-lavender) 0px,
    var(--candy-lavender) 10px,
    #fff 10px,
    #fff 20px
  );
  background-size: 28px 28px;
  animation: candyStripe 1.5s linear infinite;
}

.candy-pricing-card--pro {
  border: 3px solid transparent;
  transform: scale(1.05);
  box-shadow: 0 8px 32px rgba(255, 105, 180, 0.2);
  background-clip: padding-box;
}
.candy-pricing-card--pro::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: calc(var(--candy-radius) + 3px);
  padding: 3px;
  background: linear-gradient(135deg, var(--candy-pink), var(--candy-peach), var(--candy-pink-light), var(--candy-pink));
  background-size: 300% 300%;
  animation: candyGradientBorder 3s ease infinite;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  z-index: -1;
}
.candy-pricing-card--pro:hover {
  transform: scale(1.05) translateY(-6px);
  box-shadow: 0 16px 50px rgba(255, 105, 180, 0.28);
}

.candy-pricing-crown {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, var(--candy-peach), var(--candy-pink-light));
  border-radius: var(--candy-radius-pill);
  padding: 5px 18px;
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.72rem;
  color: var(--candy-text);
  display: flex;
  align-items: center;
  gap: 5px;
  animation: candyWiggle 2.5s ease-in-out infinite;
  box-shadow: 0 3px 10px rgba(255, 105, 180, 0.2);
  z-index: 5;
}
.candy-pricing-name {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 1.2rem;
  color: var(--candy-text);
  margin-bottom: 8px;
  margin-top: 12px;
}
.candy-pricing-price {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 3rem;
  line-height: 1.1;
}
.candy-pricing-card--free .candy-pricing-price { color: var(--candy-mint-dark); }
.candy-pricing-card--pro .candy-pricing-price { color: var(--candy-pink); }
.candy-pricing-card--team .candy-pricing-price { color: #9999DD; }
.candy-pricing-price span {
  font-size: 1rem;
  font-weight: 500;
  color: var(--candy-text-light);
}
.candy-pricing-features {
  list-style: none;
  margin: 24px 0;
  text-align: left;
}
.candy-pricing-features li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  font-size: 0.9rem;
  color: var(--candy-text);
  font-weight: 500;
  border-bottom: 1px dashed rgba(255, 105, 180, 0.15);
}
.candy-pricing-features li:last-child { border-bottom: none; }
.candy-pricing-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.candy-pricing-check--mint { background: linear-gradient(135deg, var(--candy-mint), var(--candy-mint-dark)); color: var(--candy-text); }
.candy-pricing-check--pink { background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark)); color: #fff; }
.candy-pricing-check--lavender { background: linear-gradient(135deg, var(--candy-lavender), var(--candy-lavender-dark)); color: var(--candy-text); }
.candy-pricing-free-badge {
  display: inline-block;
  background: linear-gradient(135deg, var(--candy-mint), var(--candy-mint-dark));
  color: var(--candy-text);
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.7rem;
  padding: 3px 12px;
  border-radius: var(--candy-radius-pill);
  margin-bottom: 8px;
}

/* ==================== TESTIMONIALS (SPEECH BUBBLES) ==================== */

.candy-testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}
.candy-testimonial-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-radius: var(--candy-radius);
  padding: 30px;
  position: relative;
  margin-bottom: 28px;
  transition: all 0.35s ease;
  box-shadow: 0 4px 24px rgba(0,0,0,0.05);
  border: 1px solid rgba(255, 105, 180, 0.08);
}
.candy-testimonial-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 36px rgba(255, 105, 180, 0.12);
}
/* Speech bubble pointer */
.candy-testimonial-card::after {
  content: '';
  position: absolute;
  bottom: -16px;
  left: 40px;
  width: 32px;
  height: 16px;
  background: rgba(255, 255, 255, 0.9);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.candy-testimonial-card:nth-child(1)::after { filter: drop-shadow(0 4px 4px rgba(255, 105, 180, 0.08)); }
.candy-testimonial-card:nth-child(2)::after { filter: drop-shadow(0 4px 4px rgba(152, 255, 152, 0.08)); }
.candy-testimonial-card:nth-child(3)::after { filter: drop-shadow(0 4px 4px rgba(135, 206, 235, 0.08)); }

.candy-testimonial-stars {
  display: flex;
  gap: 3px;
  margin-bottom: 14px;
  color: var(--candy-peach-dark);
}
.candy-testimonial-text {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--candy-text);
  margin-bottom: 18px;
  font-style: italic;
  font-weight: 500;
}
.candy-testimonial-author {
  display: flex;
  align-items: center;
  gap: 12px;
}
.candy-testimonial-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.85rem;
  color: #fff;
  box-shadow: 0 3px 10px rgba(0,0,0,0.1);
}
.candy-testimonial-card:nth-child(1) .candy-testimonial-avatar { background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark)); }
.candy-testimonial-card:nth-child(2) .candy-testimonial-avatar { background: linear-gradient(135deg, var(--candy-mint), var(--candy-mint-dark)); color: var(--candy-text); }
.candy-testimonial-card:nth-child(3) .candy-testimonial-avatar { background: linear-gradient(135deg, var(--candy-blue), var(--candy-blue-dark)); }
.candy-testimonial-name {
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--candy-text);
}
.candy-testimonial-role {
  font-size: 0.8rem;
  color: var(--candy-text-light);
  font-weight: 500;
}

/* ==================== CTA SECTION ==================== */

.candy-cta { padding: 80px 0; }
.candy-cta-box {
  background: linear-gradient(135deg, var(--candy-pink), #FF1493, var(--candy-pink-dark));
  border-radius: 28px;
  padding: 64px 44px;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 16px 50px rgba(255, 105, 180, 0.3);
}
.candy-cta-box h2 {
  font-size: 2.5rem;
  color: #fff;
  margin-bottom: 16px;
  position: relative;
  z-index: 2;
  font-weight: 800;
}
.candy-cta-box p {
  color: rgba(255,255,255,0.85);
  font-size: 1.1rem;
  margin-bottom: 36px;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 2;
  line-height: 1.7;
  font-weight: 500;
}
.candy-cta-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  position: relative;
  z-index: 2;
  flex-wrap: wrap;
}
.candy-cta-btn-white {
  background: #fff;
  color: var(--candy-pink);
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
}
.candy-cta-btn-white:hover {
  box-shadow: 0 10px 30px rgba(0,0,0,0.18);
  background: #fff;
}
.candy-cta-btn-outline-white {
  background: transparent;
  color: #fff;
  border: 2px solid rgba(255,255,255,0.6);
}
.candy-cta-btn-outline-white:hover {
  background: rgba(255,255,255,0.12);
  border-color: #fff;
}

/* CTA decorative elements */
.candy-cta-deco {
  position: absolute;
  border-radius: 50%;
  opacity: 0.12;
}
.candy-cta-deco-1 { width: 220px; height: 220px; background: #fff; top: -70px; right: -50px; }
.candy-cta-deco-2 { width: 160px; height: 160px; background: var(--candy-peach); bottom: -60px; left: -40px; }
.candy-cta-deco-3 { width: 90px; height: 90px; background: var(--candy-mint); top: 40px; left: 70px; }
.candy-cta-deco-4 { width: 60px; height: 60px; background: #fff; bottom: 30px; right: 90px; animation: candyPulse 3s ease-in-out infinite; }

/* ==================== FOOTER ==================== */

.candy-footer {
  padding: 52px 0 36px;
  background: linear-gradient(180deg, transparent, #FFF0F5);
  border-top: 2px solid rgba(255, 105, 180, 0.1);
}
.candy-footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 40px;
  flex-wrap: wrap;
}
.candy-footer-brand { max-width: 300px; }
.candy-footer-brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  text-decoration: none;
}
.candy-footer-brand-logo img { height: 38px; width: auto; }
.candy-footer-brand-logo span {
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  font-size: 1.3rem;
  background: linear-gradient(135deg, var(--candy-pink), var(--candy-pink-dark));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.candy-footer-brand p {
  color: var(--candy-text-light);
  font-size: 0.85rem;
  line-height: 1.7;
  font-weight: 500;
}
.candy-footer-col h4 {
  font-family: 'Baloo 2', cursive;
  font-size: 1rem;
  color: var(--candy-text);
  margin-bottom: 14px;
  font-weight: 700;
}
.candy-footer-col a {
  display: block;
  color: var(--candy-text-light);
  text-decoration: none;
  font-size: 0.85rem;
  margin-bottom: 8px;
  transition: color 0.25s;
  font-weight: 500;
}
.candy-footer-col a:hover { color: var(--candy-pink); }
.candy-footer-bottom {
  text-align: center;
  margin-top: 44px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 105, 180, 0.12);
  color: var(--candy-text-light);
  font-size: 0.8rem;
  font-weight: 500;
}
.candy-footer-bottom-heart { color: var(--candy-pink); display: inline-block; animation: heartBeat 1.5s ease-in-out infinite; }

/* ==================== MOBILE MENU ==================== */

.candy-mobile-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  flex-direction: column;
  gap: 5px;
}
.candy-mobile-toggle span {
  display: block;
  width: 26px;
  height: 3px;
  background: var(--candy-pink);
  border-radius: 2px;
  transition: all 0.3s;
}
.candy-mobile-toggle.open span:nth-child(1) { transform: translateY(8px) rotate(45deg); }
.candy-mobile-toggle.open span:nth-child(2) { opacity: 0; }
.candy-mobile-toggle.open span:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }

.candy-mobile-menu { display: none; }

/* ==================== RESPONSIVE ==================== */

@media (max-width: 1024px) {
  .candy-hero-text h1 { font-size: 2.9rem; }
  .candy-hero-logo-wrap img { width: 230px; }
  .candy-features-grid { gap: 22px; }
  .candy-stat-bubble { width: 130px; height: 130px; }
  .candy-stat-num { font-size: 1.4rem; }
}

@media (max-width: 768px) {
  .candy-nav-links, .candy-nav-auth { display: none; }
  .candy-mobile-toggle { display: flex; }
  .candy-mobile-menu {
    display: none;
    position: absolute;
    top: 72px;
    left: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 2px solid rgba(255, 105, 180, 0.15);
    padding: 24px;
    z-index: 99;
    box-shadow: 0 12px 30px rgba(255, 105, 180, 0.1);
  }
  .candy-mobile-menu.open { display: block; }
  .candy-mobile-menu a {
    display: block;
    padding: 14px 0;
    font-weight: 600;
    color: var(--candy-text);
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 105, 180, 0.1);
    transition: color 0.2s;
  }
  .candy-mobile-menu a:last-child { border-bottom: none; }
  .candy-mobile-menu a:hover { color: var(--candy-pink); }
  .candy-mobile-menu-auth {
    display: flex;
    gap: 12px;
    margin-top: 18px;
    padding-top: 18px;
    border-top: 2px solid rgba(255, 105, 180, 0.12);
  }

  .candy-hero { padding: 60px 0 50px; }
  .candy-hero-inner { flex-direction: column-reverse; text-align: center; gap: 36px; }
  .candy-hero-text h1 { font-size: 2.3rem; }
  .candy-hero-text p { margin: 0 auto 28px; }
  .candy-hero-ctas { justify-content: center; }
  .candy-hero-logo-wrap img { width: 190px; }

  .candy-features-grid { grid-template-columns: 1fr; }
  .candy-how-steps { flex-direction: column; align-items: center; gap: 36px; }
  .candy-how-path { display: none; }
  .candy-pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
  .candy-pricing-card--pro { transform: none; }
  .candy-pricing-card--pro:hover { transform: translateY(-6px); }
  .candy-testimonials-grid { grid-template-columns: 1fr; max-width: 460px; margin: 0 auto; }
  .candy-xp-wrap { margin: 0 auto; }
  .candy-section-title { font-size: 2rem; }
  .candy-footer-inner { flex-direction: column; text-align: center; align-items: center; }
  .candy-footer-brand { text-align: center; }
  .candy-stats-inner { gap: 16px; }
  .candy-stat-bubble { width: 120px; height: 120px; }
  .candy-stat-num { font-size: 1.25rem; }
  .candy-cta-box { padding: 44px 24px; }
  .candy-cta-box h2 { font-size: 1.9rem; }
  .candy-section { padding: 60px 0; }

  .candy-confetti-dot:nth-child(n+8) { display: none; }
  .candy-bubble { display: none; }
}

@media (max-width: 480px) {
  .candy-hero-text h1 { font-size: 1.85rem; }
  .candy-hero-ctas { flex-direction: column; align-items: center; }
  .candy-stats-inner { gap: 10px; }
  .candy-stat-bubble { width: 100px; height: 100px; }
  .candy-stat-num { font-size: 1.1rem; }
  .candy-stat-label { font-size: 0.7rem; }
  .candy-cta-buttons { flex-direction: column; align-items: center; }
  .candy-pricing-grid { max-width: 100%; }
  .candy-section-title { font-size: 1.7rem; }
  .candy-section-subtitle { font-size: 0.95rem; }
  .candy-confetti-dot:nth-child(n+5) { display: none; }
}
`;

const LandingDesign6: React.FC = () => {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [xpCount, setXpCount] = useState(0);
  const revealRefs = useRef<(HTMLElement | null)[]>([]);

  const addRevealRef = useCallback((el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  }, []);

  // Feature flag check
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

  // XP counter animation
  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const target = 1480;
    const duration = 2000;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setXpCount(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, 800);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, []);

  // Scroll reveal with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('candy-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    const currentRefs = revealRefs.current;
    currentRefs.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      currentRefs.forEach((el) => {
        if (el) observer.unobserve(el);
      });
    };
  }, []);

  const features = [
    { icon: <Brain size={24} />, title: 'AI-Powered Quizzes', desc: 'Upload any document and watch our AI instantly create interactive quizzes tailored to your material. Study smarter, not harder.', color: 'pink' as const, badge: null, featured: false },
    { icon: <Zap size={24} />, title: 'Smart Flashcards', desc: 'Auto-generated flashcards with spaced repetition. Our algorithm ensures you review at the perfect moment for long-term memory.', color: 'mint' as const, badge: 'POPULAR', featured: true },
    { icon: <Target size={24} />, title: 'AI Tutor Chat', desc: 'Ask questions, get explanations, and dive deeper into any topic. Your personal tutor available 24/7, always patient and helpful.', color: 'lavender' as const, badge: 'NEW', featured: false },
    { icon: <Users size={24} />, title: 'Share & Compete', desc: 'Send quizzes and flashcards to friends. Challenge classmates and climb the leaderboard together. Learning is better with friends.', color: 'blue' as const, badge: null, featured: false },
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
    if (variant === 'free') return 'mint';
    if (variant === 'pro') return 'pink';
    return 'lavender';
  };

  return (
    <div className="candy-landing">
      <style>{STYLES}</style>

      {/* Confetti / bubble background */}
      <div className="candy-confetti">
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-confetti-dot" />
        <div className="candy-bubble" />
        <div className="candy-bubble" />
        <div className="candy-bubble" />
        <div className="candy-bubble" />
      </div>

      {/* Navigation */}
      <nav className="candy-nav">
        <div className="candy-container candy-nav-inner">
          <a href="#" className="candy-nav-logo">
            <img src={BrainLiftLogo} alt="BrainLift Logo" />
            <span>BrainLift</span>
          </a>
          <ul className="candy-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#testimonials">Reviews</a></li>
          </ul>
          <div className="candy-nav-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="candy-btn candy-btn-outline candy-btn-sm">Log In</Link>
                <Link to="/auth/register" className="candy-btn candy-btn-pink candy-btn-sm">Sign Up Free</Link>
              </>
            ) : (
              <>
                <span className="candy-btn candy-btn-outline candy-btn-sm candy-btn-disabled"><Lock size={14} /> Log In</span>
                <span className="candy-btn candy-btn-pink candy-btn-sm candy-btn-disabled"><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
          <button
            className={`candy-mobile-toggle ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
        <div className={`candy-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
          <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
          <div className="candy-mobile-menu-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="candy-btn candy-btn-outline candy-btn-sm" style={{ flex: 1 }}>Log In</Link>
                <Link to="/auth/register" className="candy-btn candy-btn-pink candy-btn-sm" style={{ flex: 1 }}>Sign Up Free</Link>
              </>
            ) : (
              <>
                <span className="candy-btn candy-btn-outline candy-btn-sm candy-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Log In</span>
                <span className="candy-btn candy-btn-pink candy-btn-sm candy-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="candy-hero">
        <div className="candy-container candy-hero-inner">
          <div className="candy-hero-text">
            <h1>
              Make studying<br />
              <span className="candy-highlight">sweet & simple</span>
            </h1>
            <p>
              Transform any document into quizzes, flashcards, and study materials
              with AI. Earn XP, track progress, and make studying feel like a treat.
            </p>
            <div className="candy-hero-ctas">
              {isWebLoginEnabled ? (
                <>
                  <Link to="/auth/register" className="candy-btn candy-btn-pink candy-btn-lg">
                    Start Learning Free <ArrowRight size={18} />
                  </Link>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="candy-btn candy-btn-outline candy-btn-lg">
                    Get the App
                  </a>
                </>
              ) : (
                <>
                  <span className="candy-btn candy-btn-pink candy-btn-lg candy-btn-disabled">
                    <Lock size={18} /> Coming Soon
                  </span>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="candy-btn candy-btn-outline candy-btn-lg">
                    Get the App
                  </a>
                </>
              )}
            </div>
            <div className="candy-xp-wrap">
              <div className="candy-xp-label">
                <span>
                  <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {xpCount.toLocaleString()} XP
                </span>
                <span className="candy-xp-level">
                  <Crown size={12} /> Level 0
                </span>
              </div>
              <div className="candy-xp-track">
                <div className="candy-xp-fill" />
              </div>
              <p className="candy-xp-hint">You are at Level 0 -- Start your sweet learning journey!</p>
            </div>
          </div>
          <div className="candy-hero-visual">
            <div className="candy-hero-logo-wrap">
              <img src={BrainLiftLogo} alt="BrainLift brain mascot" />
              <div className="candy-deco candy-deco-1" />
              <div className="candy-deco candy-deco-2" />
              <div className="candy-deco candy-deco-3" />
              <div className="candy-deco candy-deco-4" />
              <div className="candy-deco-heart candy-deco-heart-1"><Heart size={24} fill="currentColor" /></div>
              <div className="candy-deco-heart candy-deco-heart-2"><Heart size={18} fill="currentColor" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="candy-stats" ref={addRevealRef}>
        <div className="candy-container candy-stats-inner candy-reveal">
          {stats.map((stat, i) => (
            <div className="candy-stat-bubble" key={i}>
              <span className="candy-stat-num">{stat.num}</span>
              <span className="candy-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="candy-section" id="features">
        <div className="candy-container">
          <div className="candy-reveal" ref={addRevealRef}>
            <h2 className="candy-section-title">Everything you need to ace it</h2>
            <p className="candy-section-subtitle">
              Powerful AI tools wrapped in a sweet, delightful experience. Learning has never tasted this good.
            </p>
          </div>
          <div className="candy-features-grid">
            {features.map((feat, i) => (
              <div
                className={`candy-feature-card candy-feature-card--${feat.color} ${feat.featured ? 'candy-feature-card--featured' : ''} candy-reveal`}
                key={i}
                ref={addRevealRef}
              >
                {feat.badge && (
                  <span className={`candy-feature-badge ${feat.badge === 'NEW' ? 'candy-badge-new' : 'candy-badge-popular'}`}>
                    {feat.badge === 'NEW' ? <Sparkles size={10} /> : <Star size={10} />}
                    {' '}{feat.badge}
                  </span>
                )}
                <div className={`candy-feature-icon candy-feature-icon--${feat.color}`}>{feat.icon}</div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="candy-section candy-how" id="how-it-works">
        <div className="candy-container">
          <div className="candy-reveal" ref={addRevealRef}>
            <h2 className="candy-section-title">How it works</h2>
            <p className="candy-section-subtitle">
              Three simple steps to transform any material into your personal study companion.
            </p>
          </div>
          <div className="candy-how-steps candy-reveal" ref={addRevealRef}>
            <div className="candy-how-path"><div className="candy-how-path-line" /></div>
            {steps.map((step, i) => (
              <div className="candy-how-step" key={i}>
                <div className="candy-how-number">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="candy-section" id="pricing">
        <div className="candy-container">
          <div className="candy-reveal" ref={addRevealRef}>
            <h2 className="candy-section-title">Pick your flavor</h2>
            <p className="candy-section-subtitle">
              Start free and upgrade when you are ready. No credit card required.
            </p>
          </div>
          <div className="candy-pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div
                className={`candy-pricing-card candy-pricing-card--${plan.variant} candy-reveal`}
                key={i}
                ref={addRevealRef}
              >
                {plan.variant === 'pro' && (
                  <div className="candy-pricing-crown"><Crown size={14} /> MOST POPULAR</div>
                )}
                {plan.variant === 'free' && <span className="candy-pricing-free-badge">FREE FOREVER</span>}
                <div className="candy-pricing-name">{plan.name}</div>
                <div className="candy-pricing-price">
                  {plan.price}
                  {plan.period && <span>{plan.period}</span>}
                </div>
                <ul className="candy-pricing-features">
                  {plan.features.map((feat, j) => (
                    <li key={j}>
                      <span className={`candy-pricing-check candy-pricing-check--${checkColor(plan.variant)}`}>
                        <Check size={13} />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                {isWebLoginEnabled ? (
                  <Link
                    to="/auth/register"
                    className={`candy-btn ${plan.variant === 'pro' ? 'candy-btn-pink' : plan.variant === 'team' ? 'candy-btn-lavender' : 'candy-btn-mint'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {plan.variant === 'free' ? 'Get Started' : plan.variant === 'pro' ? 'Go Pro' : 'Contact Us'}
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <span
                    className={`candy-btn ${plan.variant === 'pro' ? 'candy-btn-pink' : plan.variant === 'team' ? 'candy-btn-lavender' : 'candy-btn-mint'} candy-btn-disabled`}
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

      {/* Testimonials */}
      <section className="candy-section" id="testimonials">
        <div className="candy-container">
          <div className="candy-reveal" ref={addRevealRef}>
            <h2 className="candy-section-title">Loved by learners everywhere</h2>
            <p className="candy-section-subtitle">
              Join thousands of students and educators who are sweetening their study game.
            </p>
          </div>
          <div className="candy-testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="candy-testimonial-card candy-reveal" key={i} ref={addRevealRef}>
                <div className="candy-testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="candy-testimonial-text">&ldquo;{t.text}&rdquo;</p>
                <div className="candy-testimonial-author">
                  <div className="candy-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="candy-testimonial-name">{t.name}</div>
                    <div className="candy-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="candy-cta">
        <div className="candy-container">
          <div className="candy-cta-box candy-reveal" ref={addRevealRef}>
            <div className="candy-cta-deco candy-cta-deco-1" />
            <div className="candy-cta-deco candy-cta-deco-2" />
            <div className="candy-cta-deco candy-cta-deco-3" />
            <div className="candy-cta-deco candy-cta-deco-4" />
            <h2>Ready to sweeten your study routine?</h2>
            <p>
              Join 10,000+ learners who are already acing their exams with BrainLift.
              It is free to start -- no credit card needed.
            </p>
            <div className="candy-cta-buttons">
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="candy-btn candy-cta-btn-white candy-btn-lg">
                  Create Free Account <ArrowRight size={18} />
                </Link>
              ) : (
                <span className="candy-btn candy-cta-btn-white candy-btn-lg candy-btn-disabled">
                  <Lock size={18} /> Coming Soon
                </span>
              )}
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="candy-btn candy-cta-btn-outline-white candy-btn-lg">
                Download App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="candy-footer">
        <div className="candy-container">
          <div className="candy-footer-inner">
            <div className="candy-footer-brand">
              <a href="#" className="candy-footer-brand-logo">
                <img src={BrainLiftLogo} alt="BrainLift" />
                <span>BrainLift</span>
              </a>
              <p>
                Making studying feel like a treat. Upload your materials, let AI do the heavy lifting, and
                level up your knowledge every day.
              </p>
            </div>
            <div className="candy-footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#testimonials">Reviews</a>
            </div>
            <div className="candy-footer-col">
              <h4>Download</h4>
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer">iOS App</a>
              <a href="https://play.google.com/store/apps/details?id=com.brainlift.app" target="_blank" rel="noopener noreferrer">Android App</a>
            </div>
            <div className="candy-footer-col">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
            </div>
          </div>
          <div className="candy-footer-bottom">
            &copy; {new Date().getFullYear()} BrainLift. All rights reserved. Made with{' '}
            <span className="candy-footer-bottom-heart"><Heart size={12} fill="currentColor" /></span>
            {' '}for learners everywhere.
          </div>
        </div>
      </footer>
      <DesignSwitcher />
    </div>
  );
};

export default LandingDesign6;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { featureFlagsService } from '@/services/featureFlags.service';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';
import { Lock, ArrowRight, Star, Check, Zap, Brain, Target, Users, Sparkles, Gamepad2, Trophy } from 'lucide-react';
import { DesignSwitcher } from '@/components/DesignSwitcher';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');

:root {
  --arc-bg: #0D0D0D;
  --arc-bg-card: #1A1A2E;
  --arc-green: #39FF14;
  --arc-blue: #00D4FF;
  --arc-magenta: #FF0080;
  --arc-yellow: #FFE100;
  --arc-text: #E0E0E0;
  --arc-text-dim: #888888;
  --arc-border: #333333;
  --arc-glow-green: 0 0 8px rgba(57, 255, 20, 0.5), 0 0 20px rgba(57, 255, 20, 0.2);
  --arc-glow-blue: 0 0 8px rgba(0, 212, 255, 0.5), 0 0 20px rgba(0, 212, 255, 0.2);
  --arc-glow-magenta: 0 0 8px rgba(255, 0, 128, 0.5), 0 0 20px rgba(255, 0, 128, 0.2);
  --arc-glow-yellow: 0 0 8px rgba(255, 225, 0, 0.5), 0 0 20px rgba(255, 225, 0, 0.2);
}

@keyframes arcBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes arcPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
@keyframes arcFadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes arcXpFill {
  from { width: 0%; }
  to { width: 65%; }
}
@keyframes arcFlicker {
  0%, 95%, 100% { opacity: 1; }
  96% { opacity: 0.6; }
  97% { opacity: 1; }
  98% { opacity: 0.4; }
}
@keyframes arcGlitch {
  0%, 90%, 100% { transform: translate(0); }
  92% { transform: translate(-2px, 1px); }
  94% { transform: translate(2px, -1px); }
  96% { transform: translate(-1px, 2px); }
  98% { transform: translate(1px, -2px); }
}
@keyframes arcScanline {
  0% { top: -100%; }
  100% { top: 100%; }
}
@keyframes arcFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes arcCursorBlink {
  0%, 49% { border-right-color: var(--arc-green); }
  50%, 100% { border-right-color: transparent; }
}
@keyframes arcPixelExpand {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* ==================== GLOBAL & SCANLINE ==================== */

.arcade-landing * { box-sizing: border-box; margin: 0; padding: 0; }
.arcade-landing {
  font-family: 'VT323', monospace;
  background: var(--arc-bg);
  color: var(--arc-text);
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
  image-rendering: auto;
}

.arcade-landing::before {
  content: '';
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
  pointer-events: none;
  z-index: 1000;
}

.arcade-landing::after {
  content: '';
  position: fixed;
  top: -100%;
  left: 0;
  width: 100%;
  height: 60px;
  background: linear-gradient(
    180deg,
    rgba(57, 255, 20, 0) 0%,
    rgba(57, 255, 20, 0.04) 50%,
    rgba(57, 255, 20, 0) 100%
  );
  animation: arcScanline 6s linear infinite;
  pointer-events: none;
  z-index: 1001;
}

.arcade-landing h1,
.arcade-landing h2,
.arcade-landing h3,
.arcade-landing h4 {
  font-family: 'Press Start 2P', monospace;
  line-height: 1.6;
}

.arc-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

/* ==================== PIXEL BORDER UTIL ==================== */
.arc-pixel-border {
  box-shadow:
    inset -4px -4px 0px 0px #111,
    inset 4px 4px 0px 0px #444,
    0 0 0 4px var(--arc-border);
}
.arc-pixel-border-green {
  box-shadow:
    inset -4px -4px 0px 0px rgba(57,255,20,0.1),
    inset 4px 4px 0px 0px rgba(57,255,20,0.3),
    0 0 0 4px var(--arc-green),
    var(--arc-glow-green);
}
.arc-pixel-border-blue {
  box-shadow:
    inset -4px -4px 0px 0px rgba(0,212,255,0.1),
    inset 4px 4px 0px 0px rgba(0,212,255,0.3),
    0 0 0 4px var(--arc-blue),
    var(--arc-glow-blue);
}
.arc-pixel-border-magenta {
  box-shadow:
    inset -4px -4px 0px 0px rgba(255,0,128,0.1),
    inset 4px 4px 0px 0px rgba(255,0,128,0.3),
    0 0 0 4px var(--arc-magenta),
    var(--arc-glow-magenta);
}
.arc-pixel-border-yellow {
  box-shadow:
    inset -4px -4px 0px 0px rgba(255,225,0,0.1),
    inset 4px 4px 0px 0px rgba(255,225,0,0.3),
    0 0 0 4px var(--arc-yellow),
    var(--arc-glow-yellow);
}

/* ==================== NAV ==================== */
.arc-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: linear-gradient(180deg, #1A1A2E 0%, #0D0D0D 100%);
  border-bottom: 4px solid var(--arc-green);
  box-shadow: 0 4px 20px rgba(57, 255, 20, 0.15);
}
.arc-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}
.arc-nav-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}
.arc-nav-logo img {
  height: 44px;
  width: auto;
  animation: arcFloat 2.5s ease-in-out infinite;
  filter: drop-shadow(0 0 6px rgba(57, 255, 20, 0.4));
}
.arc-nav-logo span {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.85rem;
  color: var(--arc-green);
  text-shadow: var(--arc-glow-green);
}
.arc-nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
  list-style: none;
}
.arc-nav-links a {
  text-decoration: none;
  font-family: 'VT323', monospace;
  font-size: 1.2rem;
  color: var(--arc-text-dim);
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.arc-nav-links a:hover {
  color: var(--arc-green);
  text-shadow: var(--arc-glow-green);
}
.arc-nav-auth { display: flex; align-items: center; gap: 12px; }

/* ==================== BUTTONS ==================== */
.arc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.65rem;
  padding: 12px 20px;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 1px;
  position: relative;
  image-rendering: pixelated;
}
.arc-btn:hover { transform: translateY(-2px); }
.arc-btn:active { transform: translateY(1px); }

.arc-btn-green {
  background: var(--arc-green);
  color: #0D0D0D;
  box-shadow:
    0 4px 0 #1B8A0A,
    var(--arc-glow-green);
}
.arc-btn-green:hover {
  box-shadow:
    0 6px 0 #1B8A0A,
    0 0 16px rgba(57, 255, 20, 0.5);
}
.arc-btn-magenta {
  background: var(--arc-magenta);
  color: #fff;
  box-shadow:
    0 4px 0 #99004D,
    var(--arc-glow-magenta);
}
.arc-btn-magenta:hover {
  box-shadow:
    0 6px 0 #99004D,
    0 0 16px rgba(255, 0, 128, 0.5);
}
.arc-btn-blue {
  background: var(--arc-blue);
  color: #0D0D0D;
  box-shadow:
    0 4px 0 #007A99,
    var(--arc-glow-blue);
}
.arc-btn-yellow {
  background: var(--arc-yellow);
  color: #0D0D0D;
  box-shadow:
    0 4px 0 #998600,
    var(--arc-glow-yellow);
}
.arc-btn-outline {
  background: transparent;
  color: var(--arc-green);
  border: 2px solid var(--arc-green);
  box-shadow: none;
}
.arc-btn-outline:hover {
  background: rgba(57, 255, 20, 0.1);
  box-shadow: var(--arc-glow-green);
}
.arc-btn-disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.arc-btn-sm { padding: 8px 14px; font-size: 0.55rem; }
.arc-btn-lg { padding: 16px 28px; font-size: 0.7rem; }

.arc-btn-insert-coin::after {
  content: '|';
  animation: arcBlink 0.8s step-end infinite;
  margin-left: 4px;
  font-weight: bold;
}

/* ==================== HERO ==================== */
.arc-hero {
  padding: 80px 0 60px;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(57, 255, 20, 0.04) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 30%, rgba(0, 212, 255, 0.03) 0%, transparent 60%);
}
.arc-hero-inner {
  display: flex;
  align-items: center;
  gap: 60px;
}
.arc-hero-text {
  flex: 1;
  animation: arcFadeInUp 0.7s ease-out;
}
.arc-hero-press-start {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.7rem;
  color: var(--arc-magenta);
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-bottom: 20px;
  animation: arcPulse 1.5s ease-in-out infinite;
  text-shadow: var(--arc-glow-magenta);
}
.arc-hero-text h1 {
  font-size: 1.8rem;
  color: var(--arc-green);
  margin-bottom: 24px;
  text-shadow: var(--arc-glow-green);
  animation: arcFlicker 4s linear infinite;
}
.arc-hero-text h1 .arc-highlight {
  color: var(--arc-yellow);
  text-shadow: var(--arc-glow-yellow);
}
.arc-hero-text p {
  font-size: 1.5rem;
  color: var(--arc-text-dim);
  line-height: 1.6;
  margin-bottom: 32px;
  max-width: 520px;
}
.arc-hero-ctas { display: flex; gap: 16px; margin-bottom: 40px; flex-wrap: wrap; }
.arc-hero-visual {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: arcFadeInUp 0.7s ease-out 0.2s both;
}
.arc-hero-logo-wrap {
  position: relative;
  z-index: 2;
}
.arc-hero-logo-wrap img {
  width: 280px;
  height: auto;
  animation: arcFloat 2.5s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(57, 255, 20, 0.3));
}
.arc-hero-glow-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 320px;
  height: 320px;
  border-radius: 50%;
  border: 2px solid rgba(57, 255, 20, 0.2);
  box-shadow: var(--arc-glow-green);
  animation: arcPulse 3s ease-in-out infinite;
}
.arc-hero-pixel-deco {
  position: absolute;
  width: 12px;
  height: 12px;
  z-index: 1;
}
.arc-hero-pixel-deco--1 {
  background: var(--arc-green);
  top: 10%;
  right: 10%;
  box-shadow: var(--arc-glow-green);
  animation: arcPulse 2s ease-in-out infinite;
}
.arc-hero-pixel-deco--2 {
  background: var(--arc-magenta);
  bottom: 20%;
  left: 5%;
  box-shadow: var(--arc-glow-magenta);
  animation: arcPulse 2.5s ease-in-out infinite 0.5s;
}
.arc-hero-pixel-deco--3 {
  background: var(--arc-blue);
  top: 30%;
  left: 15%;
  width: 8px;
  height: 8px;
  box-shadow: var(--arc-glow-blue);
  animation: arcPulse 2.2s ease-in-out infinite 1s;
}
.arc-hero-pixel-deco--4 {
  background: var(--arc-yellow);
  bottom: 10%;
  right: 20%;
  width: 10px;
  height: 10px;
  box-shadow: var(--arc-glow-yellow);
  animation: arcPulse 1.8s ease-in-out infinite 0.3s;
}

/* ==================== PIXEL XP BAR ==================== */
.arc-xp-wrap { max-width: 480px; }
.arc-xp-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.arc-xp-label span {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  color: var(--arc-green);
  text-shadow: var(--arc-glow-green);
}
.arc-xp-level {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 225, 0, 0.15);
  border: 2px solid var(--arc-yellow);
  padding: 4px 12px;
  font-size: 0.55rem;
  color: var(--arc-yellow);
  text-shadow: var(--arc-glow-yellow);
}
.arc-xp-track {
  height: 24px;
  background: #1A1A2E;
  border: 3px solid var(--arc-green);
  overflow: hidden;
  position: relative;
  display: flex;
  gap: 2px;
  padding: 3px;
}
.arc-xp-segment {
  flex: 1;
  background: #222;
  transition: background 0.3s;
}
.arc-xp-segment.filled {
  background: var(--arc-green);
  box-shadow: 0 0 4px rgba(57, 255, 20, 0.5);
}
.arc-xp-hint {
  margin-top: 8px;
  font-size: 1.1rem;
  color: var(--arc-text-dim);
}

/* ==================== SECTION COMMON ==================== */
.arc-section { padding: 80px 0; }
.arc-section-label {
  text-align: center;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  color: var(--arc-magenta);
  text-transform: uppercase;
  letter-spacing: 4px;
  margin-bottom: 16px;
  text-shadow: var(--arc-glow-magenta);
}
.arc-section-title {
  text-align: center;
  font-size: 1.3rem;
  color: var(--arc-green);
  margin-bottom: 12px;
  text-shadow: var(--arc-glow-green);
}
.arc-section-subtitle {
  text-align: center;
  color: var(--arc-text-dim);
  font-size: 1.3rem;
  margin-bottom: 48px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}
.arc-divider {
  width: 120px;
  height: 4px;
  margin: 0 auto 48px;
  background: repeating-linear-gradient(
    90deg,
    var(--arc-green) 0px,
    var(--arc-green) 8px,
    transparent 8px,
    transparent 12px
  );
}

/* ==================== HIGH SCORE / STATS ==================== */
.arc-stats { padding: 48px 0; }
.arc-stats-board {
  max-width: 700px;
  margin: 0 auto;
  background: var(--arc-bg-card);
  border: 4px solid var(--arc-green);
  box-shadow: var(--arc-glow-green);
  padding: 32px;
}
.arc-stats-title {
  text-align: center;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.85rem;
  color: var(--arc-yellow);
  text-shadow: var(--arc-glow-yellow);
  margin-bottom: 28px;
  animation: arcPulse 2s ease-in-out infinite;
}
.arc-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.arc-stat-item {
  text-align: center;
  padding: 16px 8px;
  border: 2px solid var(--arc-border);
  background: rgba(0, 0, 0, 0.3);
}
.arc-stat-num {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.9rem;
  margin-bottom: 8px;
  display: block;
}
.arc-stat-item:nth-child(1) .arc-stat-num { color: var(--arc-green); text-shadow: var(--arc-glow-green); }
.arc-stat-item:nth-child(2) .arc-stat-num { color: var(--arc-blue); text-shadow: var(--arc-glow-blue); }
.arc-stat-item:nth-child(3) .arc-stat-num { color: var(--arc-magenta); text-shadow: var(--arc-glow-magenta); }
.arc-stat-item:nth-child(4) .arc-stat-num { color: var(--arc-yellow); text-shadow: var(--arc-glow-yellow); }
.arc-stat-label {
  font-size: 1.1rem;
  color: var(--arc-text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* ==================== FEATURES / POWER-UPS ==================== */
.arc-features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}
.arc-feature-card {
  background: var(--arc-bg-card);
  padding: 32px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}
.arc-feature-card:hover { transform: translateY(-4px); }
.arc-feature-card--green { border: 3px solid var(--arc-green); }
.arc-feature-card--green:hover { box-shadow: var(--arc-glow-green); }
.arc-feature-card--blue { border: 3px solid var(--arc-blue); }
.arc-feature-card--blue:hover { box-shadow: var(--arc-glow-blue); }
.arc-feature-card--magenta { border: 3px solid var(--arc-magenta); }
.arc-feature-card--magenta:hover { box-shadow: var(--arc-glow-magenta); }
.arc-feature-card--yellow { border: 3px solid var(--arc-yellow); }
.arc-feature-card--yellow:hover { box-shadow: var(--arc-glow-yellow); }

.arc-feature-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border: 2px solid;
  background: rgba(0, 0, 0, 0.5);
}
.arc-feature-icon--green { border-color: var(--arc-green); color: var(--arc-green); }
.arc-feature-icon--blue { border-color: var(--arc-blue); color: var(--arc-blue); }
.arc-feature-icon--magenta { border-color: var(--arc-magenta); color: var(--arc-magenta); }
.arc-feature-icon--yellow { border-color: var(--arc-yellow); color: var(--arc-yellow); }

.arc-feature-badge {
  position: absolute;
  top: 0;
  right: 0;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.45rem;
  padding: 6px 10px;
  text-transform: uppercase;
  animation: arcPulse 1.5s ease-in-out infinite;
}
.arc-badge-new { background: var(--arc-magenta); color: #fff; }
.arc-badge-hot { background: var(--arc-yellow); color: #0D0D0D; }

.arc-feature-card h3 {
  font-size: 0.7rem;
  margin-bottom: 10px;
}
.arc-feature-card--green h3 { color: var(--arc-green); }
.arc-feature-card--blue h3 { color: var(--arc-blue); }
.arc-feature-card--magenta h3 { color: var(--arc-magenta); }
.arc-feature-card--yellow h3 { color: var(--arc-yellow); }
.arc-feature-card p { color: var(--arc-text-dim); line-height: 1.5; font-size: 1.2rem; }

.arc-powerup-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.45rem;
  color: var(--arc-text-dim);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 4px;
  display: block;
}

/* ==================== HOW IT WORKS / LEVELS ==================== */
.arc-levels { position: relative; }
.arc-levels-grid {
  display: flex;
  justify-content: center;
  gap: 40px;
  position: relative;
}
.arc-level-card {
  flex: 1;
  max-width: 320px;
  text-align: center;
  position: relative;
  z-index: 2;
  padding: 32px 24px;
  background: var(--arc-bg-card);
  border: 3px solid var(--arc-border);
  transition: all 0.2s;
}
.arc-level-card:hover {
  transform: translateY(-4px);
}
.arc-level-card:nth-child(1) { border-color: var(--arc-green); }
.arc-level-card:nth-child(1):hover { box-shadow: var(--arc-glow-green); }
.arc-level-card:nth-child(2) { border-color: var(--arc-blue); }
.arc-level-card:nth-child(2):hover { box-shadow: var(--arc-glow-blue); }
.arc-level-card:nth-child(3) { border-color: var(--arc-magenta); }
.arc-level-card:nth-child(3):hover { box-shadow: var(--arc-glow-magenta); }

.arc-level-number {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.55rem;
  padding: 8px 16px;
  margin-bottom: 16px;
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.arc-level-card:nth-child(1) .arc-level-number {
  background: var(--arc-green);
  color: #0D0D0D;
  box-shadow: var(--arc-glow-green);
}
.arc-level-card:nth-child(2) .arc-level-number {
  background: var(--arc-blue);
  color: #0D0D0D;
  box-shadow: var(--arc-glow-blue);
}
.arc-level-card:nth-child(3) .arc-level-number {
  background: var(--arc-magenta);
  color: #fff;
  box-shadow: var(--arc-glow-magenta);
}

.arc-level-card h3 {
  font-size: 0.65rem;
  margin-bottom: 12px;
  color: var(--arc-text);
}
.arc-level-card p {
  color: var(--arc-text-dim);
  font-size: 1.15rem;
  line-height: 1.5;
}

.arc-level-connector {
  position: absolute;
  top: 50%;
  width: 40px;
  height: 4px;
  background: repeating-linear-gradient(
    90deg,
    var(--arc-green) 0px,
    var(--arc-green) 6px,
    transparent 6px,
    transparent 10px
  );
  z-index: 1;
}

/* ==================== PRICING / CHARACTER SELECT ==================== */
.arc-pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: start;
}
.arc-pricing-card {
  background: var(--arc-bg-card);
  padding: 32px;
  text-align: center;
  transition: all 0.2s ease;
  position: relative;
}
.arc-pricing-card:hover { transform: translateY(-4px); }
.arc-pricing-card--starter {
  border: 3px solid var(--arc-green);
}
.arc-pricing-card--starter:hover { box-shadow: var(--arc-glow-green); }
.arc-pricing-card--pro {
  border: 3px solid var(--arc-magenta);
  transform: scale(1.04);
}
.arc-pricing-card--pro:hover {
  transform: scale(1.04) translateY(-4px);
  box-shadow: var(--arc-glow-magenta);
}
.arc-pricing-card--elite {
  border: 3px solid var(--arc-blue);
}
.arc-pricing-card--elite:hover { box-shadow: var(--arc-glow-blue); }

.arc-pricing-select-badge {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Press Start 2P', monospace;
  font-size: 0.45rem;
  padding: 6px 14px;
  background: var(--arc-yellow);
  color: #0D0D0D;
  white-space: nowrap;
  animation: arcPulse 2s ease-in-out infinite;
  box-shadow: var(--arc-glow-yellow);
}

.arc-pricing-tier-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.arc-pricing-card--starter .arc-pricing-tier-label { color: var(--arc-green); }
.arc-pricing-card--pro .arc-pricing-tier-label { color: var(--arc-magenta); }
.arc-pricing-card--elite .arc-pricing-tier-label { color: var(--arc-blue); }

.arc-pricing-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.75rem;
  color: var(--arc-text);
  margin-bottom: 8px;
}
.arc-pricing-price {
  font-family: 'Press Start 2P', monospace;
  font-size: 1.6rem;
  margin-bottom: 4px;
}
.arc-pricing-card--starter .arc-pricing-price { color: var(--arc-green); text-shadow: var(--arc-glow-green); }
.arc-pricing-card--pro .arc-pricing-price { color: var(--arc-magenta); text-shadow: var(--arc-glow-magenta); }
.arc-pricing-card--elite .arc-pricing-price { color: var(--arc-blue); text-shadow: var(--arc-glow-blue); }
.arc-pricing-period { font-size: 1rem; color: var(--arc-text-dim); margin-bottom: 24px; }

.arc-pricing-features {
  list-style: none;
  margin: 24px 0;
  text-align: left;
}
.arc-pricing-features li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 1.1rem;
  color: var(--arc-text);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.arc-pricing-features li:last-child { border-bottom: none; }
.arc-pricing-check {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid;
}
.arc-pricing-check--green { border-color: var(--arc-green); color: var(--arc-green); }
.arc-pricing-check--magenta { border-color: var(--arc-magenta); color: var(--arc-magenta); }
.arc-pricing-check--blue { border-color: var(--arc-blue); color: var(--arc-blue); }

.arc-pricing-free-tag {
  display: inline-block;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.45rem;
  background: var(--arc-green);
  color: #0D0D0D;
  padding: 4px 10px;
  margin-bottom: 8px;
}

/* ==================== TESTIMONIALS ==================== */
.arc-testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}
.arc-testimonial-card {
  background: var(--arc-bg-card);
  padding: 28px;
  position: relative;
  transition: all 0.2s ease;
  border: 3px solid var(--arc-border);
}
.arc-testimonial-card:hover { transform: translateY(-3px); }
.arc-testimonial-card:nth-child(1) { border-color: var(--arc-green); }
.arc-testimonial-card:nth-child(1):hover { box-shadow: var(--arc-glow-green); }
.arc-testimonial-card:nth-child(2) { border-color: var(--arc-blue); }
.arc-testimonial-card:nth-child(2):hover { box-shadow: var(--arc-glow-blue); }
.arc-testimonial-card:nth-child(3) { border-color: var(--arc-yellow); }
.arc-testimonial-card:nth-child(3):hover { box-shadow: var(--arc-glow-yellow); }

.arc-testimonial-card::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 28px;
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
}
.arc-testimonial-card:nth-child(1)::after { border-top: 12px solid var(--arc-green); }
.arc-testimonial-card:nth-child(2)::after { border-top: 12px solid var(--arc-blue); }
.arc-testimonial-card:nth-child(3)::after { border-top: 12px solid var(--arc-yellow); }

.arc-testimonial-stars {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  color: var(--arc-yellow);
  filter: drop-shadow(0 0 3px rgba(255, 225, 0, 0.4));
}
.arc-testimonial-text {
  font-size: 1.2rem;
  line-height: 1.6;
  color: var(--arc-text);
  margin-bottom: 20px;
}
.arc-testimonial-text::before { content: '> '; color: var(--arc-green); }
.arc-testimonial-author {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.arc-testimonial-avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  color: #0D0D0D;
  border: 2px solid;
}
.arc-testimonial-card:nth-child(1) .arc-testimonial-avatar { background: var(--arc-green); border-color: var(--arc-green); }
.arc-testimonial-card:nth-child(2) .arc-testimonial-avatar { background: var(--arc-blue); border-color: var(--arc-blue); }
.arc-testimonial-card:nth-child(3) .arc-testimonial-avatar { background: var(--arc-yellow); border-color: var(--arc-yellow); }
.arc-testimonial-name {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.5rem;
  color: var(--arc-text);
}
.arc-testimonial-role {
  font-size: 1rem;
  color: var(--arc-text-dim);
  margin-top: 2px;
}

/* ==================== CTA ==================== */
.arc-cta { padding: 80px 0; }
.arc-cta-box {
  background: linear-gradient(135deg, #1A1A2E 0%, #0D0D0D 100%);
  border: 4px solid var(--arc-green);
  padding: 60px 40px;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: var(--arc-glow-green);
}
.arc-cta-box h2 {
  font-size: 1.3rem;
  color: var(--arc-yellow);
  margin-bottom: 8px;
  position: relative;
  z-index: 2;
  text-shadow: var(--arc-glow-yellow);
  animation: arcFlicker 4s linear infinite;
}
.arc-cta-box .arc-cta-subtext {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.6rem;
  color: var(--arc-green);
  margin-bottom: 24px;
  position: relative;
  z-index: 2;
  animation: arcPulse 1.5s ease-in-out infinite;
  text-shadow: var(--arc-glow-green);
}
.arc-cta-box p {
  color: var(--arc-text-dim);
  font-size: 1.3rem;
  margin-bottom: 32px;
  max-width: 540px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 2;
  line-height: 1.5;
}
.arc-cta-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  position: relative;
  z-index: 2;
  flex-wrap: wrap;
}
.arc-cta-corner {
  position: absolute;
  width: 40px;
  height: 40px;
  border: 2px solid;
  opacity: 0.3;
}
.arc-cta-corner--tl { top: 16px; left: 16px; border-right: none; border-bottom: none; border-color: var(--arc-green); }
.arc-cta-corner--tr { top: 16px; right: 16px; border-left: none; border-bottom: none; border-color: var(--arc-blue); }
.arc-cta-corner--bl { bottom: 16px; left: 16px; border-right: none; border-top: none; border-color: var(--arc-magenta); }
.arc-cta-corner--br { bottom: 16px; right: 16px; border-left: none; border-top: none; border-color: var(--arc-yellow); }

/* ==================== FOOTER ==================== */
.arc-footer {
  padding: 48px 0 32px;
  border-top: 4px solid var(--arc-border);
  background: #0A0A14;
}
.arc-footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 40px;
  flex-wrap: wrap;
}
.arc-footer-brand { max-width: 280px; }
.arc-footer-brand-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  text-decoration: none;
}
.arc-footer-brand-logo img { height: 36px; width: auto; }
.arc-footer-brand-logo span {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.65rem;
  color: var(--arc-green);
  text-shadow: var(--arc-glow-green);
}
.arc-footer-brand p { color: var(--arc-text-dim); font-size: 1.1rem; line-height: 1.5; }
.arc-footer-col h4 {
  font-size: 0.55rem;
  color: var(--arc-text);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 2px;
}
.arc-footer-col a {
  display: block;
  color: var(--arc-text-dim);
  text-decoration: none;
  font-size: 1.1rem;
  margin-bottom: 8px;
  transition: color 0.2s;
}
.arc-footer-col a:hover { color: var(--arc-green); text-shadow: var(--arc-glow-green); }
.arc-footer-bottom {
  text-align: center;
  margin-top: 40px;
  padding-top: 24px;
  border-top: 2px solid var(--arc-border);
  color: var(--arc-text-dim);
  font-size: 1rem;
}
.arc-footer-bottom .arc-credits {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.45rem;
  color: var(--arc-green);
  opacity: 0.5;
  margin-top: 8px;
  letter-spacing: 2px;
}

/* ==================== MOBILE TOGGLE ==================== */
.arc-mobile-toggle {
  display: none;
  background: none;
  border: 2px solid var(--arc-green);
  cursor: pointer;
  padding: 8px;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
}
.arc-mobile-toggle span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--arc-green);
  transition: all 0.3s;
}
.arc-mobile-menu { display: none; }

/* ==================== RESPONSIVE ==================== */
@media (max-width: 1024px) {
  .arc-hero-text h1 { font-size: 1.5rem; }
  .arc-hero-logo-wrap img { width: 220px; }
  .arc-hero-glow-ring { width: 260px; height: 260px; }
  .arc-features-grid { gap: 20px; }
  .arc-stats-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .arc-nav-links, .arc-nav-auth { display: none; }
  .arc-mobile-toggle { display: flex; }
  .arc-mobile-menu {
    display: none;
    position: absolute;
    top: 72px;
    left: 0;
    right: 0;
    background: #1A1A2E;
    border-bottom: 4px solid var(--arc-green);
    padding: 24px;
    z-index: 99;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .arc-mobile-menu.open { display: block; }
  .arc-mobile-menu a {
    display: block;
    padding: 14px 0;
    font-family: 'VT323', monospace;
    font-size: 1.3rem;
    color: var(--arc-text);
    text-decoration: none;
    border-bottom: 1px solid var(--arc-border);
    text-transform: uppercase;
    letter-spacing: 2px;
  }
  .arc-mobile-menu a:hover { color: var(--arc-green); }
  .arc-mobile-menu a:last-child { border-bottom: none; }
  .arc-mobile-menu-auth {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 2px solid var(--arc-border);
  }
  .arc-hero-inner { flex-direction: column-reverse; text-align: center; gap: 32px; }
  .arc-hero-text h1 { font-size: 1.2rem; }
  .arc-hero-text p { margin: 0 auto 28px; }
  .arc-hero-ctas { justify-content: center; }
  .arc-hero-logo-wrap img { width: 180px; }
  .arc-hero-glow-ring { width: 220px; height: 220px; }
  .arc-features-grid { grid-template-columns: 1fr; }
  .arc-levels-grid { flex-direction: column; align-items: center; gap: 24px; }
  .arc-level-connector { display: none; }
  .arc-pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
  .arc-pricing-card--pro { transform: none; }
  .arc-pricing-card--pro:hover { transform: translateY(-4px); }
  .arc-testimonials-grid { grid-template-columns: 1fr; max-width: 440px; margin: 0 auto; }
  .arc-xp-wrap { margin: 0 auto; }
  .arc-section-title { font-size: 1rem; }
  .arc-stats-grid { grid-template-columns: repeat(2, 1fr); }
  .arc-stats-board { padding: 24px 16px; }
  .arc-footer-inner { flex-direction: column; text-align: center; align-items: center; }
  .arc-footer-brand { text-align: center; }
  .arc-cta-box { padding: 40px 24px; }
  .arc-cta-box h2 { font-size: 1rem; }
}

@media (max-width: 480px) {
  .arc-hero-text h1 { font-size: 0.95rem; }
  .arc-hero-press-start { font-size: 0.55rem; }
  .arc-hero-ctas { flex-direction: column; align-items: center; }
  .arc-cta-buttons { flex-direction: column; align-items: center; }
  .arc-stat-num { font-size: 0.7rem; }
  .arc-stats-grid { gap: 8px; }
  .arc-stats-title { font-size: 0.65rem; }
  .arc-section-label { font-size: 0.5rem; }
  .arc-section-title { font-size: 0.85rem; }
  .arc-btn-lg { padding: 14px 20px; font-size: 0.6rem; }
}
`;

const LandingDesign7: React.FC = () => {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [xpCount, setXpCount] = useState(0);
  const [filledSegments, setFilledSegments] = useState(0);

  const totalSegments = 20;
  const targetFilled = 13; // ~65%

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

  // Animated XP counter (blocky pixel increments)
  useEffect(() => {
    const target = 1250;
    const stepSize = 50; // blocky increments
    const totalSteps = Math.ceil(target / stepSize);
    const stepDuration = 1800 / totalSteps;
    let currentStep = 0;

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        currentStep++;
        const val = Math.min(currentStep * stepSize, target);
        setXpCount(val);
        if (currentStep >= totalSteps) {
          clearInterval(interval);
        }
      }, stepDuration);
      return () => clearInterval(interval);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Pixel progress bar fill animation
  useEffect(() => {
    const stepDuration = 100;
    let current = 0;

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        current++;
        setFilledSegments(current);
        if (current >= targetFilled) {
          clearInterval(interval);
        }
      }, stepDuration);
      return () => clearInterval(interval);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const features = [
    { icon: <Brain size={24} />, title: 'AI Quizzes', desc: 'Upload any document and our AI generates interactive quizzes in seconds. Study smarter, score higher.', color: 'green' as const, badge: null },
    { icon: <Zap size={24} />, title: 'Smart Flashcards', desc: 'Auto-generated flashcards with spaced repetition. Our algorithm ensures perfect timing for long-term memory.', color: 'yellow' as const, badge: 'HOT' },
    { icon: <Target size={24} />, title: 'AI Tutor Chat', desc: 'Ask questions and get explanations on any topic. Your personal AI tutor is available 24/7, always patient.', color: 'blue' as const, badge: 'NEW' },
    { icon: <Users size={24} />, title: 'Share & Compete', desc: 'Send quizzes to friends, challenge classmates, and climb the leaderboard together. Co-op learning mode.', color: 'magenta' as const, badge: null },
  ];

  const stats = [
    { num: '10,000+', label: 'Players' },
    { num: '500K+', label: 'Quizzes' },
    { num: '95%', label: 'Win Rate' },
    { num: '4.9', label: 'Score' },
  ];

  const levels = [
    { level: 'Level 1', title: 'Upload Material', desc: 'Drop in PDFs, images, notes, or any document. Our AI scans it all in seconds.' },
    { level: 'Level 2', title: 'AI Generates Study Kit', desc: 'Quizzes, flashcards, and summaries created automatically. Select your study mode.' },
    { level: 'Level 3', title: 'Learn & Level Up', desc: 'Study with spaced repetition, track progress, earn XP, and master any subject.' },
  ];

  const pricingPlans = [
    { name: 'Rookie', price: '$0', period: '', variant: 'starter' as const, features: ['5 quizzes per month', '10 flashcard decks', 'AI tutor (basic)', 'Share with 2 friends', 'Basic analytics'] },
    { name: 'Pro Gamer', price: '$9.99', period: '/mo', variant: 'pro' as const, features: ['Unlimited quizzes', 'Unlimited flashcards', 'AI tutor (advanced)', 'Unlimited sharing', 'Detailed analytics', 'Priority support', 'Custom study paths'] },
    { name: 'Elite', price: '$29.99', period: '/mo', variant: 'elite' as const, features: ['Everything in Pro', 'Up to 25 members', 'Team dashboard', 'Shared library', 'Admin controls', 'API access'] },
  ];

  const testimonials = [
    { name: 'Sarah Chen', role: 'Medical Student', text: 'BrainLift is a game changer! I uploaded my anatomy notes and had a full quiz ready in under a minute. My grades have never been better.', avatar: 'SC', rating: 5 },
    { name: 'Marcus Rodriguez', role: 'Language Learner', text: 'The flashcards with spaced repetition helped me learn 300 Japanese characters in two weeks. The progress tracking keeps me going every day!', avatar: 'MR', rating: 5 },
    { name: 'Priya Patel', role: 'High School Teacher', text: 'I create quizzes for my students in minutes instead of hours. They love the gamified experience and actually look forward to studying.', avatar: 'PP', rating: 5 },
  ];

  const checkColor = (variant: string) => {
    if (variant === 'starter') return 'green';
    if (variant === 'pro') return 'magenta';
    if (variant === 'elite') return 'blue';
    return 'green';
  };

  return (
    <div className="arcade-landing">
      <style>{STYLES}</style>

      {/* NAV */}
      <nav className="arc-nav">
        <div className="arc-container arc-nav-inner">
          <a href="#" className="arc-nav-logo">
            <img src={BrainLiftLogo} alt="BrainLift Logo" />
            <span>BrainLift</span>
          </a>
          <ul className="arc-nav-links">
            <li><a href="#features">Power-Ups</a></li>
            <li><a href="#how-it-works">Levels</a></li>
            <li><a href="#pricing">Select</a></li>
            <li><a href="#testimonials">Reviews</a></li>
          </ul>
          <div className="arc-nav-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="arc-btn arc-btn-outline arc-btn-sm">Log In</Link>
                <Link to="/auth/register" className="arc-btn arc-btn-green arc-btn-sm">Sign Up</Link>
              </>
            ) : (
              <>
                <span className="arc-btn arc-btn-outline arc-btn-sm arc-btn-disabled"><Lock size={14} /> Log In</span>
                <span className="arc-btn arc-btn-green arc-btn-sm arc-btn-disabled"><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
          <button className="arc-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>
        <div className={`arc-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Power-Ups</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>Levels</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Select</a>
          <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Reviews</a>
          <div className="arc-mobile-menu-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="arc-btn arc-btn-outline arc-btn-sm" style={{ flex: 1 }}>Log In</Link>
                <Link to="/auth/register" className="arc-btn arc-btn-green arc-btn-sm" style={{ flex: 1 }}>Sign Up</Link>
              </>
            ) : (
              <>
                <span className="arc-btn arc-btn-outline arc-btn-sm arc-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Log In</span>
                <span className="arc-btn arc-btn-green arc-btn-sm arc-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="arc-hero">
        <div className="arc-container arc-hero-inner">
          <div className="arc-hero-text">
            <div className="arc-hero-press-start">
              <Gamepad2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Press Start to Learn
            </div>
            <h1>
              <span className="arc-highlight">Level Up</span> Your<br />
              Study Game
            </h1>
            <p>
              Transform any document into quizzes, flashcards, and study materials
              with AI. Earn XP, track progress, and conquer every subject.
            </p>
            <div className="arc-hero-ctas">
              {isWebLoginEnabled ? (
                <>
                  <Link to="/auth/register" className="arc-btn arc-btn-green arc-btn-lg arc-btn-insert-coin">
                    Insert Coin <ArrowRight size={16} />
                  </Link>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="arc-btn arc-btn-outline arc-btn-lg">
                    Get the App
                  </a>
                </>
              ) : (
                <>
                  <span className="arc-btn arc-btn-green arc-btn-lg arc-btn-disabled">
                    <Lock size={16} /> Coming Soon
                  </span>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="arc-btn arc-btn-outline arc-btn-lg">
                    Get the App
                  </a>
                </>
              )}
            </div>
            <div className="arc-xp-wrap">
              <div className="arc-xp-label">
                <span>
                  <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {xpCount.toLocaleString()} XP
                </span>
                <span className="arc-xp-level">
                  <Trophy size={10} /> LVL 0
                </span>
              </div>
              <div className="arc-xp-track">
                {Array.from({ length: totalSegments }).map((_, i) => (
                  <div
                    key={i}
                    className={`arc-xp-segment${i < filledSegments ? ' filled' : ''}`}
                  />
                ))}
              </div>
              <p className="arc-xp-hint">PLAYER 1 -- START YOUR QUEST!</p>
            </div>
          </div>
          <div className="arc-hero-visual">
            <div className="arc-hero-logo-wrap">
              <img src={BrainLiftLogo} alt="BrainLift brain mascot" />
              <div className="arc-hero-glow-ring" />
              <div className="arc-hero-pixel-deco arc-hero-pixel-deco--1" />
              <div className="arc-hero-pixel-deco arc-hero-pixel-deco--2" />
              <div className="arc-hero-pixel-deco arc-hero-pixel-deco--3" />
              <div className="arc-hero-pixel-deco arc-hero-pixel-deco--4" />
            </div>
          </div>
        </div>
      </section>

      {/* HIGH SCORE STATS */}
      <section className="arc-stats">
        <div className="arc-container">
          <div className="arc-stats-board">
            <div className="arc-stats-title">
              <Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              High Scores
            </div>
            <div className="arc-stats-grid">
              {stats.map((stat, i) => (
                <div className="arc-stat-item" key={i}>
                  <span className="arc-stat-num">{stat.num}</span>
                  <span className="arc-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* POWER-UPS / FEATURES */}
      <section className="arc-section" id="features">
        <div className="arc-container">
          <div className="arc-section-label">Equip Your Arsenal</div>
          <h2 className="arc-section-title">Power-Ups</h2>
          <p className="arc-section-subtitle">
            Powerful AI tools to boost your study game. Collect them all and dominate every exam.
          </p>
          <div className="arc-divider" />
          <div className="arc-features-grid">
            {features.map((feat, i) => (
              <div className={`arc-feature-card arc-feature-card--${feat.color}`} key={i}>
                {feat.badge && (
                  <span className={`arc-feature-badge ${feat.badge === 'NEW' ? 'arc-badge-new' : 'arc-badge-hot'}`}>
                    {feat.badge === 'NEW' ? <Sparkles size={8} /> : <Star size={8} />}
                    {' '}{feat.badge}
                  </span>
                )}
                <span className="arc-powerup-label">Power-Up {String.fromCharCode(65 + i)}</span>
                <div className={`arc-feature-icon arc-feature-icon--${feat.color}`}>{feat.icon}</div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEVELS / HOW IT WORKS */}
      <section className="arc-section arc-levels" id="how-it-works">
        <div className="arc-container">
          <div className="arc-section-label">Game Progression</div>
          <h2 className="arc-section-title">How to Play</h2>
          <p className="arc-section-subtitle">
            Three levels to transform any material into your personal study companion.
          </p>
          <div className="arc-divider" />
          <div className="arc-levels-grid">
            {levels.map((step, i) => (
              <div className="arc-level-card" key={i}>
                <div className="arc-level-number">{step.level}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHARACTER SELECT / PRICING */}
      <section className="arc-section" id="pricing">
        <div className="arc-container">
          <div className="arc-section-label">Choose Your Character</div>
          <h2 className="arc-section-title">Select Player</h2>
          <p className="arc-section-subtitle">
            Start free and power up when ready. No credit card required to begin your quest.
          </p>
          <div className="arc-divider" />
          <div className="arc-pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div className={`arc-pricing-card arc-pricing-card--${plan.variant}`} key={i}>
                {plan.variant === 'pro' && (
                  <div className="arc-pricing-select-badge">
                    <Gamepad2 size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Best Value
                  </div>
                )}
                <div className="arc-pricing-tier-label">
                  {plan.variant === 'starter' && 'Tier 1'}
                  {plan.variant === 'pro' && 'Tier 2'}
                  {plan.variant === 'elite' && 'Tier 3'}
                </div>
                {plan.variant === 'starter' && <span className="arc-pricing-free-tag">Free Play</span>}
                <div className="arc-pricing-name">{plan.name}</div>
                <div className="arc-pricing-price">{plan.price}</div>
                {plan.period && <div className="arc-pricing-period">{plan.period}</div>}
                {!plan.period && <div className="arc-pricing-period">forever</div>}
                <ul className="arc-pricing-features">
                  {plan.features.map((feat, j) => (
                    <li key={j}>
                      <span className={`arc-pricing-check arc-pricing-check--${checkColor(plan.variant)}`}>
                        <Check size={12} />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                {isWebLoginEnabled ? (
                  <Link
                    to="/auth/register"
                    className={`arc-btn ${plan.variant === 'pro' ? 'arc-btn-magenta' : plan.variant === 'elite' ? 'arc-btn-blue' : 'arc-btn-green'} arc-btn-insert-coin`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {plan.variant === 'starter' ? 'Start Free' : plan.variant === 'pro' ? 'Go Pro' : 'Go Elite'}
                    <ArrowRight size={14} />
                  </Link>
                ) : (
                  <span
                    className={`arc-btn ${plan.variant === 'pro' ? 'arc-btn-magenta' : plan.variant === 'elite' ? 'arc-btn-blue' : 'arc-btn-green'} arc-btn-disabled`}
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

      {/* TESTIMONIALS */}
      <section className="arc-section" id="testimonials">
        <div className="arc-container">
          <div className="arc-section-label">Player Reviews</div>
          <h2 className="arc-section-title">What Gamers Say</h2>
          <p className="arc-section-subtitle">
            Join thousands of players who leveled up their study game with BrainLift.
          </p>
          <div className="arc-divider" />
          <div className="arc-testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="arc-testimonial-card" key={i}>
                <div className="arc-testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="arc-testimonial-text">{t.text}</p>
                <div className="arc-testimonial-author">
                  <div className="arc-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="arc-testimonial-name">{t.name}</div>
                    <div className="arc-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="arc-cta">
        <div className="arc-container">
          <div className="arc-cta-box">
            <div className="arc-cta-corner arc-cta-corner--tl" />
            <div className="arc-cta-corner arc-cta-corner--tr" />
            <div className="arc-cta-corner arc-cta-corner--bl" />
            <div className="arc-cta-corner arc-cta-corner--br" />
            <h2>Continue?</h2>
            <div className="arc-cta-subtext">Insert Coin to Play</div>
            <p>
              Join 10,000+ players who are already leveling up with BrainLift.
              Free to start -- no credit card needed.
            </p>
            <div className="arc-cta-buttons">
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="arc-btn arc-btn-green arc-btn-lg arc-btn-insert-coin">
                  Create Free Account <ArrowRight size={16} />
                </Link>
              ) : (
                <span className="arc-btn arc-btn-green arc-btn-lg arc-btn-disabled">
                  <Lock size={16} /> Coming Soon
                </span>
              )}
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="arc-btn arc-btn-yellow arc-btn-lg">
                Download App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="arc-footer">
        <div className="arc-container">
          <div className="arc-footer-inner">
            <div className="arc-footer-brand">
              <a href="#" className="arc-footer-brand-logo">
                <img src={BrainLiftLogo} alt="BrainLift" />
                <span>BrainLift</span>
              </a>
              <p>
                Level up your learning. Upload materials, let AI do the heavy lifting,
                and conquer your study goals every day.
              </p>
            </div>
            <div className="arc-footer-col">
              <h4>Product</h4>
              <a href="#features">Power-Ups</a>
              <a href="#pricing">Select Player</a>
              <a href="#how-it-works">Levels</a>
              <a href="#testimonials">Reviews</a>
            </div>
            <div className="arc-footer-col">
              <h4>Download</h4>
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer">iOS App</a>
              <a href="https://play.google.com/store/apps/details?id=com.brainlift.app" target="_blank" rel="noopener noreferrer">Android App</a>
            </div>
            <div className="arc-footer-col">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
            </div>
          </div>
          <div className="arc-footer-bottom">
            &copy; {new Date().getFullYear()} BrainLift. All rights reserved.
            <div className="arc-credits">GAME OVER -- THANK YOU FOR PLAYING</div>
          </div>
        </div>
      </footer>
      <DesignSwitcher />
    </div>
  );
};

export default LandingDesign7;

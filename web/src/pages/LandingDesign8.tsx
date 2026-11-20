import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { featureFlagsService } from '@/services/featureFlags.service';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';
import { Lock, ArrowRight, Star, Check, Zap, Brain, Target, Users, Sparkles, PenTool, Bookmark } from 'lucide-react';
import { DesignSwitcher } from '@/components/DesignSwitcher';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Patrick+Hand&display=swap');

:root {
  --sb-bg: #F5F0E8;
  --sb-paper: #FFFDF7;
  --sb-red: #E74C3C;
  --sb-yellow: #F1C40F;
  --sb-blue: #3498DB;
  --sb-green: #2ECC71;
  --sb-purple: #9B59B6;
  --sb-text: #2C2C2C;
  --sb-text-light: #6B6B6B;
  --sb-tape: rgba(255, 248, 220, 0.75);
  --sb-tape-shadow: rgba(0,0,0,0.06);
  --sb-shadow: rgba(0,0,0,0.1);
  --sb-shadow-strong: rgba(0,0,0,0.18);
}

@keyframes sbPeelIn {
  from { opacity: 0; transform: translateY(24px) rotate(2deg) scale(0.96); }
  to { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
}
@keyframes sbWobble {
  0%, 100% { transform: rotate(-1deg); }
  50% { transform: rotate(1deg); }
}
@keyframes sbStampPress {
  0% { transform: scale(1.3) rotate(-8deg); opacity: 0; }
  60% { transform: scale(0.95) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes sbFloat {
  0%, 100% { transform: translateY(0) rotate(var(--float-rot, 0deg)); }
  50% { transform: translateY(-6px) rotate(var(--float-rot, 0deg)); }
}
@keyframes sbTapeShimmer {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 0.85; }
}
@keyframes sbDoodleStroke {
  from { stroke-dashoffset: 200; }
  to { stroke-dashoffset: 0; }
}
@keyframes sbBadgePop {
  0% { transform: scale(0) rotate(-20deg); }
  70% { transform: scale(1.1) rotate(5deg); }
  100% { transform: scale(1) rotate(var(--badge-rot, -3deg)); }
}

/* ==================== GLOBAL ==================== */

.sticker-landing * { box-sizing: border-box; margin: 0; padding: 0; }
.sticker-landing {
  font-family: 'Patrick Hand', cursive;
  background: var(--sb-bg);
  background-image:
    radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 16px 16px;
  color: var(--sb-text);
  overflow-x: hidden;
  min-height: 100vh;
  line-height: 1.6;
}
.sticker-landing h1,
.sticker-landing h2,
.sticker-landing h3,
.sticker-landing h4 {
  font-family: 'Caveat', cursive;
  line-height: 1.2;
}

/* Scroll-triggered animation base */
.sticker-landing .sb-anim {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.sticker-landing .sb-anim.sticker-visible {
  opacity: 1;
  transform: translateY(0);
}

.sb-container { max-width: 1140px; margin: 0 auto; padding: 0 24px; }

/* ==================== WASHI TAPE DIVIDER ==================== */

.sb-washi-divider {
  height: 18px;
  background: repeating-linear-gradient(
    -45deg,
    var(--sb-yellow),
    var(--sb-yellow) 6px,
    rgba(255,255,255,0.5) 6px,
    rgba(255,255,255,0.5) 12px
  );
  opacity: 0.6;
  border-radius: 2px;
  margin: 0;
}
.sb-washi-divider--red {
  background: repeating-linear-gradient(
    -45deg,
    var(--sb-red),
    var(--sb-red) 6px,
    rgba(255,255,255,0.4) 6px,
    rgba(255,255,255,0.4) 12px
  );
}
.sb-washi-divider--blue {
  background: repeating-linear-gradient(
    -45deg,
    var(--sb-blue),
    var(--sb-blue) 6px,
    rgba(255,255,255,0.4) 6px,
    rgba(255,255,255,0.4) 12px
  );
}
.sb-washi-divider--green {
  background: repeating-linear-gradient(
    -45deg,
    var(--sb-green),
    var(--sb-green) 6px,
    rgba(255,255,255,0.4) 6px,
    rgba(255,255,255,0.4) 12px
  );
}
.sb-washi-divider--purple {
  background: repeating-linear-gradient(
    -45deg,
    var(--sb-purple),
    var(--sb-purple) 6px,
    rgba(255,255,255,0.4) 6px,
    rgba(255,255,255,0.4) 12px
  );
}

/* ==================== DOODLE UNDERLINE ==================== */

.sb-doodle-underline {
  position: relative;
  display: inline-block;
}
.sb-doodle-underline svg {
  position: absolute;
  bottom: -8px;
  left: -4px;
  width: calc(100% + 8px);
  height: 12px;
  overflow: visible;
}
.sb-doodle-underline svg path {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 200;
  animation: sbDoodleStroke 1.2s ease forwards;
}

/* ==================== NAV ==================== */

.sb-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--sb-paper);
  border-bottom: 3px solid var(--sb-text);
  box-shadow: 0 3px 0 var(--sb-shadow);
}
.sb-nav::after {
  content: '';
  position: absolute;
  bottom: -7px;
  left: 0;
  right: 0;
  height: 4px;
  background: repeating-linear-gradient(
    90deg,
    var(--sb-red) 0 20px,
    var(--sb-yellow) 20px 40px,
    var(--sb-blue) 40px 60px,
    var(--sb-green) 60px 80px,
    var(--sb-purple) 80px 100px
  );
  opacity: 0.7;
}
.sb-nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}
.sb-nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.sb-nav-logo img {
  height: 46px;
  width: auto;
  filter: drop-shadow(2px 2px 0 rgba(0,0,0,0.12));
  border: 2px solid var(--sb-text);
  border-radius: 4px;
  padding: 2px;
  background: #fff;
  transform: rotate(-3deg);
}
.sb-nav-logo span {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 1.7rem;
  color: var(--sb-text);
}
.sb-nav-tabs {
  display: flex;
  align-items: center;
  gap: 0;
  list-style: none;
}
.sb-nav-tabs li a {
  display: block;
  text-decoration: none;
  font-family: 'Patrick Hand', cursive;
  font-size: 1.05rem;
  color: var(--sb-text-light);
  padding: 8px 20px;
  border: 2px solid transparent;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s ease;
  position: relative;
  top: 2px;
}
.sb-nav-tabs li a:hover {
  background: var(--sb-bg);
  border-color: var(--sb-text);
  color: var(--sb-text);
}
.sb-nav-auth {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ==================== BUTTONS ==================== */

.sb-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: 'Patrick Hand', cursive;
  font-size: 1.05rem;
  padding: 10px 22px;
  border-radius: 4px;
  border: 2px solid var(--sb-text);
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  white-space: nowrap;
  position: relative;
}
.sb-btn:hover { transform: translateY(-2px) rotate(-1deg); }
.sb-btn:active { transform: translateY(0) rotate(0deg); }
.sb-btn-red {
  background: var(--sb-red);
  color: #fff;
  box-shadow: 3px 3px 0 var(--sb-text);
}
.sb-btn-red:hover { box-shadow: 2px 5px 0 var(--sb-text); }
.sb-btn-blue {
  background: var(--sb-blue);
  color: #fff;
  box-shadow: 3px 3px 0 var(--sb-text);
}
.sb-btn-blue:hover { box-shadow: 2px 5px 0 var(--sb-text); }
.sb-btn-yellow {
  background: var(--sb-yellow);
  color: var(--sb-text);
  box-shadow: 3px 3px 0 var(--sb-text);
}
.sb-btn-yellow:hover { box-shadow: 2px 5px 0 var(--sb-text); }
.sb-btn-green {
  background: var(--sb-green);
  color: #fff;
  box-shadow: 3px 3px 0 var(--sb-text);
}
.sb-btn-green:hover { box-shadow: 2px 5px 0 var(--sb-text); }
.sb-btn-purple {
  background: var(--sb-purple);
  color: #fff;
  box-shadow: 3px 3px 0 var(--sb-text);
}
.sb-btn-purple:hover { box-shadow: 2px 5px 0 var(--sb-text); }
.sb-btn-outline {
  background: transparent;
  color: var(--sb-text);
  box-shadow: none;
}
.sb-btn-outline:hover { background: rgba(0,0,0,0.04); }
.sb-btn-disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
.sb-btn-sm { padding: 7px 16px; font-size: 0.95rem; }
.sb-btn-lg { padding: 14px 32px; font-size: 1.15rem; }

/* ==================== HERO ==================== */

.sb-hero {
  padding: 80px 0 60px;
  position: relative;
}
.sb-hero-inner {
  display: flex;
  align-items: center;
  gap: 60px;
}
.sb-hero-text {
  flex: 1;
  animation: sbPeelIn 0.7s ease-out;
}
.sb-hero-text h1 {
  font-size: 3.8rem;
  color: var(--sb-text);
  margin-bottom: 20px;
  letter-spacing: -1px;
}
.sb-hero-text h1 .sb-highlight-red {
  color: var(--sb-red);
  position: relative;
  display: inline-block;
}
.sb-hero-text h1 .sb-highlight-red::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: -4px;
  right: -4px;
  height: 12px;
  background: var(--sb-yellow);
  z-index: -1;
  border-radius: 2px;
  opacity: 0.55;
  transform: rotate(-1deg);
}
.sb-hero-text p {
  font-size: 1.25rem;
  color: var(--sb-text-light);
  line-height: 1.7;
  margin-bottom: 32px;
  max-width: 520px;
}
.sb-hero-ctas {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.sb-hero-visual {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: sbPeelIn 0.7s ease-out 0.2s both;
}

/* Polaroid-style logo */
.sb-polaroid {
  background: #fff;
  padding: 16px 16px 48px 16px;
  border: 2px solid var(--sb-text);
  box-shadow: 4px 6px 0 var(--sb-shadow-strong);
  transform: rotate(-4deg);
  position: relative;
  z-index: 2;
  transition: transform 0.3s ease;
}
.sb-polaroid:hover { transform: rotate(0deg) scale(1.02); }
.sb-polaroid img {
  width: 260px;
  height: auto;
  display: block;
}
.sb-polaroid-caption {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  text-align: center;
  font-family: 'Caveat', cursive;
  font-size: 1.2rem;
  color: var(--sb-text-light);
}
/* Decorative tape on polaroid */
.sb-polaroid::before {
  content: '';
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%) rotate(2deg);
  width: 80px;
  height: 24px;
  background: var(--sb-tape);
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 1px 3px var(--sb-tape-shadow);
  z-index: 3;
  animation: sbTapeShimmer 3s ease-in-out infinite;
}

/* Hero deco stickers */
.sb-hero-sticker {
  position: absolute;
  z-index: 1;
  animation: sbFloat 3.5s ease-in-out infinite;
}
.sb-hero-sticker-1 {
  top: -10px;
  right: -20px;
  --float-rot: 8deg;
  color: var(--sb-yellow);
}
.sb-hero-sticker-2 {
  bottom: 10px;
  left: -10px;
  --float-rot: -5deg;
  animation-delay: 0.5s;
  color: var(--sb-purple);
}
.sb-hero-sticker-3 {
  top: 40%;
  right: -40px;
  --float-rot: 12deg;
  animation-delay: 1s;
  color: var(--sb-green);
}

/* ==================== SECTION COMMON ==================== */

.sb-section { padding: 80px 0; }
.sb-section-title {
  text-align: center;
  font-size: 2.8rem;
  color: var(--sb-text);
  margin-bottom: 12px;
}
.sb-section-subtitle {
  text-align: center;
  color: var(--sb-text-light);
  font-size: 1.15rem;
  margin-bottom: 52px;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

/* ==================== STATS - STICKER BADGES ==================== */

.sb-stats { padding: 48px 0; }
.sb-stats-inner {
  display: flex;
  justify-content: center;
  gap: 32px;
  flex-wrap: wrap;
}
.sb-stat-badge {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  border: 4px solid var(--sb-text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: 'Caveat', cursive;
  position: relative;
  transition: transform 0.25s ease;
  box-shadow: 3px 4px 0 var(--sb-shadow-strong);
}
.sb-stat-badge:hover { transform: scale(1.08) rotate(0deg) !important; }
.sb-stat-badge:nth-child(1) {
  background: var(--sb-red);
  color: #fff;
  transform: rotate(-4deg);
}
.sb-stat-badge:nth-child(2) {
  background: var(--sb-yellow);
  color: var(--sb-text);
  transform: rotate(3deg);
}
.sb-stat-badge:nth-child(3) {
  background: var(--sb-blue);
  color: #fff;
  transform: rotate(-2deg);
}
.sb-stat-badge:nth-child(4) {
  background: var(--sb-green);
  color: #fff;
  transform: rotate(5deg);
}
.sb-stat-badge::after {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  border: 2px dashed rgba(255,255,255,0.4);
  pointer-events: none;
}
.sb-stat-num {
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1;
}
.sb-stat-label {
  font-size: 0.95rem;
  font-weight: 500;
  opacity: 0.9;
}

/* ==================== FEATURES - STICKY NOTES ==================== */

.sb-features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}
.sb-sticky-note {
  background: var(--sb-paper);
  border: 2px solid var(--sb-text);
  padding: 32px 28px 28px;
  position: relative;
  transition: all 0.3s ease;
  box-shadow: 3px 4px 0 var(--sb-shadow);
}
.sb-sticky-note:hover {
  transform: rotate(0deg) translateY(-6px) !important;
  box-shadow: 4px 8px 12px var(--sb-shadow);
  z-index: 5;
}
/* Slight rotations */
.sb-sticky-note:nth-child(1) { transform: rotate(-2deg); }
.sb-sticky-note:nth-child(2) { transform: rotate(1.5deg); }
.sb-sticky-note:nth-child(3) { transform: rotate(1deg); }
.sb-sticky-note:nth-child(4) { transform: rotate(-1.5deg); }

/* Paper fold corner */
.sb-sticky-note::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 0 28px 28px;
  border-color: transparent transparent var(--sb-bg) transparent;
  filter: drop-shadow(-2px -2px 2px rgba(0,0,0,0.06));
}

/* Pin / tape effect on cards */
.sb-sticky-note--red::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 24px;
  width: 60px;
  height: 20px;
  background: linear-gradient(135deg, rgba(231,76,60,0.5), rgba(231,76,60,0.3));
  border: 1px solid rgba(0,0,0,0.08);
  transform: rotate(-3deg);
  box-shadow: 0 1px 2px var(--sb-tape-shadow);
}
.sb-sticky-note--yellow::before {
  content: '';
  position: absolute;
  top: -8px;
  right: 20px;
  width: 60px;
  height: 20px;
  background: linear-gradient(135deg, rgba(241,196,15,0.55), rgba(241,196,15,0.35));
  border: 1px solid rgba(0,0,0,0.08);
  transform: rotate(2deg);
  box-shadow: 0 1px 2px var(--sb-tape-shadow);
}
.sb-sticky-note--blue::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%) rotate(-1deg);
  width: 60px;
  height: 20px;
  background: linear-gradient(135deg, rgba(52,152,219,0.5), rgba(52,152,219,0.3));
  border: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 1px 2px var(--sb-tape-shadow);
}
.sb-sticky-note--purple::before {
  content: '';
  position: absolute;
  top: -8px;
  right: 30px;
  width: 60px;
  height: 20px;
  background: linear-gradient(135deg, rgba(155,89,182,0.5), rgba(155,89,182,0.3));
  border: 1px solid rgba(0,0,0,0.08);
  transform: rotate(3deg);
  box-shadow: 0 1px 2px var(--sb-tape-shadow);
}

.sb-sticky-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 3px solid var(--sb-text);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  color: #fff;
  position: relative;
  transform: rotate(-5deg);
  box-shadow: 2px 2px 0 var(--sb-shadow);
}
.sb-sticky-icon--red { background: var(--sb-red); }
.sb-sticky-icon--yellow { background: var(--sb-yellow); color: var(--sb-text); }
.sb-sticky-icon--blue { background: var(--sb-blue); }
.sb-sticky-icon--purple { background: var(--sb-purple); }
.sb-sticky-note h3 {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: var(--sb-text);
}
.sb-sticky-note p {
  color: var(--sb-text-light);
  font-size: 1.05rem;
  line-height: 1.6;
}

/* ==================== HOW IT WORKS - LINED PAPER ==================== */

.sb-how-steps {
  display: flex;
  justify-content: center;
  gap: 36px;
}
.sb-how-step {
  flex: 1;
  max-width: 320px;
  background: var(--sb-paper);
  border: 2px solid var(--sb-text);
  border-radius: 4px;
  padding: 28px 24px;
  position: relative;
  /* Ruled lines background */
  background-image:
    linear-gradient(transparent 27px, rgba(52,152,219,0.2) 27px, rgba(52,152,219,0.2) 28px, transparent 28px);
  background-size: 100% 28px;
  box-shadow: 3px 3px 0 var(--sb-shadow);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.sb-how-step:hover {
  transform: translateY(-4px);
  box-shadow: 3px 7px 12px var(--sb-shadow);
}
/* Red margin line */
.sb-how-step::before {
  content: '';
  position: absolute;
  top: 0;
  left: 40px;
  bottom: 0;
  width: 2px;
  background: rgba(231, 76, 60, 0.25);
}
.sb-how-number {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 3px solid var(--sb-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 1.5rem;
  color: #fff;
  margin-bottom: 16px;
  box-shadow: 2px 2px 0 var(--sb-shadow);
}
.sb-how-step:nth-child(1) .sb-how-number { background: var(--sb-red); }
.sb-how-step:nth-child(2) .sb-how-number { background: var(--sb-blue); }
.sb-how-step:nth-child(3) .sb-how-number { background: var(--sb-green); }
.sb-how-step h3 {
  font-size: 1.4rem;
  margin-bottom: 8px;
  color: var(--sb-text);
}
.sb-how-step p {
  color: var(--sb-text-light);
  font-size: 1rem;
  line-height: 1.6;
}

/* ==================== PRICING - STAMP CARDS ==================== */

.sb-pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  align-items: start;
}
.sb-pricing-card {
  background: var(--sb-paper);
  border: 3px solid var(--sb-text);
  border-radius: 6px;
  padding: 36px 28px;
  text-align: center;
  position: relative;
  transition: all 0.3s ease;
  box-shadow: 3px 4px 0 var(--sb-shadow);
}
.sb-pricing-card:hover {
  transform: translateY(-6px);
  box-shadow: 4px 10px 16px var(--sb-shadow);
}

/* Stamp border effect */
.sb-pricing-card::before {
  content: '';
  position: absolute;
  inset: 8px;
  border: 2px dashed;
  border-radius: 4px;
  pointer-events: none;
}
.sb-pricing-card--free::before { border-color: var(--sb-green); }
.sb-pricing-card--pro::before { border-color: var(--sb-red); }
.sb-pricing-card--team::before { border-color: var(--sb-purple); }

.sb-pricing-card--pro {
  border-color: var(--sb-red);
  transform: scale(1.04);
  z-index: 3;
}
.sb-pricing-card--pro:hover {
  transform: scale(1.04) translateY(-6px);
}

/* Stamp badge for popular */
.sb-pricing-stamp {
  position: absolute;
  top: -14px;
  right: -10px;
  background: var(--sb-red);
  color: #fff;
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 4px 14px;
  border: 2px solid var(--sb-text);
  border-radius: 4px;
  transform: rotate(8deg);
  box-shadow: 2px 2px 0 var(--sb-shadow);
  animation: sbWobble 2s ease-in-out infinite;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sb-pricing-name {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 1.4rem;
  color: var(--sb-text);
  margin-bottom: 4px;
  margin-top: 8px;
}
.sb-pricing-price {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 3rem;
  color: var(--sb-text);
  line-height: 1.1;
}
.sb-pricing-price span {
  font-size: 1rem;
  font-weight: 500;
  color: var(--sb-text-light);
  font-family: 'Patrick Hand', cursive;
}
.sb-pricing-features {
  list-style: none;
  margin: 24px 0;
  text-align: left;
}
.sb-pricing-features li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 1rem;
  color: var(--sb-text);
  border-bottom: 1px dashed rgba(0,0,0,0.1);
}
.sb-pricing-features li:last-child { border-bottom: none; }
.sb-pricing-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid var(--sb-text);
}
.sb-pricing-check--green { background: var(--sb-green); color: #fff; }
.sb-pricing-check--red { background: var(--sb-red); color: #fff; }
.sb-pricing-check--purple { background: var(--sb-purple); color: #fff; }
.sb-pricing-free-tag {
  display: inline-block;
  background: var(--sb-green);
  color: #fff;
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 2px 14px;
  border-radius: 4px;
  border: 2px solid var(--sb-text);
  margin-bottom: 6px;
  transform: rotate(-2deg);
}

/* ==================== TESTIMONIALS - NOTE CARDS WITH TAPE ==================== */

.sb-testimonials-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}
.sb-testimonial-card {
  background: var(--sb-paper);
  border: 2px solid var(--sb-text);
  border-radius: 4px;
  padding: 36px 24px 24px;
  position: relative;
  transition: all 0.3s ease;
  box-shadow: 3px 3px 0 var(--sb-shadow);
}
.sb-testimonial-card:nth-child(1) { transform: rotate(-1.5deg); }
.sb-testimonial-card:nth-child(2) { transform: rotate(1deg); }
.sb-testimonial-card:nth-child(3) { transform: rotate(-0.8deg); }
.sb-testimonial-card:hover {
  transform: rotate(0deg) translateY(-4px) !important;
  box-shadow: 4px 8px 12px var(--sb-shadow);
}

/* Scotch tape effect */
.sb-testimonial-card::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(1deg);
  width: 90px;
  height: 22px;
  background: linear-gradient(
    180deg,
    rgba(255, 248, 220, 0.85) 0%,
    rgba(255, 248, 220, 0.6) 100%
  );
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 1px 3px var(--sb-tape-shadow);
  animation: sbTapeShimmer 4s ease-in-out infinite;
  z-index: 2;
}
.sb-testimonial-card:nth-child(2)::before { transform: translateX(-50%) rotate(-2deg); }
.sb-testimonial-card:nth-child(3)::before { transform: translateX(-50%) rotate(3deg); width: 100px; }

.sb-testimonial-stars {
  display: flex;
  gap: 3px;
  margin-bottom: 12px;
  color: var(--sb-yellow);
}
.sb-testimonial-text {
  font-size: 1.05rem;
  line-height: 1.65;
  color: var(--sb-text);
  margin-bottom: 18px;
  font-style: italic;
}
.sb-testimonial-author {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sb-testimonial-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid var(--sb-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 0.95rem;
  color: #fff;
  box-shadow: 2px 2px 0 var(--sb-shadow);
}
.sb-testimonial-card:nth-child(1) .sb-testimonial-avatar { background: var(--sb-red); }
.sb-testimonial-card:nth-child(2) .sb-testimonial-avatar { background: var(--sb-blue); }
.sb-testimonial-card:nth-child(3) .sb-testimonial-avatar { background: var(--sb-purple); }
.sb-testimonial-name {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--sb-text);
}
.sb-testimonial-role {
  font-size: 0.9rem;
  color: var(--sb-text-light);
}

/* ==================== CTA - POSTCARD ==================== */

.sb-cta { padding: 80px 0; }
.sb-cta-box {
  background: var(--sb-paper);
  border: 3px solid var(--sb-text);
  border-radius: 6px;
  padding: 60px 40px;
  text-align: center;
  position: relative;
  overflow: hidden;
  box-shadow: 5px 6px 0 var(--sb-shadow-strong);
  /* Postcard dots pattern */
  background-image:
    radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px);
  background-size: 12px 12px;
}
/* Stamp corner decoration */
.sb-cta-box::before {
  content: '';
  position: absolute;
  top: 16px;
  right: 16px;
  width: 64px;
  height: 76px;
  border: 3px solid var(--sb-red);
  border-radius: 4px;
  opacity: 0.25;
}
.sb-cta-box::after {
  content: 'FIRST CLASS';
  position: absolute;
  top: 30px;
  right: 22px;
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 0.65rem;
  color: var(--sb-red);
  opacity: 0.25;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.sb-cta-box h2 {
  font-size: 2.6rem;
  color: var(--sb-text);
  margin-bottom: 16px;
  position: relative;
  z-index: 2;
}
.sb-cta-box p {
  color: var(--sb-text-light);
  font-size: 1.15rem;
  margin-bottom: 32px;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
  z-index: 2;
  line-height: 1.6;
}
.sb-cta-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  position: relative;
  z-index: 2;
  flex-wrap: wrap;
}
/* Decorative washi strips in CTA */
.sb-cta-washi-1 {
  position: absolute;
  top: 0;
  left: -20px;
  width: 180px;
  height: 20px;
  background: repeating-linear-gradient(
    -45deg,
    rgba(46,204,113,0.3),
    rgba(46,204,113,0.3) 5px,
    transparent 5px,
    transparent 10px
  );
  transform: rotate(-12deg);
}
.sb-cta-washi-2 {
  position: absolute;
  bottom: 20px;
  right: -30px;
  width: 200px;
  height: 20px;
  background: repeating-linear-gradient(
    45deg,
    rgba(155,89,182,0.3),
    rgba(155,89,182,0.3) 5px,
    transparent 5px,
    transparent 10px
  );
  transform: rotate(8deg);
}

/* ==================== FOOTER ==================== */

.sb-footer {
  padding: 48px 0 28px;
  position: relative;
}
/* Notebook margin hole dots */
.sb-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--sb-text);
  opacity: 0.15;
}
.sb-footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 40px;
  flex-wrap: wrap;
}
.sb-footer-brand { max-width: 280px; }
.sb-footer-brand-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  text-decoration: none;
}
.sb-footer-brand-logo img {
  height: 36px;
  width: auto;
  border: 2px solid var(--sb-text);
  border-radius: 3px;
  padding: 2px;
  background: #fff;
}
.sb-footer-brand-logo span {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 1.3rem;
  color: var(--sb-text);
}
.sb-footer-brand p {
  color: var(--sb-text-light);
  font-size: 0.95rem;
  line-height: 1.6;
}
.sb-footer-col h4 {
  font-size: 1.15rem;
  color: var(--sb-text);
  margin-bottom: 12px;
}
.sb-footer-col a {
  display: block;
  color: var(--sb-text-light);
  text-decoration: none;
  font-size: 0.95rem;
  margin-bottom: 8px;
  transition: color 0.2s;
}
.sb-footer-col a:hover { color: var(--sb-red); }
.sb-footer-bottom {
  text-align: center;
  margin-top: 40px;
  padding-top: 20px;
  color: var(--sb-text-light);
  font-size: 0.85rem;
  position: relative;
}
.sb-footer-bottom::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 16px;
  background: repeating-linear-gradient(
    -45deg,
    var(--sb-yellow),
    var(--sb-yellow) 5px,
    transparent 5px,
    transparent 10px
  );
  opacity: 0.35;
  border-radius: 2px;
}

/* ==================== MOBILE TOGGLE ==================== */

.sb-mobile-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}
.sb-mobile-toggle span {
  display: block;
  width: 26px;
  height: 3px;
  background: var(--sb-text);
  border-radius: 2px;
  margin: 5px 0;
  transition: all 0.3s;
}
.sb-mobile-menu { display: none; }

/* ==================== RESPONSIVE ==================== */

@media (max-width: 1024px) {
  .sb-hero-text h1 { font-size: 3rem; }
  .sb-polaroid img { width: 220px; }
  .sb-features-grid { gap: 24px; }
  .sb-section-title { font-size: 2.4rem; }
}
@media (max-width: 768px) {
  .sb-nav-tabs,
  .sb-nav-auth { display: none; }
  .sb-mobile-toggle { display: block; }
  .sb-mobile-menu {
    display: none;
    position: absolute;
    top: 72px;
    left: 0;
    right: 0;
    background: var(--sb-paper);
    border-bottom: 3px solid var(--sb-text);
    padding: 20px 24px;
    z-index: 99;
    box-shadow: 0 8px 20px var(--sb-shadow);
  }
  .sb-mobile-menu.open { display: block; }
  .sb-mobile-menu a {
    display: block;
    padding: 12px 0;
    font-family: 'Patrick Hand', cursive;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--sb-text);
    text-decoration: none;
    border-bottom: 1px dashed rgba(0,0,0,0.1);
  }
  .sb-mobile-menu a:last-child { border-bottom: none; }
  .sb-mobile-menu-auth {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 2px solid rgba(0,0,0,0.1);
  }
  .sb-hero-inner {
    flex-direction: column-reverse;
    text-align: center;
    gap: 32px;
  }
  .sb-hero-text h1 { font-size: 2.5rem; }
  .sb-hero-text p { margin: 0 auto 28px; }
  .sb-hero-ctas { justify-content: center; }
  .sb-polaroid img { width: 200px; }
  .sb-features-grid { grid-template-columns: 1fr; }
  .sb-sticky-note { transform: rotate(0deg) !important; }
  .sb-how-steps {
    flex-direction: column;
    align-items: center;
    gap: 28px;
  }
  .sb-pricing-grid {
    grid-template-columns: 1fr;
    max-width: 400px;
    margin: 0 auto;
  }
  .sb-pricing-card--pro { transform: none; }
  .sb-pricing-card--pro:hover { transform: translateY(-6px); }
  .sb-testimonials-grid {
    grid-template-columns: 1fr;
    max-width: 440px;
    margin: 0 auto;
  }
  .sb-testimonial-card { transform: rotate(0deg) !important; }
  .sb-stats-inner { gap: 20px; }
  .sb-stat-badge {
    width: 110px;
    height: 110px;
  }
  .sb-stat-num { font-size: 1.5rem; }
  .sb-cta-box { padding: 40px 24px; }
  .sb-cta-box h2 { font-size: 2rem; }
  .sb-section { padding: 60px 0; }
  .sb-section-title { font-size: 2rem; }
  .sb-footer-inner {
    flex-direction: column;
    text-align: center;
    align-items: center;
  }
  .sb-footer-brand { text-align: center; }
}
@media (max-width: 480px) {
  .sb-hero-text h1 { font-size: 2rem; }
  .sb-hero-ctas { flex-direction: column; align-items: center; }
  .sb-stat-badge {
    width: 90px;
    height: 90px;
  }
  .sb-stat-num { font-size: 1.3rem; }
  .sb-stat-label { font-size: 0.8rem; }
  .sb-stats-inner { gap: 14px; }
  .sb-cta-buttons { flex-direction: column; align-items: center; }
  .sb-section { padding: 48px 0; }
  .sb-section-title { font-size: 1.75rem; }
  .sb-how-step { max-width: 100%; }
}
`;

const LandingDesign8: React.FC = () => {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const animRef = useRef<HTMLDivElement>(null);

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

  // Scroll-triggered animation with IntersectionObserver
  useEffect(() => {
    const root = animRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('sticker-visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    const elements = root.querySelectorAll('.sb-anim');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const features = [
    { icon: <Brain size={24} />, title: 'AI-Powered Quizzes', desc: 'Upload any document and watch our AI instantly create interactive quizzes tailored to your material. Study smarter, not harder.', color: 'red' as const },
    { icon: <Zap size={24} />, title: 'Smart Flashcards', desc: 'Auto-generated flashcards with spaced repetition. Our algorithm ensures you review at the perfect moment for long-term memory.', color: 'yellow' as const },
    { icon: <Target size={24} />, title: 'AI Tutor Chat', desc: 'Ask questions, get explanations, and dive deeper into any topic. Your personal tutor available 24/7, always patient and helpful.', color: 'blue' as const },
    { icon: <Users size={24} />, title: 'Share & Compete', desc: 'Send quizzes and flashcards to friends. Challenge classmates and climb the leaderboard together. Learning is better with friends.', color: 'purple' as const },
  ];

  const stats = [
    { num: '10,000+', label: 'Learners' },
    { num: '500K+', label: 'Quizzes' },
    { num: '95%', label: 'Pass Rate' },
    { num: '4.9', label: 'Rating' },
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
    if (variant === 'free') return 'green';
    if (variant === 'pro') return 'red';
    return 'purple';
  };

  const DoodleUnderline = ({ color }: { color: string }) => (
    <svg viewBox="0 0 200 12" preserveAspectRatio="none">
      <path
        d="M2 8 C30 2, 50 12, 80 6 C110 0, 140 10, 170 4 C185 2, 195 8, 198 6"
        stroke={color}
      />
    </svg>
  );

  return (
    <div className="sticker-landing" ref={animRef}>
      <style>{STYLES}</style>

      {/* ==================== NAV ==================== */}
      <nav className="sb-nav">
        <div className="sb-container sb-nav-inner">
          <a href="#" className="sb-nav-logo">
            <img src={BrainLiftLogo} alt="BrainLift Logo" />
            <span>BrainLift</span>
          </a>
          <ul className="sb-nav-tabs">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#testimonials">Reviews</a></li>
          </ul>
          <div className="sb-nav-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="sb-btn sb-btn-outline sb-btn-sm">Log In</Link>
                <Link to="/auth/register" className="sb-btn sb-btn-red sb-btn-sm">Sign Up Free</Link>
              </>
            ) : (
              <>
                <span className="sb-btn sb-btn-outline sb-btn-sm sb-btn-disabled"><Lock size={14} /> Log In</span>
                <span className="sb-btn sb-btn-red sb-btn-sm sb-btn-disabled"><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
          <button
            className="sb-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
        <div className={`sb-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={closeMobileMenu}>Features</a>
          <a href="#how-it-works" onClick={closeMobileMenu}>How It Works</a>
          <a href="#pricing" onClick={closeMobileMenu}>Pricing</a>
          <a href="#testimonials" onClick={closeMobileMenu}>Reviews</a>
          <div className="sb-mobile-menu-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="sb-btn sb-btn-outline sb-btn-sm" style={{ flex: 1 }}>Log In</Link>
                <Link to="/auth/register" className="sb-btn sb-btn-red sb-btn-sm" style={{ flex: 1 }}>Sign Up Free</Link>
              </>
            ) : (
              <>
                <span className="sb-btn sb-btn-outline sb-btn-sm sb-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Log In</span>
                <span className="sb-btn sb-btn-red sb-btn-sm sb-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Sign Up</span>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ==================== HERO ==================== */}
      <section className="sb-hero">
        <div className="sb-container sb-hero-inner">
          <div className="sb-hero-text">
            <h1>
              <span className="sb-highlight-red sb-doodle-underline">
                Craft
                <DoodleUnderline color="var(--sb-red)" />
              </span>{' '}
              your perfect<br />
              study adventure!
            </h1>
            <p>
              Transform any document into quizzes, flashcards, and study materials
              with AI. Your personal scrapbook of knowledge, lovingly assembled.
            </p>
            <div className="sb-hero-ctas">
              {isWebLoginEnabled ? (
                <>
                  <Link to="/auth/register" className="sb-btn sb-btn-red sb-btn-lg">
                    Start Learning Free <ArrowRight size={18} />
                  </Link>
                  <a
                    href="https://apps.apple.com/app/brainlift"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sb-btn sb-btn-outline sb-btn-lg"
                  >
                    <Bookmark size={18} /> Get the App
                  </a>
                </>
              ) : (
                <>
                  <span className="sb-btn sb-btn-red sb-btn-lg sb-btn-disabled">
                    <Lock size={18} /> Coming Soon
                  </span>
                  <a
                    href="https://apps.apple.com/app/brainlift"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sb-btn sb-btn-outline sb-btn-lg"
                  >
                    <Bookmark size={18} /> Get the App
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="sb-hero-visual">
            <div className="sb-polaroid">
              <img src={BrainLiftLogo} alt="BrainLift brain mascot lifting a barbell" />
              <div className="sb-polaroid-caption">BrainLift HQ</div>
            </div>
            <div className="sb-hero-sticker sb-hero-sticker-1">
              <Star size={32} fill="currentColor" />
            </div>
            <div className="sb-hero-sticker sb-hero-sticker-2">
              <Sparkles size={28} />
            </div>
            <div className="sb-hero-sticker sb-hero-sticker-3">
              <PenTool size={24} />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== STATS ==================== */}
      <section className="sb-stats">
        <div className="sb-container sb-stats-inner">
          {stats.map((stat, i) => (
            <div className="sb-stat-badge sb-anim" key={i} style={{ transitionDelay: `${i * 100}ms` }}>
              <span className="sb-stat-num">{stat.num}</span>
              <span className="sb-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="sb-washi-divider" />

      {/* ==================== FEATURES ==================== */}
      <section className="sb-section" id="features">
        <div className="sb-container">
          <h2 className="sb-section-title sb-anim">
            <span className="sb-doodle-underline">
              Everything you need
              <DoodleUnderline color="var(--sb-blue)" />
            </span>
          </h2>
          <p className="sb-section-subtitle sb-anim">
            Powerful AI tools wrapped in a lovingly crafted experience. Stick them in your study book and watch the magic happen.
          </p>
          <div className="sb-features-grid">
            {features.map((feat, i) => (
              <div
                className={`sb-sticky-note sb-sticky-note--${feat.color} sb-anim`}
                key={i}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`sb-sticky-icon sb-sticky-icon--${feat.color}`}>{feat.icon}</div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sb-washi-divider sb-washi-divider--blue" />

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="sb-section" id="how-it-works">
        <div className="sb-container">
          <h2 className="sb-section-title sb-anim">
            <span className="sb-doodle-underline">
              How it works
              <DoodleUnderline color="var(--sb-green)" />
            </span>
          </h2>
          <p className="sb-section-subtitle sb-anim">
            Three simple steps to transform any material into your personal study companion.
          </p>
          <div className="sb-how-steps">
            {steps.map((step, i) => (
              <div className="sb-how-step sb-anim" key={i} style={{ transitionDelay: `${i * 120}ms` }}>
                <div className="sb-how-number">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sb-washi-divider sb-washi-divider--red" />

      {/* ==================== PRICING ==================== */}
      <section className="sb-section" id="pricing">
        <div className="sb-container">
          <h2 className="sb-section-title sb-anim">
            <span className="sb-doodle-underline">
              Pick your plan
              <DoodleUnderline color="var(--sb-purple)" />
            </span>
          </h2>
          <p className="sb-section-subtitle sb-anim">
            Start free and upgrade when you are ready. No credit card required.
          </p>
          <div className="sb-pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div className={`sb-pricing-card sb-pricing-card--${plan.variant} sb-anim`} key={i} style={{ transitionDelay: `${i * 100}ms` }}>
                {plan.variant === 'pro' && (
                  <div className="sb-pricing-stamp">
                    <Star size={14} fill="currentColor" /> MOST POPULAR
                  </div>
                )}
                {plan.variant === 'free' && <span className="sb-pricing-free-tag">FREE</span>}
                <div className="sb-pricing-name">{plan.name}</div>
                <div className="sb-pricing-price">
                  {plan.price}
                  {plan.period && <span>{plan.period}</span>}
                </div>
                <ul className="sb-pricing-features">
                  {plan.features.map((feat, j) => (
                    <li key={j}>
                      <span className={`sb-pricing-check sb-pricing-check--${checkColor(plan.variant)}`}>
                        <Check size={13} />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                {isWebLoginEnabled ? (
                  <Link
                    to="/auth/register"
                    className={`sb-btn ${plan.variant === 'pro' ? 'sb-btn-red' : plan.variant === 'team' ? 'sb-btn-purple' : 'sb-btn-green'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {plan.variant === 'free' ? 'Get Started' : plan.variant === 'pro' ? 'Go Pro' : 'Contact Us'}
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <span
                    className={`sb-btn ${plan.variant === 'pro' ? 'sb-btn-red' : plan.variant === 'team' ? 'sb-btn-purple' : 'sb-btn-green'} sb-btn-disabled`}
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

      <div className="sb-washi-divider sb-washi-divider--green" />

      {/* ==================== TESTIMONIALS ==================== */}
      <section className="sb-section" id="testimonials">
        <div className="sb-container">
          <h2 className="sb-section-title sb-anim">
            <span className="sb-doodle-underline">
              Loved by learners
              <DoodleUnderline color="var(--sb-red)" />
            </span>
          </h2>
          <p className="sb-section-subtitle sb-anim">
            Join thousands of students and educators who have stuck BrainLift into their daily study routine.
          </p>
          <div className="sb-testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="sb-testimonial-card sb-anim" key={i} style={{ transitionDelay: `${i * 120}ms` }}>
                <div className="sb-testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="sb-testimonial-text">&ldquo;{t.text}&rdquo;</p>
                <div className="sb-testimonial-author">
                  <div className="sb-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="sb-testimonial-name">{t.name}</div>
                    <div className="sb-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="sb-washi-divider sb-washi-divider--purple" />

      {/* ==================== CTA ==================== */}
      <section className="sb-cta">
        <div className="sb-container">
          <div className="sb-cta-box sb-anim">
            <div className="sb-cta-washi-1" />
            <div className="sb-cta-washi-2" />
            <h2>Ready to fill your study book?</h2>
            <p>
              Join 10,000+ learners who are already crafting their knowledge with BrainLift.
              It is free to start -- no credit card needed.
            </p>
            <div className="sb-cta-buttons">
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="sb-btn sb-btn-red sb-btn-lg">
                  Create Free Account <ArrowRight size={18} />
                </Link>
              ) : (
                <span className="sb-btn sb-btn-red sb-btn-lg sb-btn-disabled">
                  <Lock size={18} /> Coming Soon
                </span>
              )}
              <a
                href="https://apps.apple.com/app/brainlift"
                target="_blank"
                rel="noopener noreferrer"
                className="sb-btn sb-btn-yellow sb-btn-lg"
              >
                Download App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="sb-footer">
        <div className="sb-container">
          <div className="sb-footer-inner">
            <div className="sb-footer-brand">
              <a href="#" className="sb-footer-brand-logo">
                <img src={BrainLiftLogo} alt="BrainLift" />
                <span>BrainLift</span>
              </a>
              <p>
                Your lovingly crafted study companion. Upload your materials, let AI do the heavy
                lifting, and stick new knowledge into your brain every day.
              </p>
            </div>
            <div className="sb-footer-col">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#testimonials">Reviews</a>
            </div>
            <div className="sb-footer-col">
              <h4>Download</h4>
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer">iOS App</a>
              <a href="https://play.google.com/store/apps/details?id=com.brainlift.app" target="_blank" rel="noopener noreferrer">Android App</a>
            </div>
            <div className="sb-footer-col">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
            </div>
          </div>
          <div className="sb-footer-bottom">
            &copy; {new Date().getFullYear()} BrainLift. All rights reserved. Crafted with care for learners everywhere.
          </div>
        </div>
      </footer>
      <DesignSwitcher />
    </div>
  );
};

export default LandingDesign8;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { featureFlagsService } from '@/services/featureFlags.service';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';
import { Lock, ArrowRight, Star, Check, Zap, Brain, Target, Users, Sparkles, TreePine, Compass, Mountain } from 'lucide-react';
import { DesignSwitcher } from '@/components/DesignSwitcher';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Outfit:wght@400;500;600;700&display=swap');

:root {
  --nature-bg: #FDF6E3;
  --nature-card: #FFFDF7;
  --nature-text: #2C2C2C;
  --nature-text-muted: #6B6B6B;
  --nature-forest: #2D6A4F;
  --nature-brown: #8B4513;
  --nature-sunset: #E76F51;
  --nature-sky: #48CAE4;
  --nature-berry: #D62828;
  --nature-gold: #E9C46A;
  --nature-shadow: rgba(45, 106, 79, 0.12);
  --nature-radius: 16px;
  --nature-radius-btn: 12px;
  --nature-radius-pill: 999px;
}

@keyframes leafFall1 {
  0% { transform: translate(0, -10%) rotate(0deg); opacity: 0; }
  10% { opacity: 0.7; }
  90% { opacity: 0.7; }
  100% { transform: translate(80px, 110vh) rotate(360deg); opacity: 0; }
}
@keyframes leafFall2 {
  0% { transform: translate(0, -10%) rotate(15deg); opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.6; }
  100% { transform: translate(-60px, 110vh) rotate(-300deg); opacity: 0; }
}
@keyframes leafFall3 {
  0% { transform: translate(0, -10%) rotate(-10deg); opacity: 0; }
  10% { opacity: 0.5; }
  90% { opacity: 0.5; }
  100% { transform: translate(40px, 110vh) rotate(420deg); opacity: 0; }
}
@keyframes trailFill {
  from { width: 0%; }
  to { width: 72%; }
}
@keyframes compassSpin {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(15deg); }
  75% { transform: rotate(-15deg); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes campfireGlow {
  0%, 100% { box-shadow: 0 0 40px rgba(231, 111, 81, 0.3), 0 0 80px rgba(233, 196, 106, 0.15); }
  50% { box-shadow: 0 0 60px rgba(231, 111, 81, 0.45), 0 0 120px rgba(233, 196, 106, 0.25); }
}
@keyframes sway {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes trailDash {
  to { stroke-dashoffset: -20; }
}

.nature-landing * { box-sizing: border-box; margin: 0; padding: 0; }
.nature-landing {
  font-family: 'Outfit', sans-serif;
  background: var(--nature-bg);
  color: var(--nature-text);
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
  background-image:
    repeating-radial-gradient(circle at 20% 50%, transparent 0, transparent 40px, rgba(45,106,79,0.018) 40px, rgba(45,106,79,0.018) 41px, transparent 41px),
    repeating-radial-gradient(circle at 80% 30%, transparent 0, transparent 55px, rgba(139,69,19,0.015) 55px, rgba(139,69,19,0.015) 56px, transparent 56px),
    repeating-radial-gradient(circle at 50% 80%, transparent 0, transparent 70px, rgba(45,106,79,0.012) 70px, rgba(45,106,79,0.012) 71px, transparent 71px);
}
.nature-landing h1,
.nature-landing h2,
.nature-landing h3,
.nature-landing h4 {
  font-family: 'Lilita One', cursive;
  font-weight: 400;
}
.nt-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

/* Falling Leaves */
.nt-leaf {
  position: fixed;
  z-index: 0;
  pointer-events: none;
  width: 16px;
  height: 16px;
  border-radius: 0 50% 50% 50%;
  opacity: 0;
}
.nt-leaf-1 { background: var(--nature-forest); top: -20px; left: 8%; animation: leafFall1 8s linear infinite; animation-delay: 0s; }
.nt-leaf-2 { background: var(--nature-gold); top: -20px; left: 22%; animation: leafFall2 11s linear infinite; animation-delay: 2s; width: 12px; height: 12px; }
.nt-leaf-3 { background: var(--nature-sunset); top: -20px; left: 45%; animation: leafFall3 9s linear infinite; animation-delay: 4s; width: 14px; height: 14px; }
.nt-leaf-4 { background: var(--nature-brown); top: -20px; left: 62%; animation: leafFall1 12s linear infinite; animation-delay: 1s; width: 10px; height: 10px; }
.nt-leaf-5 { background: var(--nature-forest); top: -20px; left: 78%; animation: leafFall2 10s linear infinite; animation-delay: 5s; width: 18px; height: 18px; }
.nt-leaf-6 { background: var(--nature-gold); top: -20px; left: 90%; animation: leafFall3 13s linear infinite; animation-delay: 3s; }
.nt-leaf-7 { background: var(--nature-berry); top: -20px; left: 35%; animation: leafFall1 14s linear infinite; animation-delay: 7s; width: 11px; height: 11px; }
.nt-leaf-8 { background: var(--nature-sunset); top: -20px; left: 55%; animation: leafFall2 9.5s linear infinite; animation-delay: 6s; width: 13px; height: 13px; }

/* Navigation - Ranger Station */
.nt-nav {
  position: sticky; top: 0; z-index: 100;
  background: linear-gradient(180deg, #F5E6C8 0%, #EDD9B5 100%);
  border-bottom: 4px solid var(--nature-brown);
  box-shadow: 0 3px 12px rgba(139, 69, 19, 0.15);
}
.nt-nav::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 60px,
    rgba(139, 69, 19, 0.04) 60px,
    rgba(139, 69, 19, 0.04) 61px
  );
  pointer-events: none;
}
.nt-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 72px; position: relative; z-index: 2; }
.nt-nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.nt-nav-logo img { height: 46px; width: auto; animation: float 3s ease-in-out infinite; }
.nt-nav-logo span { font-family: 'Lilita One', cursive; font-weight: 400; font-size: 1.5rem; color: var(--nature-forest); }
.nt-nav-links { display: flex; align-items: center; gap: 28px; list-style: none; }
.nt-nav-links a {
  text-decoration: none; font-weight: 600; color: var(--nature-brown);
  transition: color 0.2s; font-size: 0.95rem; position: relative;
}
.nt-nav-links a:hover { color: var(--nature-forest); }
.nt-nav-links a::after {
  content: ''; position: absolute; bottom: -4px; left: 0; right: 0;
  height: 2px; background: var(--nature-forest); transform: scaleX(0);
  transition: transform 0.2s; border-radius: 2px;
}
.nt-nav-links a:hover::after { transform: scaleX(1); }
.nt-nav-auth { display: flex; align-items: center; gap: 12px; }

/* Buttons */
.nt-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Lilita One', cursive; font-weight: 400; font-size: 1rem;
  padding: 12px 24px; border-radius: var(--nature-radius-btn);
  border: 2px solid var(--nature-brown); cursor: pointer;
  transition: all 0.2s ease; text-decoration: none; white-space: nowrap;
}
.nt-btn:hover { transform: translateY(-2px); }
.nt-btn:active { transform: translateY(1px); }
.nt-btn-forest { background: var(--nature-forest); color: #fff; box-shadow: 3px 3px 0px #1B4332; }
.nt-btn-forest:hover { box-shadow: 2px 5px 0px #1B4332; }
.nt-btn-sunset { background: var(--nature-sunset); color: #fff; box-shadow: 3px 3px 0px #9B2915; }
.nt-btn-sunset:hover { box-shadow: 2px 5px 0px #9B2915; }
.nt-btn-gold { background: var(--nature-gold); color: var(--nature-brown); box-shadow: 3px 3px 0px #B8941E; }
.nt-btn-gold:hover { box-shadow: 2px 5px 0px #B8941E; }
.nt-btn-outline { background: transparent; color: var(--nature-brown); border-color: var(--nature-brown); box-shadow: none; }
.nt-btn-outline:hover { background: rgba(45, 106, 79, 0.06); }
.nt-btn-disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
.nt-btn-sm { padding: 8px 16px; font-size: 0.875rem; }
.nt-btn-lg { padding: 16px 36px; font-size: 1.15rem; }

/* Hero */
.nt-hero { padding: 80px 0 60px; position: relative; z-index: 1; }
.nt-hero-inner { display: flex; align-items: center; gap: 60px; }
.nt-hero-text { flex: 1; animation: fadeInUp 0.7s ease-out; }
.nt-hero-text h1 { font-size: 3.5rem; line-height: 1.15; color: var(--nature-forest); margin-bottom: 20px; }
.nt-hero-text h1 .nt-highlight {
  color: var(--nature-sunset); position: relative; display: inline-block;
}
.nt-hero-text h1 .nt-highlight::after {
  content: ''; position: absolute; bottom: 4px; left: -4px; right: -4px;
  height: 10px; background: var(--nature-gold); z-index: -1; border-radius: 4px; opacity: 0.5;
}
.nt-hero-text p { font-size: 1.2rem; color: var(--nature-text-muted); line-height: 1.7; margin-bottom: 32px; max-width: 520px; }
.nt-hero-ctas { display: flex; gap: 16px; margin-bottom: 40px; flex-wrap: wrap; }

/* Hero Visual / Compass */
.nt-hero-visual { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; animation: fadeInUp 0.7s ease-out 0.2s both; }
.nt-hero-logo-wrap { position: relative; z-index: 2; }
.nt-hero-logo-wrap img { width: 280px; height: auto; animation: float 3s ease-in-out infinite; filter: drop-shadow(4px 4px 0px rgba(45,106,79,0.15)); }
.nt-compass-ring {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 340px; height: 340px; border-radius: 50%;
  border: 3px dashed var(--nature-forest); opacity: 0.2;
  animation: compassSpin 6s ease-in-out infinite;
}
.nt-compass-ring::before {
  content: 'N'; position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  font-family: 'Lilita One', cursive; font-size: 1rem; color: var(--nature-forest); opacity: 1;
}
.nt-deco-tree { position: absolute; z-index: 1; color: var(--nature-forest); animation: sway 3s ease-in-out infinite; opacity: 0.3; }
.nt-deco-tree-1 { top: -10px; right: -20px; animation-delay: 0s; }
.nt-deco-tree-2 { bottom: 10px; left: -30px; animation-delay: 0.5s; }
.nt-deco-mtn { position: absolute; z-index: 1; color: var(--nature-brown); opacity: 0.2; }
.nt-deco-mtn-1 { bottom: -20px; right: 30px; animation: float 4s ease-in-out infinite; }

/* Trail Progress Bar */
.nt-trail-bar-wrap { max-width: 480px; }
.nt-trail-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.nt-trail-label span { font-family: 'Lilita One', cursive; font-size: 0.9rem; color: var(--nature-forest); }
.nt-trail-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--nature-gold); border: 2px solid var(--nature-brown);
  border-radius: var(--nature-radius-pill); padding: 2px 12px; font-size: 0.8rem;
  font-family: 'Lilita One', cursive; color: var(--nature-brown);
}
.nt-trail-track {
  height: 20px; background: #D4C5A9; border-radius: var(--nature-radius-pill);
  border: 2px solid var(--nature-brown); overflow: hidden; position: relative;
}
.nt-trail-fill {
  height: 100%; border-radius: var(--nature-radius-pill);
  background: linear-gradient(90deg, var(--nature-forest), var(--nature-gold));
  animation: trailFill 1.8s ease-out 0.5s both; position: relative;
}
.nt-trail-fill::after {
  content: ''; position: absolute; top: 3px; left: 8px; right: 8px;
  height: 5px; background: rgba(255,255,255,0.3); border-radius: var(--nature-radius-pill);
}
.nt-trail-hint { margin-top: 6px; font-size: 0.8rem; color: var(--nature-text-muted); font-style: italic; }

/* Mountain Divider */
.nt-mountain-divider {
  width: 100%; height: 60px; position: relative; z-index: 1; overflow: hidden;
}
.nt-mountain-divider svg { display: block; width: 100%; height: 100%; }

/* Section */
.nt-section { padding: 80px 0; position: relative; z-index: 1; }
.nt-section-title { text-align: center; margin-bottom: 12px; font-size: 2.4rem; color: var(--nature-forest); }
.nt-section-subtitle {
  text-align: center; color: var(--nature-text-muted); font-size: 1.1rem;
  margin-bottom: 48px; max-width: 560px; margin-left: auto; margin-right: auto; line-height: 1.6;
}

/* Stats - Trail Marker Signs */
.nt-stats { padding: 48px 0; position: relative; z-index: 1; }
.nt-stats-inner { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
.nt-stat-sign {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 16px 28px; border-radius: 8px;
  background: linear-gradient(180deg, #C4956A 0%, #A0744D 100%);
  border: 3px solid var(--nature-brown); color: #fff;
  font-family: 'Lilita One', cursive; position: relative;
  box-shadow: 3px 3px 0px rgba(0,0,0,0.2);
  animation: fadeInUp 0.6s ease-out both;
  min-width: 140px;
}
.nt-stat-sign::after {
  content: ''; position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
  width: 8px; height: 16px; background: var(--nature-brown); border-radius: 0 0 2px 2px;
}
.nt-stat-sign:nth-child(1) { animation-delay: 0s; transform: rotate(-2deg); }
.nt-stat-sign:nth-child(2) { animation-delay: 0.1s; transform: rotate(1deg); }
.nt-stat-sign:nth-child(3) { animation-delay: 0.2s; transform: rotate(-1deg); }
.nt-stat-sign:nth-child(4) { animation-delay: 0.3s; transform: rotate(2deg); }
.nt-stat-num { font-size: 1.5rem; letter-spacing: 0.5px; }
.nt-stat-label { font-size: 0.8rem; opacity: 0.85; font-family: 'Outfit', sans-serif; font-weight: 600; }

/* Features - Scout Badge Cards */
.nt-features-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
.nt-feature-badge-card {
  background: var(--nature-card); border: 3px solid var(--nature-brown);
  border-radius: var(--nature-radius); padding: 32px; transition: all 0.2s ease;
  position: relative; overflow: hidden;
}
.nt-feature-badge-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
}
.nt-feature-badge-card:hover { transform: translateY(-4px); }
.nt-feature-badge-card--forest { box-shadow: 4px 4px 0px var(--nature-forest); }
.nt-feature-badge-card--forest::before { background: var(--nature-forest); }
.nt-feature-badge-card--forest:hover { box-shadow: 2px 8px 0px var(--nature-forest); }
.nt-feature-badge-card--gold { box-shadow: 4px 4px 0px var(--nature-gold); }
.nt-feature-badge-card--gold::before { background: var(--nature-gold); }
.nt-feature-badge-card--gold:hover { box-shadow: 2px 8px 0px var(--nature-gold); }
.nt-feature-badge-card--sunset { box-shadow: 4px 4px 0px var(--nature-sunset); }
.nt-feature-badge-card--sunset::before { background: var(--nature-sunset); }
.nt-feature-badge-card--sunset:hover { box-shadow: 2px 8px 0px var(--nature-sunset); }
.nt-feature-badge-card--sky { box-shadow: 4px 4px 0px var(--nature-sky); }
.nt-feature-badge-card--sky::before { background: var(--nature-sky); }
.nt-feature-badge-card--sky:hover { box-shadow: 2px 8px 0px var(--nature-sky); }

.nt-badge-icon {
  width: 60px; height: 60px; border-radius: 50%;
  border: 3px solid var(--nature-brown); display: flex; align-items: center;
  justify-content: center; margin-bottom: 16px; position: relative;
}
.nt-badge-icon::after {
  content: ''; position: absolute; inset: -6px; border-radius: 50%;
  border: 2px dashed; opacity: 0.3;
}
.nt-badge-icon--forest { background: var(--nature-forest); color: #fff; }
.nt-badge-icon--forest::after { border-color: var(--nature-forest); }
.nt-badge-icon--gold { background: var(--nature-gold); color: var(--nature-brown); }
.nt-badge-icon--gold::after { border-color: var(--nature-gold); }
.nt-badge-icon--sunset { background: var(--nature-sunset); color: #fff; }
.nt-badge-icon--sunset::after { border-color: var(--nature-sunset); }
.nt-badge-icon--sky { background: var(--nature-sky); color: #fff; }
.nt-badge-icon--sky::after { border-color: var(--nature-sky); }

.nt-feature-badge-card h3 { font-size: 1.25rem; margin-bottom: 8px; color: var(--nature-forest); }
.nt-feature-badge-card p { color: var(--nature-text-muted); line-height: 1.65; font-size: 0.95rem; }
.nt-feature-tag {
  position: absolute; top: 16px; right: 16px;
  font-family: 'Lilita One', cursive; font-size: 0.7rem; padding: 3px 10px;
  border-radius: var(--nature-radius-pill); border: 2px solid var(--nature-brown);
  animation: sway 2s ease-in-out infinite;
}
.nt-tag-new { background: var(--nature-berry); color: #fff; }
.nt-tag-popular { background: var(--nature-gold); color: var(--nature-brown); }

/* How It Works - Hiking Trail */
.nt-how { position: relative; }
.nt-how-trail { display: flex; justify-content: center; gap: 40px; position: relative; }
.nt-how-trail-path { position: absolute; top: 40px; left: 50%; transform: translateX(-50%); width: 60%; height: 4px; z-index: 0; }
.nt-how-trail-path-line {
  width: 100%; height: 100%;
  border-top: 4px dashed var(--nature-forest); opacity: 0.35;
}
.nt-how-waypoint { flex: 1; max-width: 300px; text-align: center; position: relative; z-index: 2; }
.nt-waypoint-marker {
  width: 70px; height: 70px; border-radius: 50%;
  border: 4px solid var(--nature-brown); display: flex; align-items: center;
  justify-content: center; font-family: 'Lilita One', cursive; font-size: 1.5rem;
  margin: 0 auto 16px; color: #fff; position: relative;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.nt-waypoint-marker::after {
  content: ''; position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%);
  width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent;
}
.nt-how-waypoint:nth-child(2) .nt-waypoint-marker { background: var(--nature-forest); }
.nt-how-waypoint:nth-child(2) .nt-waypoint-marker::after { border-top: 10px solid var(--nature-forest); }
.nt-how-waypoint:nth-child(3) .nt-waypoint-marker { background: var(--nature-sunset); }
.nt-how-waypoint:nth-child(3) .nt-waypoint-marker::after { border-top: 10px solid var(--nature-sunset); }
.nt-how-waypoint:nth-child(4) .nt-waypoint-marker { background: var(--nature-sky); }
.nt-how-waypoint:nth-child(4) .nt-waypoint-marker::after { border-top: 10px solid var(--nature-sky); }
.nt-how-waypoint h3 { font-size: 1.15rem; margin-bottom: 8px; color: var(--nature-forest); }
.nt-how-waypoint p { color: var(--nature-text-muted); line-height: 1.6; font-size: 0.9rem; }

/* Pricing - Trail Passes */
.nt-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: start; }
.nt-pricing-card {
  background: var(--nature-card); border: 3px solid var(--nature-brown);
  border-radius: var(--nature-radius); padding: 32px; text-align: center;
  transition: all 0.2s ease; position: relative;
}
.nt-pricing-card:hover { transform: translateY(-4px); }
.nt-pricing-card--day { box-shadow: 4px 4px 0px var(--nature-forest); }
.nt-pricing-card--day:hover { box-shadow: 2px 8px 0px var(--nature-forest); }
.nt-pricing-card--season { box-shadow: 4px 4px 0px var(--nature-sunset); border-color: var(--nature-sunset); transform: scale(1.04); }
.nt-pricing-card--season:hover { transform: scale(1.04) translateY(-4px); box-shadow: 2px 8px 0px var(--nature-sunset); }
.nt-pricing-card--expedition { box-shadow: 4px 4px 0px var(--nature-sky); }
.nt-pricing-card--expedition:hover { box-shadow: 2px 8px 0px var(--nature-sky); }
.nt-pricing-popular-tag {
  position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  background: var(--nature-sunset); border: 2px solid var(--nature-brown);
  border-radius: var(--nature-radius-pill); padding: 3px 16px;
  font-family: 'Lilita One', cursive; font-size: 0.75rem; color: #fff;
  display: flex; align-items: center; gap: 4px; animation: sway 2s ease-in-out infinite;
}
.nt-pricing-pass-type { display: inline-flex; align-items: center; gap: 4px; font-family: 'Lilita One', cursive; font-size: 0.7rem; padding: 3px 10px; border-radius: var(--nature-radius-pill); border: 2px solid var(--nature-brown); margin-bottom: 8px; }
.nt-pass-day { background: var(--nature-forest); color: #fff; }
.nt-pass-season { background: var(--nature-sunset); color: #fff; }
.nt-pass-expedition { background: var(--nature-sky); color: #fff; }
.nt-pricing-name { font-family: 'Lilita One', cursive; font-size: 1.2rem; color: var(--nature-forest); margin-bottom: 8px; margin-top: 4px; }
.nt-pricing-price { font-family: 'Lilita One', cursive; font-size: 2.8rem; color: var(--nature-forest); line-height: 1.1; }
.nt-pricing-price span { font-size: 1rem; color: var(--nature-text-muted); font-family: 'Outfit', sans-serif; font-weight: 500; }
.nt-pricing-features { list-style: none; margin: 24px 0; text-align: left; }
.nt-pricing-features li {
  display: flex; align-items: center; gap: 10px; padding: 8px 0;
  font-size: 0.9rem; color: var(--nature-text);
  border-bottom: 1px dashed rgba(139, 69, 19, 0.15);
}
.nt-pricing-features li:last-child { border-bottom: none; }
.nt-pricing-check {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.nt-check-forest { background: var(--nature-forest); color: #fff; }
.nt-check-sunset { background: var(--nature-sunset); color: #fff; }
.nt-check-sky { background: var(--nature-sky); color: #fff; }

/* Testimonials - Postcards from the Trail */
.nt-testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.nt-postcard {
  background: #fff; border: 3px solid var(--nature-brown);
  border-radius: var(--nature-radius); padding: 28px; position: relative;
  transition: all 0.2s ease; overflow: hidden;
}
.nt-postcard::before {
  content: ''; position: absolute; top: 0; right: 0; width: 50px; height: 50px;
  background: linear-gradient(135deg, transparent 50%, rgba(139,69,19,0.06) 50%);
}
.nt-postcard:hover { transform: translateY(-3px) rotate(-0.5deg); }
.nt-postcard:nth-child(1) { box-shadow: 4px 4px 0px var(--nature-forest); transform: rotate(-1deg); }
.nt-postcard:nth-child(1):hover { box-shadow: 2px 8px 0px var(--nature-forest); }
.nt-postcard:nth-child(2) { box-shadow: 4px 4px 0px var(--nature-sunset); transform: rotate(0.5deg); }
.nt-postcard:nth-child(2):hover { box-shadow: 2px 8px 0px var(--nature-sunset); }
.nt-postcard:nth-child(3) { box-shadow: 4px 4px 0px var(--nature-gold); transform: rotate(-0.5deg); }
.nt-postcard:nth-child(3):hover { box-shadow: 2px 8px 0px var(--nature-gold); }
.nt-postcard-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.nt-postcard-stamp {
  font-family: 'Lilita One', cursive; font-size: 0.65rem; padding: 3px 8px;
  border: 2px solid var(--nature-berry); color: var(--nature-berry); border-radius: 4px;
  transform: rotate(6deg); opacity: 0.7; letter-spacing: 1px;
}
.nt-postcard-stars { display: flex; gap: 2px; color: var(--nature-gold); }
.nt-postcard-text { font-size: 0.95rem; line-height: 1.65; color: var(--nature-text); margin-bottom: 16px; font-style: italic; }
.nt-postcard-author { display: flex; align-items: center; gap: 12px; border-top: 2px dashed rgba(139,69,19,0.15); padding-top: 14px; }
.nt-postcard-avatar {
  width: 44px; height: 44px; border-radius: 50%; border: 3px solid var(--nature-brown);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Lilita One', cursive; font-size: 0.85rem; color: #fff;
}
.nt-postcard:nth-child(1) .nt-postcard-avatar { background: var(--nature-forest); }
.nt-postcard:nth-child(2) .nt-postcard-avatar { background: var(--nature-sunset); }
.nt-postcard:nth-child(3) .nt-postcard-avatar { background: var(--nature-sky); }
.nt-postcard-name { font-family: 'Lilita One', cursive; font-size: 0.95rem; color: var(--nature-forest); }
.nt-postcard-role { font-size: 0.8rem; color: var(--nature-text-muted); }

/* CTA - Campfire Area */
.nt-cta { padding: 80px 0; }
.nt-cta-box {
  background: linear-gradient(135deg, #1B4332 0%, #2D6A4F 40%, #40916C 100%);
  border: 3px solid var(--nature-brown); border-radius: 24px;
  padding: 60px 40px; text-align: center; position: relative; overflow: hidden;
  animation: campfireGlow 3s ease-in-out infinite;
}
.nt-cta-box h2 { font-size: 2.4rem; color: #fff; margin-bottom: 16px; position: relative; z-index: 2; }
.nt-cta-box p {
  color: rgba(255,255,255,0.75); font-size: 1.1rem; margin-bottom: 32px;
  max-width: 500px; margin-left: auto; margin-right: auto;
  position: relative; z-index: 2; line-height: 1.6;
}
.nt-cta-buttons { display: flex; justify-content: center; gap: 16px; position: relative; z-index: 2; flex-wrap: wrap; }
.nt-cta-campfire {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  width: 120px; height: 60px; opacity: 0.08; z-index: 1;
}
.nt-cta-deco {
  position: absolute; border-radius: 50%; opacity: 0.08;
}
.nt-cta-deco-1 { width: 200px; height: 200px; background: var(--nature-sunset); top: -70px; right: -50px; }
.nt-cta-deco-2 { width: 150px; height: 150px; background: var(--nature-gold); bottom: -60px; left: -40px; }
.nt-cta-deco-3 { width: 80px; height: 80px; background: var(--nature-sky); top: 30px; left: 60px; }
.nt-cta-stars { position: absolute; top: 20px; right: 40px; z-index: 1; opacity: 0.15; }
.nt-cta-stars span {
  display: inline-block; width: 3px; height: 3px; background: #fff;
  border-radius: 50%; margin: 0 6px;
}
.nt-cta-stars span:nth-child(2) { width: 5px; height: 5px; margin-bottom: 10px; }
.nt-cta-stars span:nth-child(4) { width: 2px; height: 2px; }

/* Footer - Park Service Style */
.nt-footer {
  padding: 48px 0 32px;
  border-top: 4px solid var(--nature-brown);
  background: linear-gradient(180deg, var(--nature-bg) 0%, #F0E6D0 100%);
  position: relative; z-index: 1;
}
.nt-footer-inner { display: flex; justify-content: space-between; align-items: start; gap: 40px; flex-wrap: wrap; }
.nt-footer-brand { max-width: 280px; }
.nt-footer-brand-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; text-decoration: none; }
.nt-footer-brand-logo img { height: 40px; width: auto; }
.nt-footer-brand-logo span { font-family: 'Lilita One', cursive; font-size: 1.25rem; color: var(--nature-forest); }
.nt-footer-brand p { color: var(--nature-text-muted); font-size: 0.85rem; line-height: 1.6; }
.nt-footer-col h4 { font-size: 0.95rem; color: var(--nature-forest); margin-bottom: 12px; font-family: 'Lilita One', cursive; }
.nt-footer-col a { display: block; color: var(--nature-text-muted); text-decoration: none; font-size: 0.85rem; margin-bottom: 8px; transition: color 0.2s; }
.nt-footer-col a:hover { color: var(--nature-forest); }
.nt-footer-bottom {
  text-align: center; margin-top: 40px; padding-top: 24px;
  border-top: 2px dashed rgba(139, 69, 19, 0.2);
  color: var(--nature-text-muted); font-size: 0.8rem;
}
.nt-footer-bottom .nt-ranger-badge {
  display: inline-flex; align-items: center; gap: 4px;
  color: var(--nature-forest); font-weight: 600;
}

/* Mobile Menu */
.nt-mobile-toggle { display: none; background: none; border: none; cursor: pointer; padding: 8px; }
.nt-mobile-toggle span {
  display: block; width: 24px; height: 3px; background: var(--nature-brown);
  border-radius: 2px; margin: 5px 0; transition: all 0.3s;
}
.nt-mobile-menu { display: none; }

/* Responsive */
@media (max-width: 1024px) {
  .nt-hero-text h1 { font-size: 2.8rem; }
  .nt-hero-logo-wrap img { width: 220px; }
  .nt-compass-ring { width: 280px; height: 280px; }
  .nt-features-grid { gap: 20px; }
}
@media (max-width: 768px) {
  .nt-nav-links, .nt-nav-auth { display: none; }
  .nt-mobile-toggle { display: block; }
  .nt-mobile-menu {
    display: none; position: absolute; top: 72px; left: 0; right: 0;
    background: #F5E6C8; border-bottom: 3px solid var(--nature-brown);
    padding: 24px; z-index: 99; box-shadow: 0 8px 24px var(--nature-shadow);
  }
  .nt-mobile-menu.open { display: block; }
  .nt-mobile-menu a {
    display: block; padding: 12px 0; font-weight: 600;
    color: var(--nature-text); text-decoration: none;
    border-bottom: 1px dashed rgba(139, 69, 19, 0.2);
  }
  .nt-mobile-menu a:last-child { border-bottom: none; }
  .nt-mobile-menu-auth {
    display: flex; gap: 12px; margin-top: 16px; padding-top: 16px;
    border-top: 2px solid rgba(139, 69, 19, 0.2);
  }
  .nt-hero-inner { flex-direction: column-reverse; text-align: center; gap: 32px; }
  .nt-hero-text h1 { font-size: 2.2rem; }
  .nt-hero-text p { margin: 0 auto 28px; }
  .nt-hero-ctas { justify-content: center; }
  .nt-hero-logo-wrap img { width: 180px; }
  .nt-compass-ring { width: 240px; height: 240px; }
  .nt-features-grid { grid-template-columns: 1fr; }
  .nt-how-trail { flex-direction: column; align-items: center; gap: 32px; }
  .nt-how-trail-path { display: none; }
  .nt-pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
  .nt-pricing-card--season { transform: none; }
  .nt-pricing-card--season:hover { transform: translateY(-4px); }
  .nt-testimonials-grid { grid-template-columns: 1fr; max-width: 440px; margin: 0 auto; }
  .nt-postcard:nth-child(1), .nt-postcard:nth-child(2), .nt-postcard:nth-child(3) { transform: none; }
  .nt-trail-bar-wrap { margin: 0 auto; }
  .nt-section-title { font-size: 1.9rem; }
  .nt-footer-inner { flex-direction: column; text-align: center; align-items: center; }
  .nt-footer-brand { text-align: center; }
  .nt-stats-inner { gap: 12px; }
  .nt-stat-sign { padding: 12px 18px; min-width: 120px; }
  .nt-cta-box { padding: 40px 24px; }
  .nt-cta-box h2 { font-size: 1.8rem; }
  .nt-leaf { display: none; }
}
@media (max-width: 480px) {
  .nt-hero-text h1 { font-size: 1.8rem; }
  .nt-hero-ctas { flex-direction: column; align-items: center; }
  .nt-stat-sign { font-size: 0.75rem; padding: 10px 14px; min-width: 100px; }
  .nt-stat-num { font-size: 1.2rem; }
  .nt-cta-buttons { flex-direction: column; align-items: center; }
  .nt-pricing-card { padding: 24px; }
}
`;

const MountainDivider: React.FC<{ flip?: boolean }> = ({ flip }) => (
  <div className="nt-mountain-divider" style={flip ? { transform: 'scaleY(-1)' } : undefined}>
    <svg viewBox="0 0 1200 60" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0 60 L0 35 L80 20 L160 30 L240 10 L320 25 L400 5 L480 22 L520 8 L600 28 L680 12 L760 24 L840 6 L920 20 L1000 14 L1080 26 L1160 18 L1200 30 L1200 60 Z"
        fill="#2D6A4F"
        opacity="0.08"
      />
      <path
        d="M0 60 L0 42 L100 30 L200 38 L300 22 L400 35 L500 18 L600 32 L700 20 L800 36 L900 24 L1000 34 L1100 28 L1200 38 L1200 60 Z"
        fill="#8B4513"
        opacity="0.05"
      />
    </svg>
  </div>
);

const LandingDesign10: React.FC = () => {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const features = [
    {
      icon: <Brain size={24} />,
      title: 'AI-Powered Quizzes',
      desc: 'Upload any document and watch our AI instantly create interactive quizzes tailored to your material. Blaze new trails through knowledge.',
      color: 'forest' as const,
      tag: null,
    },
    {
      icon: <Zap size={24} />,
      title: 'Smart Flashcards',
      desc: 'Auto-generated flashcards with spaced repetition. Our algorithm guides you on the optimal path for long-term memory retention.',
      color: 'gold' as const,
      tag: 'POPULAR',
    },
    {
      icon: <Target size={24} />,
      title: 'AI Tutor Chat',
      desc: 'Ask questions, get explanations, and explore deeper into any topic. Your personal trail guide through the wilderness of knowledge.',
      color: 'sunset' as const,
      tag: 'NEW',
    },
    {
      icon: <Users size={24} />,
      title: 'Share & Explore Together',
      desc: 'Send quizzes and flashcards to fellow explorers. Challenge friends and trek up the leaderboard as a team.',
      color: 'sky' as const,
      tag: null,
    },
  ];

  const stats = [
    { num: '10,000+', label: 'Explorers' },
    { num: '500K+', label: 'Trails Blazed' },
    { num: '95%', label: 'Summit Rate' },
    { num: '4.9', label: 'Trail Rating' },
  ];

  const steps = [
    { num: 1, title: 'Pack Your Materials', desc: 'Drop in PDFs, images, notes, or any document. Our AI scouts the terrain in seconds.' },
    { num: 2, title: 'AI Maps Your Route', desc: 'Quizzes, flashcards, and summaries charted automatically. Choose your expedition mode.' },
    { num: 3, title: 'Reach the Summit', desc: 'Study with spaced repetition, track your trek, and conquer any subject peak by peak.' },
  ];

  const pricingPlans = [
    {
      name: 'Day Pass',
      price: '$0',
      period: '',
      variant: 'day' as const,
      features: ['5 quizzes per month', '10 flashcard decks', 'AI tutor (basic)', 'Share with 2 friends', 'Basic trail map'],
    },
    {
      name: 'Season Pass',
      price: '$9.99',
      period: '/mo',
      variant: 'season' as const,
      features: ['Unlimited quizzes', 'Unlimited flashcards', 'AI tutor (advanced)', 'Unlimited sharing', 'Detailed trail analytics', 'Priority ranger support', 'Custom study paths'],
    },
    {
      name: 'Expedition Pass',
      price: '$29.99',
      period: '/mo',
      variant: 'expedition' as const,
      features: ['Everything in Season Pass', 'Up to 25 explorers', 'Base camp dashboard', 'Shared trail library', 'Admin controls', 'API access'],
    },
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'Medical Student',
      text: 'BrainLift is like having a compass that always points to an A+. I uploaded my anatomy notes and had a full quiz ready in under a minute. Absolute game changer!',
      avatar: 'SC',
      rating: 5,
    },
    {
      name: 'Marcus Rodriguez',
      role: 'Language Learner',
      text: 'The flashcards with spaced repetition helped me learn 300 Japanese characters in two weeks. Each study session feels like discovering a new trail!',
      avatar: 'MR',
      rating: 5,
    },
    {
      name: 'Priya Patel',
      role: 'High School Teacher',
      text: 'I create quizzes for my students in minutes instead of hours. They love the nature of learning with BrainLift and actually look forward to studying.',
      avatar: 'PP',
      rating: 5,
    },
  ];

  const checkColor = (variant: string) => {
    if (variant === 'day') return 'forest';
    if (variant === 'season') return 'sunset';
    return 'sky';
  };

  return (
    <div className="nature-landing">
      <style>{STYLES}</style>

      {/* Falling Leaves */}
      <div className="nt-leaf nt-leaf-1" />
      <div className="nt-leaf nt-leaf-2" />
      <div className="nt-leaf nt-leaf-3" />
      <div className="nt-leaf nt-leaf-4" />
      <div className="nt-leaf nt-leaf-5" />
      <div className="nt-leaf nt-leaf-6" />
      <div className="nt-leaf nt-leaf-7" />
      <div className="nt-leaf nt-leaf-8" />

      {/* Nav - Ranger Station */}
      <nav className="nt-nav">
        <div className="nt-container nt-nav-inner">
          <a href="#" className="nt-nav-logo">
            <img src={BrainLiftLogo} alt="BrainLift Logo" />
            <span>BrainLift</span>
          </a>
          <ul className="nt-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#pricing">Trail Passes</a></li>
            <li><a href="#testimonials">Postcards</a></li>
          </ul>
          <div className="nt-nav-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="nt-btn nt-btn-outline nt-btn-sm">Log In</Link>
                <Link to="/auth/register" className="nt-btn nt-btn-forest nt-btn-sm">
                  <TreePine size={14} /> Join Trek
                </Link>
              </>
            ) : (
              <>
                <span className="nt-btn nt-btn-outline nt-btn-sm nt-btn-disabled"><Lock size={14} /> Log In</span>
                <span className="nt-btn nt-btn-forest nt-btn-sm nt-btn-disabled"><Lock size={14} /> Join Trek</span>
              </>
            )}
          </div>
          <button
            className="nt-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>
        <div className={`nt-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Trail Passes</a>
          <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Postcards</a>
          <div className="nt-mobile-menu-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="nt-btn nt-btn-outline nt-btn-sm" style={{ flex: 1 }}>Log In</Link>
                <Link to="/auth/register" className="nt-btn nt-btn-forest nt-btn-sm" style={{ flex: 1 }}>Join Trek</Link>
              </>
            ) : (
              <>
                <span className="nt-btn nt-btn-outline nt-btn-sm nt-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Log In</span>
                <span className="nt-btn nt-btn-forest nt-btn-sm nt-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Join Trek</span>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="nt-hero">
        <div className="nt-container nt-hero-inner">
          <div className="nt-hero-text">
            <h1>
              <span className="nt-highlight">Explore</span> the<br />
              Wilderness of Knowledge
            </h1>
            <p>
              Transform any document into quizzes, flashcards, and study guides with AI.
              Chart your path, track your trek, and reach the summit of any subject.
            </p>
            <div className="nt-hero-ctas">
              {isWebLoginEnabled ? (
                <>
                  <Link to="/auth/register" className="nt-btn nt-btn-forest nt-btn-lg">
                    Start Your Trek <ArrowRight size={18} />
                  </Link>
                  <a
                    href="https://apps.apple.com/app/brainlift"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nt-btn nt-btn-outline nt-btn-lg"
                  >
                    <Compass size={18} /> Get the App
                  </a>
                </>
              ) : (
                <>
                  <span className="nt-btn nt-btn-forest nt-btn-lg nt-btn-disabled">
                    <Lock size={18} /> Coming Soon
                  </span>
                  <a
                    href="https://apps.apple.com/app/brainlift"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nt-btn nt-btn-outline nt-btn-lg"
                  >
                    <Compass size={18} /> Get the App
                  </a>
                </>
              )}
            </div>
            <div className="nt-trail-bar-wrap">
              <div className="nt-trail-label">
                <span>
                  <Mountain size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Trail Progress
                </span>
                <span className="nt-trail-badge">
                  <Sparkles size={12} /> Basecamp
                </span>
              </div>
              <div className="nt-trail-track">
                <div className="nt-trail-fill" />
              </div>
              <p className="nt-trail-hint">Your expedition awaits -- begin at Basecamp!</p>
            </div>
          </div>
          <div className="nt-hero-visual">
            <div className="nt-hero-logo-wrap">
              <img src={BrainLiftLogo} alt="BrainLift brain mascot" />
              <div className="nt-compass-ring" />
              <div className="nt-deco-tree nt-deco-tree-1"><TreePine size={36} /></div>
              <div className="nt-deco-tree nt-deco-tree-2"><TreePine size={28} /></div>
              <div className="nt-deco-mtn nt-deco-mtn-1"><Mountain size={32} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats - Trail Markers */}
      <section className="nt-stats">
        <div className="nt-container nt-stats-inner">
          {stats.map((stat, i) => (
            <div className="nt-stat-sign" key={i}>
              <span className="nt-stat-num">{stat.num}</span>
              <span className="nt-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      <MountainDivider />

      {/* Features - Scout Badges */}
      <section className="nt-section" id="features">
        <div className="nt-container">
          <h2 className="nt-section-title">Earn Your Explorer Badges</h2>
          <p className="nt-section-subtitle">
            Powerful AI tools wrapped in an adventure. Each feature is a badge on your journey to mastery.
          </p>
          <div className="nt-features-grid">
            {features.map((feat, i) => (
              <div className={`nt-feature-badge-card nt-feature-badge-card--${feat.color}`} key={i}>
                {feat.tag && (
                  <span className={`nt-feature-tag ${feat.tag === 'NEW' ? 'nt-tag-new' : 'nt-tag-popular'}`}>
                    {feat.tag === 'NEW' ? <Sparkles size={10} /> : <Star size={10} />}
                    {' '}{feat.tag}
                  </span>
                )}
                <div className={`nt-badge-icon nt-badge-icon--${feat.color}`}>{feat.icon}</div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MountainDivider flip />

      {/* How It Works - Hiking Trail */}
      <section className="nt-section nt-how" id="how-it-works">
        <div className="nt-container">
          <h2 className="nt-section-title">Follow the Trail</h2>
          <p className="nt-section-subtitle">
            Three waypoints from trailhead to summit. Your journey to mastery starts here.
          </p>
          <div className="nt-how-trail">
            <div className="nt-how-trail-path">
              <div className="nt-how-trail-path-line" />
            </div>
            {steps.map((step, i) => (
              <div className="nt-how-waypoint" key={i}>
                <div className="nt-waypoint-marker">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MountainDivider />

      {/* Pricing - Trail Passes */}
      <section className="nt-section" id="pricing">
        <div className="nt-container">
          <h2 className="nt-section-title">Choose Your Trail Pass</h2>
          <p className="nt-section-subtitle">
            Start exploring for free and upgrade when the trail calls for more. No credit card needed.
          </p>
          <div className="nt-pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div className={`nt-pricing-card nt-pricing-card--${plan.variant}`} key={i}>
                {plan.variant === 'season' && (
                  <div className="nt-pricing-popular-tag">
                    <Star size={12} fill="currentColor" /> MOST POPULAR
                  </div>
                )}
                <span className={`nt-pricing-pass-type nt-pass-${plan.variant}`}>
                  {plan.variant === 'day' && <TreePine size={10} />}
                  {plan.variant === 'season' && <Compass size={10} />}
                  {plan.variant === 'expedition' && <Mountain size={10} />}
                  {plan.variant.toUpperCase()} PASS
                </span>
                <div className="nt-pricing-name">{plan.name}</div>
                <div className="nt-pricing-price">
                  {plan.price}
                  {plan.period && <span>{plan.period}</span>}
                </div>
                <ul className="nt-pricing-features">
                  {plan.features.map((feat, j) => (
                    <li key={j}>
                      <span className={`nt-pricing-check nt-check-${checkColor(plan.variant)}`}>
                        <Check size={13} />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                {isWebLoginEnabled ? (
                  <Link
                    to="/auth/register"
                    className={`nt-btn ${plan.variant === 'season' ? 'nt-btn-sunset' : plan.variant === 'expedition' ? 'nt-btn-gold' : 'nt-btn-forest'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {plan.variant === 'day' ? 'Start Exploring' : plan.variant === 'season' ? 'Get Season Pass' : 'Plan Expedition'}
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <span
                    className={`nt-btn ${plan.variant === 'season' ? 'nt-btn-sunset' : plan.variant === 'expedition' ? 'nt-btn-gold' : 'nt-btn-forest'} nt-btn-disabled`}
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

      <MountainDivider flip />

      {/* Testimonials - Postcards from the Trail */}
      <section className="nt-section" id="testimonials">
        <div className="nt-container">
          <h2 className="nt-section-title">Postcards from the Trail</h2>
          <p className="nt-section-subtitle">
            Hear from fellow explorers who have reached new heights with BrainLift.
          </p>
          <div className="nt-testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="nt-postcard" key={i}>
                <div className="nt-postcard-header">
                  <div className="nt-postcard-stars">
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} size={16} fill="currentColor" />
                    ))}
                  </div>
                  <span className="nt-postcard-stamp">TRAIL TESTED</span>
                </div>
                <p className="nt-postcard-text">"{t.text}"</p>
                <div className="nt-postcard-author">
                  <div className="nt-postcard-avatar">{t.avatar}</div>
                  <div>
                    <div className="nt-postcard-name">{t.name}</div>
                    <div className="nt-postcard-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Campfire */}
      <section className="nt-cta">
        <div className="nt-container">
          <div className="nt-cta-box">
            <div className="nt-cta-deco nt-cta-deco-1" />
            <div className="nt-cta-deco nt-cta-deco-2" />
            <div className="nt-cta-deco nt-cta-deco-3" />
            <div className="nt-cta-stars">
              <span /><span /><span /><span /><span />
            </div>
            <h2>Gather Around the Campfire</h2>
            <p>
              Join 10,000+ explorers who are charting new paths with BrainLift.
              Your adventure starts free -- no credit card required.
            </p>
            <div className="nt-cta-buttons">
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="nt-btn nt-btn-sunset nt-btn-lg">
                  Begin Your Journey <ArrowRight size={18} />
                </Link>
              ) : (
                <span className="nt-btn nt-btn-sunset nt-btn-lg nt-btn-disabled">
                  <Lock size={18} /> Coming Soon
                </span>
              )}
              <a
                href="https://apps.apple.com/app/brainlift"
                target="_blank"
                rel="noopener noreferrer"
                className="nt-btn nt-btn-gold nt-btn-lg"
              >
                Download App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Park Service */}
      <footer className="nt-footer">
        <div className="nt-container">
          <div className="nt-footer-inner">
            <div className="nt-footer-brand">
              <a href="#" className="nt-footer-brand-logo">
                <img src={BrainLiftLogo} alt="BrainLift" />
                <span>BrainLift</span>
              </a>
              <p>
                Charting paths through the wilderness of knowledge. Upload your materials,
                let AI be your trail guide, and explore new intellectual horizons every day.
              </p>
            </div>
            <div className="nt-footer-col">
              <h4>Trails</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Trail Passes</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#testimonials">Postcards</a>
            </div>
            <div className="nt-footer-col">
              <h4>Download</h4>
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer">iOS App</a>
              <a href="https://play.google.com/store/apps/details?id=com.brainlift.app" target="_blank" rel="noopener noreferrer">Android App</a>
            </div>
            <div className="nt-footer-col">
              <h4>Park Rules</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
            </div>
          </div>
          <div className="nt-footer-bottom">
            &copy; {new Date().getFullYear()} BrainLift. All rights reserved.
            {' '}
            <span className="nt-ranger-badge">
              <TreePine size={12} /> Made with care for explorers everywhere.
            </span>
          </div>
        </div>
      </footer>
      <DesignSwitcher />
    </div>
  );
};

export default LandingDesign10;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { featureFlagsService } from '@/services/featureFlags.service';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';
import { Lock, ArrowRight, Star, Check, Zap, Brain, Target, Users, Sparkles, Rocket, Globe } from 'lucide-react';
import { DesignSwitcher } from '@/components/DesignSwitcher';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Exo+2:wght@300;400;500;600;700&display=swap');

:root {
  --cs-bg-deep: #0B0B2B;
  --cs-bg-mid: #1A0A3E;
  --cs-purple: #8B5CF6;
  --cs-orange: #FF6B35;
  --cs-cyan: #06D6A0;
  --cs-gold: #FFD700;
  --cs-pink: #FF1493;
  --cs-text: #E8E4F0;
  --cs-text-dim: #9B8FBC;
  --cs-glass: rgba(255, 255, 255, 0.05);
  --cs-glass-border: rgba(255, 255, 255, 0.1);
  --cs-glass-strong: rgba(255, 255, 255, 0.08);
  --cs-radius: 16px;
  --cs-radius-sm: 10px;
  --cs-radius-pill: 999px;
}

/* === STARFIELD ANIMATION === */
@keyframes csTwinkle1 {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes csTwinkle2 {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.1; }
}
@keyframes csTwinkle3 {
  0%, 100% { opacity: 0.2; }
  33% { opacity: 0.9; }
  66% { opacity: 0.4; }
}
@keyframes csFloat {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-18px) rotate(8deg); }
}
@keyframes csFloatReverse {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(14px) rotate(-6deg); }
}
@keyframes csFadeInUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes csRocketFly {
  from { left: 0%; }
  to { left: 65%; }
}
@keyframes csOrbitSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes csPulseGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
  50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.6); }
}
@keyframes csWarpBurst {
  0% { box-shadow: 0 0 0px transparent; }
  50% { box-shadow: 0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(6, 214, 160, 0.3); }
  100% { box-shadow: 0 0 0px transparent; }
}
@keyframes csCountPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
@keyframes csNebulaDrift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(20px, -10px) scale(1.05); }
  66% { transform: translate(-15px, 10px) scale(0.98); }
}
@keyframes csPlanetBob {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.02); }
}
@keyframes csShootingStar {
  0% { transform: translateX(0) translateY(0) rotate(-45deg); opacity: 1; }
  100% { transform: translateX(300px) translateY(300px) rotate(-45deg); opacity: 0; }
}

/* === BASE STYLES === */
.cosmic-landing * { box-sizing: border-box; margin: 0; padding: 0; }
.cosmic-landing {
  font-family: 'Exo 2', sans-serif;
  background: linear-gradient(180deg, var(--cs-bg-deep) 0%, var(--cs-bg-mid) 40%, var(--cs-bg-deep) 100%);
  color: var(--cs-text);
  overflow-x: hidden;
  min-height: 100vh;
  position: relative;
}
.cosmic-landing h1,
.cosmic-landing h2,
.cosmic-landing h3,
.cosmic-landing h4 {
  font-family: 'Orbitron', sans-serif;
}

/* === STAR FIELD === */
.cs-starfield {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none; z-index: 0;
}
.cs-stars-layer {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
}
.cs-stars-layer--1 {
  background-image:
    radial-gradient(1px 1px at 50px 80px, #fff, transparent),
    radial-gradient(1px 1px at 150px 200px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 280px 60px, var(--cs-cyan), transparent),
    radial-gradient(1px 1px at 400px 300px, #fff, transparent),
    radial-gradient(1px 1px at 520px 150px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 650px 250px, var(--cs-gold), transparent),
    radial-gradient(1px 1px at 800px 100px, #fff, transparent),
    radial-gradient(1px 1px at 950px 350px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 1100px 200px, var(--cs-purple), transparent),
    radial-gradient(1px 1px at 1250px 80px, #fff, transparent),
    radial-gradient(1px 1px at 100px 400px, #fff, transparent),
    radial-gradient(1px 1px at 300px 500px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 500px 450px, var(--cs-pink), transparent),
    radial-gradient(1px 1px at 700px 550px, #fff, transparent),
    radial-gradient(1px 1px at 900px 480px, #fff, transparent),
    radial-gradient(1px 1px at 1150px 520px, #fff, transparent),
    radial-gradient(1px 1px at 200px 650px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 450px 700px, var(--cs-cyan), transparent),
    radial-gradient(1px 1px at 750px 680px, #fff, transparent),
    radial-gradient(1px 1px at 1050px 650px, #fff, transparent);
  background-size: 1300px 750px;
  animation: csTwinkle1 4s ease-in-out infinite;
}
.cs-stars-layer--2 {
  background-image:
    radial-gradient(1px 1px at 80px 130px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 220px 280px, var(--cs-gold), transparent),
    radial-gradient(1px 1px at 380px 120px, #fff, transparent),
    radial-gradient(1px 1px at 550px 380px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 720px 180px, var(--cs-purple), transparent),
    radial-gradient(1px 1px at 880px 320px, #fff, transparent),
    radial-gradient(1px 1px at 1080px 150px, #fff, transparent),
    radial-gradient(1px 1px at 180px 520px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 420px 580px, var(--cs-pink), transparent),
    radial-gradient(1px 1px at 650px 620px, #fff, transparent),
    radial-gradient(1px 1px at 920px 550px, #fff, transparent),
    radial-gradient(1px 1px at 1200px 480px, #fff, transparent),
    radial-gradient(1.5px 1.5px at 350px 750px, var(--cs-orange), transparent),
    radial-gradient(1px 1px at 600px 800px, #fff, transparent),
    radial-gradient(1px 1px at 850px 720px, #fff, transparent);
  background-size: 1300px 850px;
  animation: csTwinkle2 6s ease-in-out infinite;
}
.cs-stars-layer--3 {
  background-image:
    radial-gradient(2px 2px at 120px 50px, var(--cs-gold), transparent),
    radial-gradient(1px 1px at 300px 170px, #fff, transparent),
    radial-gradient(2px 2px at 500px 90px, var(--cs-cyan), transparent),
    radial-gradient(1px 1px at 680px 280px, #fff, transparent),
    radial-gradient(2px 2px at 850px 60px, var(--cs-purple), transparent),
    radial-gradient(1px 1px at 1050px 300px, #fff, transparent),
    radial-gradient(1px 1px at 250px 420px, #fff, transparent),
    radial-gradient(2px 2px at 480px 500px, var(--cs-pink), transparent),
    radial-gradient(1px 1px at 750px 450px, #fff, transparent),
    radial-gradient(1px 1px at 1000px 530px, #fff, transparent);
  background-size: 1200px 600px;
  animation: csTwinkle3 5s ease-in-out infinite;
}

/* === CONTAINER === */
.cs-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 2; }

/* === NAVIGATION === */
.cs-nav {
  position: sticky; top: 0; z-index: 100;
  background: rgba(11, 11, 43, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--cs-glass-border);
}
.cs-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 72px; }
.cs-nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.cs-nav-logo img { height: 44px; width: auto; filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.4)); }
.cs-nav-logo span { font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 1.35rem; color: #fff; letter-spacing: 1px; }
.cs-nav-links { display: flex; align-items: center; gap: 32px; list-style: none; }
.cs-nav-links a {
  text-decoration: none; font-weight: 500; color: var(--cs-text-dim);
  transition: color 0.2s, text-shadow 0.2s; font-size: 0.9rem;
  letter-spacing: 0.5px; text-transform: uppercase;
}
.cs-nav-links a:hover { color: var(--cs-cyan); text-shadow: 0 0 12px rgba(6, 214, 160, 0.5); }
.cs-nav-auth { display: flex; align-items: center; gap: 12px; }

/* === BUTTONS === */
.cs-btn {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 0.85rem;
  padding: 12px 24px; border-radius: var(--cs-radius-sm);
  border: 1px solid var(--cs-glass-border); cursor: pointer;
  transition: all 0.25s ease; text-decoration: none; white-space: nowrap;
  letter-spacing: 0.5px; text-transform: uppercase;
}
.cs-btn:hover { transform: translateY(-2px); }
.cs-btn:active { transform: translateY(0px); }
.cs-btn-purple {
  background: linear-gradient(135deg, var(--cs-purple), #6D28D9);
  color: #fff; border-color: var(--cs-purple);
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.35);
}
.cs-btn-purple:hover {
  box-shadow: 0 6px 30px rgba(139, 92, 246, 0.55);
  animation: csWarpBurst 0.4s ease-out;
}
.cs-btn-orange {
  background: linear-gradient(135deg, var(--cs-orange), #E85D26);
  color: #fff; border-color: var(--cs-orange);
  box-shadow: 0 4px 20px rgba(255, 107, 53, 0.35);
}
.cs-btn-orange:hover { box-shadow: 0 6px 30px rgba(255, 107, 53, 0.55); }
.cs-btn-cyan {
  background: linear-gradient(135deg, var(--cs-cyan), #04B586);
  color: #0B0B2B; border-color: var(--cs-cyan);
  box-shadow: 0 4px 20px rgba(6, 214, 160, 0.35);
}
.cs-btn-cyan:hover { box-shadow: 0 6px 30px rgba(6, 214, 160, 0.55); }
.cs-btn-ghost {
  background: transparent; color: var(--cs-text);
  border: 1px solid var(--cs-glass-border);
}
.cs-btn-ghost:hover { background: var(--cs-glass); border-color: var(--cs-purple); color: #fff; }
.cs-btn-disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
.cs-btn-sm { padding: 8px 18px; font-size: 0.75rem; }
.cs-btn-lg { padding: 16px 36px; font-size: 0.9rem; }

/* === HERO === */
.cs-hero { padding: 100px 0 80px; position: relative; overflow: visible; }
.cs-hero-inner { display: flex; align-items: center; gap: 60px; }
.cs-hero-text { flex: 1; animation: csFadeInUp 0.8s ease-out; }
.cs-hero-text h1 {
  font-size: 3.2rem; line-height: 1.2; color: #fff; margin-bottom: 20px;
  font-weight: 800; letter-spacing: 1px;
}
.cs-hero-text h1 .cs-highlight {
  background: linear-gradient(135deg, var(--cs-purple), var(--cs-cyan));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.cs-hero-text p {
  font-size: 1.15rem; color: var(--cs-text-dim); line-height: 1.75;
  margin-bottom: 36px; max-width: 520px; font-weight: 400;
}
.cs-hero-ctas { display: flex; gap: 16px; margin-bottom: 48px; flex-wrap: wrap; }
.cs-hero-visual {
  flex: 1; display: flex; align-items: center; justify-content: center;
  position: relative; animation: csFadeInUp 0.8s ease-out 0.2s both;
}
.cs-hero-logo-wrap { position: relative; z-index: 2; }
.cs-hero-logo-wrap img {
  width: 280px; height: auto; animation: csPlanetBob 3s ease-in-out infinite;
  filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.4));
}

/* Floating planet decorations */
.cs-planet {
  position: absolute; border-radius: 50%; z-index: 1;
}
.cs-planet--1 {
  width: 60px; height: 60px;
  background: radial-gradient(circle at 30% 30%, var(--cs-orange), #CC4400);
  top: -30px; right: -20px;
  animation: csFloat 4s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(255, 107, 53, 0.4), inset -8px -8px 16px rgba(0,0,0,0.3);
}
.cs-planet--1::after {
  content: ''; position: absolute; top: 50%; left: -10px; right: -10px;
  height: 6px; border-radius: 50%; border: 2px solid rgba(255, 107, 53, 0.5);
  transform: rotateX(70deg);
}
.cs-planet--2 {
  width: 36px; height: 36px;
  background: radial-gradient(circle at 30% 30%, var(--cs-cyan), #048A68);
  bottom: 30px; left: -30px;
  animation: csFloatReverse 3.5s ease-in-out infinite;
  box-shadow: 0 0 16px rgba(6, 214, 160, 0.4), inset -5px -5px 10px rgba(0,0,0,0.3);
}
.cs-planet--3 {
  width: 20px; height: 20px;
  background: radial-gradient(circle at 30% 30%, var(--cs-gold), #CC9900);
  top: 50px; left: 20px;
  animation: csFloat 3s ease-in-out infinite 0.5s;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.4), inset -3px -3px 6px rgba(0,0,0,0.3);
}
.cs-orbit-ring {
  position: absolute; border-radius: 50%;
  border: 1px dashed rgba(139, 92, 246, 0.25);
  animation: csOrbitSpin 20s linear infinite;
}
.cs-orbit-ring--1 { width: 350px; height: 350px; top: 50%; left: 50%; transform: translate(-50%, -50%); }
.cs-orbit-ring--2 { width: 450px; height: 450px; top: 50%; left: 50%; transform: translate(-50%, -50%); animation-duration: 30s; animation-direction: reverse; border-color: rgba(6, 214, 160, 0.15); }

/* === ROCKET PROGRESS === */
.cs-rocket-wrap { max-width: 500px; }
.cs-rocket-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cs-rocket-label span {
  font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 0.8rem;
  color: var(--cs-text-dim); letter-spacing: 1px; text-transform: uppercase;
}
.cs-rocket-label .cs-mission-badge {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 214, 160, 0.2));
  border: 1px solid var(--cs-glass-border); border-radius: var(--cs-radius-pill);
  padding: 4px 14px; font-size: 0.7rem; color: var(--cs-gold);
}
.cs-rocket-track {
  height: 24px; background: rgba(255, 255, 255, 0.06);
  border-radius: var(--cs-radius-pill); border: 1px solid var(--cs-glass-border);
  overflow: visible; position: relative;
}
.cs-rocket-trajectory {
  height: 100%; border-radius: var(--cs-radius-pill);
  background: linear-gradient(90deg, var(--cs-purple), var(--cs-cyan));
  animation: csRocketFly 2s ease-out 0.8s both;
  position: relative; width: 65%;
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
}
.cs-rocket-icon {
  position: absolute; right: -14px; top: 50%; transform: translateY(-50%);
  font-size: 20px; filter: drop-shadow(0 0 6px rgba(255, 107, 53, 0.6));
  line-height: 1;
}
.cs-rocket-hint {
  margin-top: 8px; font-size: 0.78rem; color: var(--cs-text-dim);
  font-style: italic; letter-spacing: 0.3px;
}

/* === NEBULA GLOW DECORATIONS === */
.cs-nebula {
  position: absolute; border-radius: 50%; pointer-events: none;
  filter: blur(80px); opacity: 0.15; z-index: 0;
  animation: csNebulaDrift 12s ease-in-out infinite;
}
.cs-nebula--purple { background: var(--cs-purple); }
.cs-nebula--cyan { background: var(--cs-cyan); }
.cs-nebula--pink { background: var(--cs-pink); }
.cs-nebula--orange { background: var(--cs-orange); }

/* === SECTION COMMON === */
.cs-section { padding: 90px 0; position: relative; }
.cs-section-title {
  text-align: center; margin-bottom: 14px; font-size: 2.2rem;
  color: #fff; letter-spacing: 1px; font-weight: 700;
}
.cs-section-subtitle {
  text-align: center; color: var(--cs-text-dim); font-size: 1.05rem;
  margin-bottom: 56px; max-width: 560px; margin-left: auto;
  margin-right: auto; line-height: 1.7;
}

/* === STATS - MISSION CONTROL === */
.cs-stats { padding: 48px 0; position: relative; }
.cs-stats-inner { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; }
.cs-stat-readout {
  display: flex; flex-direction: column; align-items: center;
  padding: 20px 32px; border-radius: var(--cs-radius);
  background: var(--cs-glass); backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--cs-glass-border);
  animation: csFadeInUp 0.6s ease-out both;
  transition: all 0.3s ease;
  min-width: 150px;
}
.cs-stat-readout:hover { animation: csCountPulse 0.5s ease-in-out; border-color: var(--cs-purple); }
.cs-stat-readout:nth-child(1) { animation-delay: 0s; }
.cs-stat-readout:nth-child(2) { animation-delay: 0.1s; }
.cs-stat-readout:nth-child(3) { animation-delay: 0.2s; }
.cs-stat-readout:nth-child(4) { animation-delay: 0.3s; }
.cs-stat-num {
  font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 1.6rem;
  color: #fff; letter-spacing: 1px; margin-bottom: 4px;
}
.cs-stat-readout:nth-child(1) .cs-stat-num { color: var(--cs-purple); }
.cs-stat-readout:nth-child(2) .cs-stat-num { color: var(--cs-orange); }
.cs-stat-readout:nth-child(3) .cs-stat-num { color: var(--cs-cyan); }
.cs-stat-readout:nth-child(4) .cs-stat-num { color: var(--cs-gold); }
.cs-stat-label {
  font-size: 0.78rem; color: var(--cs-text-dim);
  text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;
}

/* === FEATURES === */
.cs-features-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; }
.cs-feature-card {
  background: var(--cs-glass);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--cs-glass-border);
  border-radius: var(--cs-radius); padding: 36px;
  transition: all 0.3s ease; position: relative; overflow: hidden;
}
.cs-feature-card:hover {
  transform: translateY(-4px);
  animation: csWarpBurst 0.5s ease-out;
}
.cs-feature-card--purple { border-color: rgba(139, 92, 246, 0.25); }
.cs-feature-card--purple:hover { border-color: rgba(139, 92, 246, 0.6); box-shadow: 0 0 30px rgba(139, 92, 246, 0.15); }
.cs-feature-card--orange { border-color: rgba(255, 107, 53, 0.25); }
.cs-feature-card--orange:hover { border-color: rgba(255, 107, 53, 0.6); box-shadow: 0 0 30px rgba(255, 107, 53, 0.15); }
.cs-feature-card--cyan { border-color: rgba(6, 214, 160, 0.25); }
.cs-feature-card--cyan:hover { border-color: rgba(6, 214, 160, 0.6); box-shadow: 0 0 30px rgba(6, 214, 160, 0.15); }
.cs-feature-card--pink { border-color: rgba(255, 20, 147, 0.25); }
.cs-feature-card--pink:hover { border-color: rgba(255, 20, 147, 0.6); box-shadow: 0 0 30px rgba(255, 20, 147, 0.15); }

/* Orbital ring decoration around icon */
.cs-feature-icon-wrap { position: relative; width: 64px; height: 64px; margin-bottom: 20px; }
.cs-feature-icon {
  width: 56px; height: 56px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  position: absolute; top: 4px; left: 4px; z-index: 2;
}
.cs-feature-icon--purple { background: linear-gradient(135deg, var(--cs-purple), #6D28D9); color: #fff; box-shadow: 0 0 16px rgba(139, 92, 246, 0.4); }
.cs-feature-icon--orange { background: linear-gradient(135deg, var(--cs-orange), #E85D26); color: #fff; box-shadow: 0 0 16px rgba(255, 107, 53, 0.4); }
.cs-feature-icon--cyan { background: linear-gradient(135deg, var(--cs-cyan), #04B586); color: #0B0B2B; box-shadow: 0 0 16px rgba(6, 214, 160, 0.4); }
.cs-feature-icon--pink { background: linear-gradient(135deg, var(--cs-pink), #CC1177); color: #fff; box-shadow: 0 0 16px rgba(255, 20, 147, 0.4); }
.cs-feature-orbit {
  position: absolute; top: 0; left: 0; width: 64px; height: 64px;
  border-radius: 50%; border: 1px dashed; animation: csOrbitSpin 8s linear infinite;
}
.cs-feature-orbit--purple { border-color: rgba(139, 92, 246, 0.35); }
.cs-feature-orbit--orange { border-color: rgba(255, 107, 53, 0.35); }
.cs-feature-orbit--cyan { border-color: rgba(6, 214, 160, 0.35); }
.cs-feature-orbit--pink { border-color: rgba(255, 20, 147, 0.35); }
.cs-feature-orbit-dot {
  position: absolute; width: 6px; height: 6px; border-radius: 50%;
  top: -3px; left: 50%; transform: translateX(-50%);
}
.cs-feature-orbit-dot--purple { background: var(--cs-purple); box-shadow: 0 0 6px var(--cs-purple); }
.cs-feature-orbit-dot--orange { background: var(--cs-orange); box-shadow: 0 0 6px var(--cs-orange); }
.cs-feature-orbit-dot--cyan { background: var(--cs-cyan); box-shadow: 0 0 6px var(--cs-cyan); }
.cs-feature-orbit-dot--pink { background: var(--cs-pink); box-shadow: 0 0 6px var(--cs-pink); }
.cs-feature-card h3 {
  font-size: 1.15rem; margin-bottom: 10px; color: #fff;
  font-weight: 600; letter-spacing: 0.5px;
}
.cs-feature-card p { color: var(--cs-text-dim); line-height: 1.65; font-size: 0.92rem; }
.cs-feature-badge {
  position: absolute; top: 14px; right: 14px;
  font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 0.6rem;
  padding: 4px 12px; border-radius: var(--cs-radius-pill);
  letter-spacing: 1px; text-transform: uppercase;
  border: 1px solid;
}
.cs-badge-new {
  background: rgba(6, 214, 160, 0.15); color: var(--cs-cyan);
  border-color: rgba(6, 214, 160, 0.4);
}
.cs-badge-popular {
  background: rgba(255, 215, 0, 0.15); color: var(--cs-gold);
  border-color: rgba(255, 215, 0, 0.4);
}

/* Nebula glow behind feature cards */
.cs-feature-card::before {
  content: ''; position: absolute; top: 50%; left: 50%;
  width: 120%; height: 120%; transform: translate(-50%, -50%);
  border-radius: 50%; filter: blur(60px); opacity: 0;
  transition: opacity 0.3s ease; pointer-events: none; z-index: -1;
}
.cs-feature-card--purple::before { background: rgba(139, 92, 246, 0.08); }
.cs-feature-card--orange::before { background: rgba(255, 107, 53, 0.08); }
.cs-feature-card--cyan::before { background: rgba(6, 214, 160, 0.08); }
.cs-feature-card--pink::before { background: rgba(255, 20, 147, 0.08); }
.cs-feature-card:hover::before { opacity: 1; }

/* === HOW IT WORKS - SPACE MISSION === */
.cs-mission-phases { display: flex; justify-content: center; gap: 40px; position: relative; }
.cs-mission-phase { flex: 1; max-width: 320px; text-align: center; position: relative; z-index: 2; }
.cs-phase-icon-wrap {
  width: 80px; height: 80px; margin: 0 auto 20px; position: relative;
}
.cs-phase-icon {
  width: 80px; height: 80px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--cs-glass-strong);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 2px solid; font-size: 28px;
  animation: csPulseGlow 3s ease-in-out infinite;
}
.cs-phase-icon--launch {
  border-color: var(--cs-orange);
  box-shadow: 0 0 20px rgba(255, 107, 53, 0.3);
  color: var(--cs-orange);
}
.cs-phase-icon--launch { animation-name: csPulseGlow; --pulse-color: var(--cs-orange); }
.cs-phase-icon--orbit {
  border-color: var(--cs-purple);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
  color: var(--cs-purple);
}
.cs-phase-icon--land {
  border-color: var(--cs-cyan);
  box-shadow: 0 0 20px rgba(6, 214, 160, 0.3);
  color: var(--cs-cyan);
}
.cs-phase-label {
  font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 0.65rem;
  letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;
  color: var(--cs-text-dim);
}
.cs-mission-phase h3 {
  font-size: 1.1rem; margin-bottom: 10px; color: #fff; font-weight: 600;
}
.cs-mission-phase p { color: var(--cs-text-dim); line-height: 1.6; font-size: 0.88rem; }
.cs-mission-path {
  position: absolute; top: 40px; left: 50%; transform: translateX(-50%);
  width: 55%; height: 2px; z-index: 1;
}
.cs-mission-path-line {
  width: 100%; height: 100%;
  border-top: 2px dashed rgba(139, 92, 246, 0.3);
}

/* === PRICING - MISSION PACKS === */
.cs-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; align-items: start; }
.cs-pricing-card {
  background: var(--cs-glass);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--cs-glass-border);
  border-radius: var(--cs-radius); padding: 36px; text-align: center;
  transition: all 0.3s ease; position: relative;
}
.cs-pricing-card:hover { transform: translateY(-4px); }
.cs-pricing-card--explorer { border-color: rgba(6, 214, 160, 0.3); }
.cs-pricing-card--explorer:hover { border-color: rgba(6, 214, 160, 0.6); box-shadow: 0 0 30px rgba(6, 214, 160, 0.1); }
.cs-pricing-card--commander {
  border-color: rgba(139, 92, 246, 0.5); transform: scale(1.04);
  box-shadow: 0 0 40px rgba(139, 92, 246, 0.15);
}
.cs-pricing-card--commander:hover { transform: scale(1.04) translateY(-4px); box-shadow: 0 0 50px rgba(139, 92, 246, 0.25); }
.cs-pricing-card--admiral { border-color: rgba(255, 215, 0, 0.3); }
.cs-pricing-card--admiral:hover { border-color: rgba(255, 215, 0, 0.6); box-shadow: 0 0 30px rgba(255, 215, 0, 0.1); }
.cs-pricing-popular {
  position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(135deg, var(--cs-purple), var(--cs-cyan));
  border-radius: var(--cs-radius-pill); padding: 5px 18px;
  font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 0.6rem;
  color: #fff; letter-spacing: 1.5px; text-transform: uppercase;
  white-space: nowrap;
}
.cs-pricing-tier-badge {
  display: inline-block; font-family: 'Orbitron', sans-serif; font-weight: 600;
  font-size: 0.6rem; padding: 4px 12px; border-radius: var(--cs-radius-pill);
  letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;
}
.cs-pricing-tier-badge--explorer { background: rgba(6, 214, 160, 0.15); color: var(--cs-cyan); border: 1px solid rgba(6, 214, 160, 0.3); }
.cs-pricing-tier-badge--commander { background: rgba(139, 92, 246, 0.15); color: var(--cs-purple); border: 1px solid rgba(139, 92, 246, 0.3); }
.cs-pricing-tier-badge--admiral { background: rgba(255, 215, 0, 0.15); color: var(--cs-gold); border: 1px solid rgba(255, 215, 0, 0.3); }
.cs-pricing-name {
  font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 1.1rem;
  color: #fff; margin-bottom: 8px; letter-spacing: 0.5px;
}
.cs-pricing-price {
  font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 2.6rem;
  color: #fff; line-height: 1.1;
}
.cs-pricing-price span { font-size: 0.85rem; font-weight: 400; color: var(--cs-text-dim); }
.cs-pricing-features { list-style: none; margin: 28px 0; text-align: left; }
.cs-pricing-features li {
  display: flex; align-items: center; gap: 10px; padding: 9px 0;
  font-size: 0.88rem; color: var(--cs-text);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.cs-pricing-features li:last-child { border-bottom: none; }
.cs-pricing-check {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cs-pricing-check--cyan { background: rgba(6, 214, 160, 0.2); color: var(--cs-cyan); }
.cs-pricing-check--purple { background: rgba(139, 92, 246, 0.2); color: var(--cs-purple); }
.cs-pricing-check--gold { background: rgba(255, 215, 0, 0.2); color: var(--cs-gold); }

/* === TESTIMONIALS === */
.cs-testimonials-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.cs-testimonial-card {
  background: var(--cs-glass);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--cs-glass-border);
  border-radius: var(--cs-radius); padding: 32px;
  transition: all 0.3s ease; position: relative; overflow: hidden;
}
.cs-testimonial-card:hover { transform: translateY(-4px); border-color: rgba(139, 92, 246, 0.4); }
/* Starfield accent inside card */
.cs-testimonial-card::before {
  content: ''; position: absolute; top: 0; right: 0; width: 100px; height: 100px;
  background:
    radial-gradient(1px 1px at 20px 20px, rgba(255, 215, 0, 0.6), transparent),
    radial-gradient(1px 1px at 50px 40px, rgba(139, 92, 246, 0.6), transparent),
    radial-gradient(1px 1px at 80px 15px, rgba(6, 214, 160, 0.6), transparent),
    radial-gradient(1px 1px at 30px 70px, rgba(255, 20, 147, 0.6), transparent),
    radial-gradient(1px 1px at 65px 60px, #fff, transparent);
  opacity: 0.3; pointer-events: none;
}
.cs-testimonial-stars { display: flex; gap: 3px; margin-bottom: 14px; color: var(--cs-gold); }
.cs-testimonial-text {
  font-size: 0.92rem; line-height: 1.7; color: var(--cs-text);
  margin-bottom: 20px; font-style: italic;
}
.cs-testimonial-author { display: flex; align-items: center; gap: 14px; }
.cs-testimonial-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 0.8rem;
  color: #fff; position: relative;
  border: 2px solid var(--cs-glass-border);
}
/* Mission patch style */
.cs-testimonial-card:nth-child(1) .cs-testimonial-avatar {
  background: linear-gradient(135deg, var(--cs-purple), #6D28D9);
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.3);
}
.cs-testimonial-card:nth-child(2) .cs-testimonial-avatar {
  background: linear-gradient(135deg, var(--cs-orange), #E85D26);
  box-shadow: 0 0 12px rgba(255, 107, 53, 0.3);
}
.cs-testimonial-card:nth-child(3) .cs-testimonial-avatar {
  background: linear-gradient(135deg, var(--cs-cyan), #04B586);
  box-shadow: 0 0 12px rgba(6, 214, 160, 0.3);
}
.cs-testimonial-avatar::after {
  content: ''; position: absolute; top: -3px; left: -3px; right: -3px; bottom: -3px;
  border-radius: 50%; border: 1px dashed rgba(255, 255, 255, 0.15);
}
.cs-testimonial-name { font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 0.85rem; color: #fff; }
.cs-testimonial-role { font-size: 0.78rem; color: var(--cs-text-dim); margin-top: 2px; }

/* === CTA - MISSION CONTROL === */
.cs-cta { padding: 90px 0; }
.cs-cta-box {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(6, 214, 160, 0.08));
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 24px;
  padding: 64px 48px; text-align: center; position: relative; overflow: hidden;
}
.cs-cta-box h2 {
  font-size: 2.2rem; color: #fff; margin-bottom: 16px;
  position: relative; z-index: 2; letter-spacing: 1px;
}
.cs-cta-box p {
  color: var(--cs-text-dim); font-size: 1.05rem; margin-bottom: 36px;
  max-width: 520px; margin-left: auto; margin-right: auto;
  position: relative; z-index: 2; line-height: 1.65;
}
.cs-cta-countdown {
  display: flex; justify-content: center; gap: 20px; margin-bottom: 36px;
  position: relative; z-index: 2;
}
.cs-countdown-block {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: var(--cs-glass); border: 1px solid var(--cs-glass-border);
  border-radius: var(--cs-radius-sm); padding: 12px 20px;
}
.cs-countdown-num {
  font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 1.8rem;
  color: #fff;
}
.cs-countdown-label {
  font-size: 0.6rem; color: var(--cs-text-dim); text-transform: uppercase;
  letter-spacing: 1.5px; font-weight: 500;
}
.cs-cta-buttons { display: flex; justify-content: center; gap: 16px; position: relative; z-index: 2; flex-wrap: wrap; }
.cs-cta-nebula {
  position: absolute; border-radius: 50%; filter: blur(80px);
  pointer-events: none; opacity: 0.2;
}
.cs-cta-nebula--1 { width: 300px; height: 300px; background: var(--cs-purple); top: -80px; right: -60px; }
.cs-cta-nebula--2 { width: 200px; height: 200px; background: var(--cs-cyan); bottom: -60px; left: -40px; }
.cs-cta-nebula--3 { width: 150px; height: 150px; background: var(--cs-pink); top: 40%; left: 20%; }

/* === FOOTER - SPACE STATION === */
.cs-footer {
  padding: 56px 0 32px; position: relative;
  border-top: 1px solid var(--cs-glass-border);
}
.cs-footer::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--cs-purple), var(--cs-cyan), var(--cs-orange), transparent);
}
.cs-footer-inner { display: flex; justify-content: space-between; align-items: start; gap: 40px; flex-wrap: wrap; }
.cs-footer-brand { max-width: 280px; }
.cs-footer-brand-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; text-decoration: none; }
.cs-footer-brand-logo img { height: 36px; width: auto; filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.3)); }
.cs-footer-brand-logo span { font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 1.15rem; color: #fff; letter-spacing: 1px; }
.cs-footer-brand p { color: var(--cs-text-dim); font-size: 0.82rem; line-height: 1.65; }
.cs-footer-col h4 {
  font-family: 'Orbitron', sans-serif; font-size: 0.75rem; color: var(--cs-text-dim);
  margin-bottom: 14px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600;
}
.cs-footer-col a {
  display: block; color: var(--cs-text-dim); text-decoration: none;
  font-size: 0.82rem; margin-bottom: 10px; transition: color 0.2s, text-shadow 0.2s;
}
.cs-footer-col a:hover { color: var(--cs-cyan); text-shadow: 0 0 8px rgba(6, 214, 160, 0.3); }
.cs-footer-bottom {
  text-align: center; margin-top: 48px; padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--cs-text-dim); font-size: 0.75rem; letter-spacing: 0.5px;
}

/* === MOBILE TOGGLE === */
.cs-mobile-toggle { display: none; background: none; border: none; cursor: pointer; padding: 8px; }
.cs-mobile-toggle span {
  display: block; width: 22px; height: 2px;
  background: var(--cs-text); border-radius: 2px; margin: 5px 0; transition: all 0.3s;
}
.cs-mobile-menu { display: none; }

/* === FLOATING ASTEROID DECORATION === */
.cs-asteroid {
  position: absolute; pointer-events: none; z-index: 1;
}
.cs-asteroid--1 {
  width: 12px; height: 10px; background: rgba(155, 143, 188, 0.4);
  border-radius: 40% 60% 50% 50%; top: 200px; right: 8%;
  animation: csFloat 6s ease-in-out infinite;
}
.cs-asteroid--2 {
  width: 8px; height: 7px; background: rgba(155, 143, 188, 0.3);
  border-radius: 50% 40% 60% 50%; top: 500px; left: 5%;
  animation: csFloatReverse 7s ease-in-out infinite;
}
.cs-asteroid--3 {
  width: 14px; height: 11px; background: rgba(155, 143, 188, 0.25);
  border-radius: 60% 40% 50% 55%; bottom: 300px; right: 12%;
  animation: csFloat 5s ease-in-out infinite 1s;
}

/* === RESPONSIVE === */
@media (max-width: 1024px) {
  .cs-hero-text h1 { font-size: 2.6rem; }
  .cs-hero-logo-wrap img { width: 220px; }
  .cs-features-grid { gap: 20px; }
  .cs-orbit-ring--1 { width: 280px; height: 280px; }
  .cs-orbit-ring--2 { width: 360px; height: 360px; }
}
@media (max-width: 768px) {
  .cs-nav-links, .cs-nav-auth { display: none; }
  .cs-mobile-toggle { display: block; }
  .cs-mobile-menu {
    display: none; position: absolute; top: 72px; left: 0; right: 0;
    background: rgba(11, 11, 43, 0.95); backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--cs-glass-border);
    padding: 24px; z-index: 99;
  }
  .cs-mobile-menu.open { display: block; }
  .cs-mobile-menu a {
    display: block; padding: 14px 0; font-weight: 500; color: var(--cs-text);
    text-decoration: none; border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 0.9rem; letter-spacing: 0.5px; text-transform: uppercase;
  }
  .cs-mobile-menu a:last-child { border-bottom: none; }
  .cs-mobile-menu-auth {
    display: flex; gap: 12px; margin-top: 20px; padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  .cs-hero-inner { flex-direction: column-reverse; text-align: center; gap: 36px; }
  .cs-hero-text h1 { font-size: 2rem; }
  .cs-hero-text p { margin: 0 auto 28px; }
  .cs-hero-ctas { justify-content: center; }
  .cs-hero-logo-wrap img { width: 180px; }
  .cs-features-grid { grid-template-columns: 1fr; }
  .cs-mission-phases { flex-direction: column; align-items: center; gap: 36px; }
  .cs-mission-path { display: none; }
  .cs-pricing-grid { grid-template-columns: 1fr; max-width: 420px; margin: 0 auto; }
  .cs-pricing-card--commander { transform: none; }
  .cs-pricing-card--commander:hover { transform: translateY(-4px); }
  .cs-testimonials-grid { grid-template-columns: 1fr; max-width: 460px; margin: 0 auto; }
  .cs-rocket-wrap { margin: 0 auto; }
  .cs-section-title { font-size: 1.7rem; }
  .cs-footer-inner { flex-direction: column; text-align: center; align-items: center; }
  .cs-footer-brand { text-align: center; }
  .cs-stats-inner { gap: 12px; }
  .cs-stat-readout { padding: 14px 20px; min-width: 120px; }
  .cs-stat-num { font-size: 1.3rem; }
  .cs-cta-box { padding: 44px 24px; }
  .cs-cta-box h2 { font-size: 1.6rem; }
  .cs-cta-countdown { gap: 12px; }
  .cs-countdown-block { padding: 8px 14px; }
  .cs-countdown-num { font-size: 1.3rem; }
  .cs-orbit-ring--1, .cs-orbit-ring--2 { display: none; }
}
@media (max-width: 480px) {
  .cs-hero-text h1 { font-size: 1.6rem; }
  .cs-hero-ctas { flex-direction: column; align-items: center; }
  .cs-stat-readout { padding: 10px 14px; min-width: 100px; }
  .cs-stat-num { font-size: 1.1rem; }
  .cs-stat-label { font-size: 0.65rem; }
  .cs-cta-buttons { flex-direction: column; align-items: center; }
  .cs-cta-countdown { flex-wrap: wrap; gap: 8px; }
  .cs-countdown-block { padding: 6px 12px; }
  .cs-countdown-num { font-size: 1.1rem; }
  .cs-section { padding: 60px 0; }
  .cs-pricing-card { padding: 28px; }
}
`;

const LandingDesign9: React.FC = () => {
  const [isWebLoginEnabled, setIsWebLoginEnabled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [missionXP, setMissionXP] = useState(0);

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
    const duration = 2200;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setMissionXP(Math.floor(progress * target));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, 900);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, []);

  const features = [
    {
      icon: <Brain size={24} />, title: 'AI-Powered Quizzes',
      desc: 'Upload any document and watch our AI instantly create interactive quizzes tailored to your material. Navigate the cosmos of knowledge effortlessly.',
      color: 'purple' as const, badge: null,
    },
    {
      icon: <Zap size={24} />, title: 'Smart Flashcards',
      desc: 'Auto-generated flashcards with spaced repetition. Our algorithm ensures you review at the optimal moment for interstellar memory retention.',
      color: 'orange' as const, badge: 'POPULAR',
    },
    {
      icon: <Target size={24} />, title: 'AI Tutor Chat',
      desc: 'Ask questions, get explanations, and explore deeper into any topic. Your personal mission guide is available 24/7, always ready to assist.',
      color: 'cyan' as const, badge: 'NEW',
    },
    {
      icon: <Users size={24} />, title: 'Share & Compete',
      desc: 'Send quizzes and flashcards to fellow astronauts. Challenge crewmates and climb the galactic leaderboard. Learning is better in a squad.',
      color: 'pink' as const, badge: null,
    },
  ];

  const stats = [
    { num: '10,000+', label: 'Astronauts' },
    { num: '500K+', label: 'Missions Run' },
    { num: '95%', label: 'Success Rate' },
    { num: '4.9', label: 'Star Rating' },
  ];

  const missionPhases = [
    {
      phase: 'Phase 01',
      title: 'Launch',
      desc: 'Upload your PDFs, images, notes, or any study material. Our AI engines ignite and parse everything in seconds.',
      icon: <Rocket size={28} />,
      variant: 'launch' as const,
    },
    {
      phase: 'Phase 02',
      title: 'Orbit',
      desc: 'AI generates quizzes, flashcards, and summaries automatically. Choose your study trajectory and lock in your orbit.',
      icon: <Globe size={28} />,
      variant: 'orbit' as const,
    },
    {
      phase: 'Phase 03',
      title: 'Land',
      desc: 'Master subjects with spaced repetition, track mission progress, earn XP, and achieve academic excellence.',
      icon: <Star size={28} />,
      variant: 'land' as const,
    },
  ];

  const pricingPlans = [
    {
      name: 'Explorer', price: '$0', period: '', variant: 'explorer' as const,
      features: ['5 missions per month', '10 flashcard decks', 'AI tutor (basic comms)', 'Share with 2 crewmates', 'Basic mission logs'],
    },
    {
      name: 'Commander', price: '$9.99', period: '/mo', variant: 'commander' as const,
      features: ['Unlimited missions', 'Unlimited flashcards', 'AI tutor (full comms)', 'Unlimited crew sharing', 'Detailed mission analytics', 'Priority ground control', 'Custom study orbits'],
    },
    {
      name: 'Admiral', price: '$29.99', period: '/mo', variant: 'admiral' as const,
      features: ['Everything in Commander', 'Up to 25 crew members', 'Fleet dashboard', 'Shared mission library', 'Admin command center', 'API access'],
    },
  ];

  const testimonials = [
    {
      name: 'Sarah Chen', role: 'Medical Student',
      text: 'BrainLift is absolutely stellar! I uploaded my anatomy notes and had a full quiz ready in under a minute. My grades have reached orbit.',
      avatar: 'SC', rating: 5,
    },
    {
      name: 'Marcus Rodriguez', role: 'Language Learner',
      text: 'The flashcards with spaced repetition helped me learn 300 Japanese characters in two weeks. The progress tracking keeps my mission on course!',
      avatar: 'MR', rating: 5,
    },
    {
      name: 'Priya Patel', role: 'High School Teacher',
      text: 'I create quizzes for my students in minutes instead of hours. They love the gamified experience and actually look forward to each study mission.',
      avatar: 'PP', rating: 5,
    },
  ];

  const checkColor = (variant: string) => {
    if (variant === 'explorer') return 'cyan';
    if (variant === 'commander') return 'purple';
    if (variant === 'admiral') return 'gold';
    return 'cyan';
  };

  return (
    <div className="cosmic-landing">
      <style>{STYLES}</style>

      {/* Star field background */}
      <div className="cs-starfield">
        <div className="cs-stars-layer cs-stars-layer--1" />
        <div className="cs-stars-layer cs-stars-layer--2" />
        <div className="cs-stars-layer cs-stars-layer--3" />
      </div>

      {/* Floating asteroids */}
      <div className="cs-asteroid cs-asteroid--1" />
      <div className="cs-asteroid cs-asteroid--2" />
      <div className="cs-asteroid cs-asteroid--3" />

      {/* Navigation - Space Command Bar */}
      <nav className="cs-nav">
        <div className="cs-container cs-nav-inner">
          <a href="#" className="cs-nav-logo">
            <img src={BrainLiftLogo} alt="BrainLift Logo" />
            <span>BrainLift</span>
          </a>
          <ul className="cs-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">Mission Plan</a></li>
            <li><a href="#pricing">Mission Packs</a></li>
            <li><a href="#testimonials">Crew Reviews</a></li>
          </ul>
          <div className="cs-nav-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="cs-btn cs-btn-ghost cs-btn-sm">Log In</Link>
                <Link to="/auth/register" className="cs-btn cs-btn-purple cs-btn-sm">
                  <Rocket size={14} /> Launch Free
                </Link>
              </>
            ) : (
              <>
                <span className="cs-btn cs-btn-ghost cs-btn-sm cs-btn-disabled"><Lock size={14} /> Log In</span>
                <span className="cs-btn cs-btn-purple cs-btn-sm cs-btn-disabled"><Lock size={14} /> Launch</span>
              </>
            )}
          </div>
          <button className="cs-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>
        <div className={`cs-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>Mission Plan</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Mission Packs</a>
          <a href="#testimonials" onClick={() => setMobileMenuOpen(false)}>Crew Reviews</a>
          <div className="cs-mobile-menu-auth">
            {isWebLoginEnabled ? (
              <>
                <Link to="/auth/login" className="cs-btn cs-btn-ghost cs-btn-sm" style={{ flex: 1 }}>Log In</Link>
                <Link to="/auth/register" className="cs-btn cs-btn-purple cs-btn-sm" style={{ flex: 1 }}>
                  <Rocket size={14} /> Launch Free
                </Link>
              </>
            ) : (
              <>
                <span className="cs-btn cs-btn-ghost cs-btn-sm cs-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Log In</span>
                <span className="cs-btn cs-btn-purple cs-btn-sm cs-btn-disabled" style={{ flex: 1 }}><Lock size={14} /> Launch</span>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero - Your Mission: Learn Everything */}
      <section className="cs-hero">
        <div className="cs-container cs-hero-inner">
          <div className="cs-hero-text">
            <h1>
              Your Mission:<br />
              <span className="cs-highlight">Learn Everything</span>
            </h1>
            <p>
              Transform any document into quizzes, flashcards, and study materials
              with AI. Navigate the cosmos of knowledge, earn XP, and conquer every subject.
            </p>
            <div className="cs-hero-ctas">
              {isWebLoginEnabled ? (
                <>
                  <Link to="/auth/register" className="cs-btn cs-btn-purple cs-btn-lg">
                    <Rocket size={18} /> Begin Your Mission <ArrowRight size={18} />
                  </Link>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="cs-btn cs-btn-ghost cs-btn-lg">
                    Get the App
                  </a>
                </>
              ) : (
                <>
                  <span className="cs-btn cs-btn-purple cs-btn-lg cs-btn-disabled">
                    <Lock size={18} /> Mission Pending
                  </span>
                  <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="cs-btn cs-btn-ghost cs-btn-lg">
                    Get the App
                  </a>
                </>
              )}
            </div>

            {/* Rocket Progress Indicator */}
            <div className="cs-rocket-wrap">
              <div className="cs-rocket-label">
                <span>
                  <Sparkles size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {missionXP.toLocaleString()} XP
                </span>
                <span className="cs-mission-badge">
                  <Rocket size={11} /> Cadet
                </span>
              </div>
              <div className="cs-rocket-track">
                <div className="cs-rocket-trajectory">
                  <span className="cs-rocket-icon" role="img" aria-label="rocket">
                    <Rocket size={18} style={{ color: '#FF6B35', filter: 'drop-shadow(0 0 4px rgba(255,107,53,0.8))' }} />
                  </span>
                </div>
              </div>
              <p className="cs-rocket-hint">Mission status: Cadet -- Begin your journey through the stars</p>
            </div>
          </div>

          <div className="cs-hero-visual">
            <div className="cs-orbit-ring cs-orbit-ring--1" />
            <div className="cs-orbit-ring cs-orbit-ring--2" />
            <div className="cs-hero-logo-wrap">
              <img src={BrainLiftLogo} alt="BrainLift cosmic brain mascot" />
              <div className="cs-planet cs-planet--1" />
              <div className="cs-planet cs-planet--2" />
              <div className="cs-planet cs-planet--3" />
            </div>
          </div>
        </div>

        {/* Nebula glow behind hero */}
        <div className="cs-nebula cs-nebula--purple" style={{ width: 400, height: 400, top: -100, right: '10%' }} />
        <div className="cs-nebula cs-nebula--cyan" style={{ width: 300, height: 300, bottom: -80, left: '5%' }} />
      </section>

      {/* Stats - Mission Control Readouts */}
      <section className="cs-stats">
        <div className="cs-container cs-stats-inner">
          {stats.map((stat, i) => (
            <div className="cs-stat-readout" key={i}>
              <span className="cs-stat-num">{stat.num}</span>
              <span className="cs-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="cs-section" id="features">
        <div className="cs-container">
          <h2 className="cs-section-title">Mission Equipment</h2>
          <p className="cs-section-subtitle">
            Powerful AI tools engineered for deep space learning. Everything you need to conquer the academic universe.
          </p>
          <div className="cs-features-grid">
            {features.map((feat, i) => (
              <div className={`cs-feature-card cs-feature-card--${feat.color}`} key={i}>
                {feat.badge && (
                  <span className={`cs-feature-badge ${feat.badge === 'NEW' ? 'cs-badge-new' : 'cs-badge-popular'}`}>
                    {feat.badge === 'NEW' ? <Sparkles size={9} /> : <Star size={9} />}
                    {' '}{feat.badge}
                  </span>
                )}
                <div className="cs-feature-icon-wrap">
                  <div className={`cs-feature-icon cs-feature-icon--${feat.color}`}>{feat.icon}</div>
                  <div className={`cs-feature-orbit cs-feature-orbit--${feat.color}`}>
                    <div className={`cs-feature-orbit-dot cs-feature-orbit-dot--${feat.color}`} />
                  </div>
                </div>
                <h3>{feat.title}</h3>
                <p>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Nebula glow behind features */}
        <div className="cs-nebula cs-nebula--pink" style={{ width: 350, height: 350, top: '20%', left: '-5%' }} />
        <div className="cs-nebula cs-nebula--orange" style={{ width: 250, height: 250, bottom: '10%', right: '-3%' }} />
      </section>

      {/* How It Works - Space Mission Phases */}
      <section className="cs-section" id="how-it-works">
        <div className="cs-container">
          <h2 className="cs-section-title">The Mission Plan</h2>
          <p className="cs-section-subtitle">
            Three phases to transform any material into your personal command center of knowledge.
          </p>
          <div className="cs-mission-phases">
            <div className="cs-mission-path"><div className="cs-mission-path-line" /></div>
            {missionPhases.map((mp, i) => (
              <div className="cs-mission-phase" key={i}>
                <div className="cs-phase-icon-wrap">
                  <div className={`cs-phase-icon cs-phase-icon--${mp.variant}`}>
                    {mp.icon}
                  </div>
                </div>
                <div className="cs-phase-label">{mp.phase}</div>
                <h3>{mp.title}</h3>
                <p>{mp.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Mission Packs */}
      <section className="cs-section" id="pricing">
        <div className="cs-container">
          <h2 className="cs-section-title">Choose Your Mission Pack</h2>
          <p className="cs-section-subtitle">
            Start with Explorer for free. Upgrade to Commander or Admiral when you are ready for deeper space.
          </p>
          <div className="cs-pricing-grid">
            {pricingPlans.map((plan, i) => (
              <div className={`cs-pricing-card cs-pricing-card--${plan.variant}`} key={i}>
                {plan.variant === 'commander' && (
                  <div className="cs-pricing-popular">
                    <Star size={10} /> RECOMMENDED
                  </div>
                )}
                <span className={`cs-pricing-tier-badge cs-pricing-tier-badge--${plan.variant}`}>
                  {plan.variant === 'explorer' ? 'FREE TIER' : plan.variant === 'commander' ? 'MOST POPULAR' : 'FLEET PLAN'}
                </span>
                <div className="cs-pricing-name">{plan.name}</div>
                <div className="cs-pricing-price">
                  {plan.price}
                  {plan.period && <span>{plan.period}</span>}
                </div>
                <ul className="cs-pricing-features">
                  {plan.features.map((feat, j) => (
                    <li key={j}>
                      <span className={`cs-pricing-check cs-pricing-check--${checkColor(plan.variant)}`}>
                        <Check size={12} />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
                {isWebLoginEnabled ? (
                  <Link
                    to="/auth/register"
                    className={`cs-btn ${plan.variant === 'commander' ? 'cs-btn-purple' : plan.variant === 'admiral' ? 'cs-btn-orange' : 'cs-btn-cyan'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {plan.variant === 'explorer' ? 'Start Exploring' : plan.variant === 'commander' ? 'Go Commander' : 'Contact Fleet'}
                    <ArrowRight size={15} />
                  </Link>
                ) : (
                  <span
                    className={`cs-btn ${plan.variant === 'commander' ? 'cs-btn-purple' : plan.variant === 'admiral' ? 'cs-btn-orange' : 'cs-btn-cyan'} cs-btn-disabled`}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Lock size={14} /> Mission Pending
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Nebula glow behind pricing */}
        <div className="cs-nebula cs-nebula--purple" style={{ width: 300, height: 300, top: '30%', right: '-8%' }} />
      </section>

      {/* Testimonials */}
      <section className="cs-section" id="testimonials">
        <div className="cs-container">
          <h2 className="cs-section-title">Crew Transmissions</h2>
          <p className="cs-section-subtitle">
            Hear from fellow astronauts who are navigating the cosmos of knowledge with BrainLift.
          </p>
          <div className="cs-testimonials-grid">
            {testimonials.map((t, i) => (
              <div className="cs-testimonial-card" key={i}>
                <div className="cs-testimonial-stars">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={15} fill="currentColor" />
                  ))}
                </div>
                <p className="cs-testimonial-text">"{t.text}"</p>
                <div className="cs-testimonial-author">
                  <div className="cs-testimonial-avatar">{t.avatar}</div>
                  <div>
                    <div className="cs-testimonial-name">{t.name}</div>
                    <div className="cs-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Mission Control Launch */}
      <section className="cs-cta">
        <div className="cs-container">
          <div className="cs-cta-box">
            <div className="cs-cta-nebula cs-cta-nebula--1" />
            <div className="cs-cta-nebula cs-cta-nebula--2" />
            <div className="cs-cta-nebula cs-cta-nebula--3" />
            <h2>Mission Control: Launch Your Journey</h2>
            <p>
              Join 10,000+ astronauts who are already exploring the universe of knowledge with BrainLift.
              Free to launch -- no credit card required.
            </p>
            {/* Countdown-inspired design */}
            <div className="cs-cta-countdown">
              <div className="cs-countdown-block">
                <span className="cs-countdown-num">10K+</span>
                <span className="cs-countdown-label">Crew</span>
              </div>
              <div className="cs-countdown-block">
                <span className="cs-countdown-num">500K</span>
                <span className="cs-countdown-label">Missions</span>
              </div>
              <div className="cs-countdown-block">
                <span className="cs-countdown-num">95%</span>
                <span className="cs-countdown-label">Success</span>
              </div>
              <div className="cs-countdown-block">
                <span className="cs-countdown-num">24/7</span>
                <span className="cs-countdown-label">Support</span>
              </div>
            </div>
            <div className="cs-cta-buttons">
              {isWebLoginEnabled ? (
                <Link to="/auth/register" className="cs-btn cs-btn-purple cs-btn-lg">
                  <Rocket size={18} /> Launch Free Account <ArrowRight size={18} />
                </Link>
              ) : (
                <span className="cs-btn cs-btn-purple cs-btn-lg cs-btn-disabled">
                  <Lock size={18} /> Mission Pending
                </span>
              )}
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer" className="cs-btn cs-btn-orange cs-btn-lg">
                Download App
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Space Station */}
      <footer className="cs-footer">
        <div className="cs-container">
          <div className="cs-footer-inner">
            <div className="cs-footer-brand">
              <a href="#" className="cs-footer-brand-logo">
                <img src={BrainLiftLogo} alt="BrainLift" />
                <span>BrainLift</span>
              </a>
              <p>
                Your mission control for learning. Upload materials, let AI chart the course,
                and navigate the cosmos of knowledge every day.
              </p>
            </div>
            <div className="cs-footer-col">
              <h4>Navigation</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Mission Packs</a>
              <a href="#how-it-works">Mission Plan</a>
              <a href="#testimonials">Crew Reviews</a>
            </div>
            <div className="cs-footer-col">
              <h4>Download</h4>
              <a href="https://apps.apple.com/app/brainlift" target="_blank" rel="noopener noreferrer">iOS App</a>
              <a href="https://play.google.com/store/apps/details?id=com.brainlift.app" target="_blank" rel="noopener noreferrer">Android App</a>
            </div>
            <div className="cs-footer-col">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
            </div>
          </div>
          <div className="cs-footer-bottom">
            &copy; {new Date().getFullYear()} BrainLift. All rights reserved. Charting the cosmos of knowledge.
          </div>
        </div>
      </footer>
      <DesignSwitcher />
    </div>
  );
};

export default LandingDesign9;

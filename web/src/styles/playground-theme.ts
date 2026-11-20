// Playground Design System - "Claymorphism" Theme Tokens
// Based on LandingDesign4 aesthetic: warm, playful, colorful

export const playgroundColors = {
  light: {
    bgCream: '#FFF8F0',
    cardWhite: '#FFFFFF',
    textPrimary: '#2D2D2D',
    textSecondary: '#7A7A7A',
    coral: '#FF6B6B',
    yellow: '#FFD93D',
    teal: '#4ECDC4',
    lilac: '#C3ACD0',
    navy: '#2C3E50',
    indigo: '#4F46E5',
  },
  dark: {
    bgDark: '#1A1625',
    cardDark: '#241E35',
    textPrimary: '#F5F0FF',
    textSecondary: '#B8AEDE',
    coral: '#FF8585',
    yellow: '#FFE066',
    teal: '#5FE0D8',
    lilac: '#D4BEE8',
    navy: '#D4CCE8',
    indigo: '#7C6FF6',
  },
} as const;

export const playgroundFonts = {
  heading: "'Fredoka', sans-serif",
  body: "'Nunito', sans-serif",
} as const;

export const playgroundRadius = {
  card: '16px',
  cardLg: '20px',
  button: '12px',
  pill: '999px',
  icon: '50%',
} as const;

export const playgroundShadows = {
  light: {
    coral: '4px 4px 0px #FF6B6B',
    yellow: '4px 4px 0px #FFD93D',
    teal: '4px 4px 0px #4ECDC4',
    lilac: '4px 4px 0px #C3ACD0',
    navy: '4px 4px 0px #2C3E50',
    subtle: '0 2px 12px rgba(0,0,0,0.08)',
  },
  dark: {
    coral: '4px 4px 0px rgba(255,133,133,0.4)',
    yellow: '4px 4px 0px rgba(255,224,102,0.4)',
    teal: '4px 4px 0px rgba(95,224,216,0.4)',
    lilac: '4px 4px 0px rgba(212,190,232,0.4)',
    navy: '4px 4px 0px rgba(61,53,85,0.6)',
    subtle: '0 2px 12px rgba(0,0,0,0.2)',
  },
} as const;

export const playgroundBorders = {
  light: {
    thick: '3px solid #2C3E50',
    medium: '2px solid #2C3E50',
    thin: '1px solid #E5E7EB',
  },
  dark: {
    thick: '2px solid #4A3F66',
    medium: '2px solid #4A3F66',
    thin: '1px solid rgba(74,63,102,0.6)',
  },
} as const;

export const playgroundSpacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  '3xl': '64px',
} as const;

// XP Level definitions
// Canonical thresholds/names - must match server's levelThresholds in server/routes/xp.routes.js
// and the DB's award_xp() function. Do not diverge without updating all three.
export const xpLevels = [
  { level: 1, name: 'Curious Learner', minXP: 0, maxXP: 200 },
  { level: 2, name: 'Rising Star', minXP: 200, maxXP: 500 },
  { level: 3, name: 'Quick Learner', minXP: 500, maxXP: 900 },
  { level: 4, name: 'Eager Student', minXP: 900, maxXP: 1500 },
  { level: 5, name: 'Knowledge Seeker', minXP: 1500, maxXP: 2500 },
  { level: 6, name: 'Brain Builder', minXP: 2500, maxXP: 3500 },
  { level: 7, name: 'Scholar', minXP: 3500, maxXP: 5000 },
  { level: 8, name: 'Master Mind', minXP: 5000, maxXP: 7000 },
  { level: 9, name: 'Grandmaster', minXP: 7000, maxXP: 10000 },
  { level: 10, name: 'Legend', minXP: 10000, maxXP: Infinity },
] as const;

export const xpAwards = {
  completeQuiz: 50,
  perfectQuiz: 100,
  reviewFlashcards: 30,
  chatSession: 20,
  uploadMaterial: 25,
  dailyLogin: 10,
  completeAllQuests: 50,
} as const;

export function getLevelForXP(xp: number) {
  for (let i = xpLevels.length - 1; i >= 0; i--) {
    if (xp >= xpLevels[i].minXP) return xpLevels[i];
  }
  return xpLevels[0];
}

export function getXPProgress(xp: number) {
  const level = getLevelForXP(xp);
  if (level.maxXP === Infinity) return 1;
  const progress = (xp - level.minXP) / (level.maxXP - level.minXP);
  return Math.min(Math.max(progress, 0), 1);
}

// Accent color rotation for cards
export const accentColors = ['coral', 'yellow', 'teal', 'lilac'] as const;
export type AccentColor = typeof accentColors[number];

export function getAccentColor(index: number): AccentColor {
  return accentColors[index % accentColors.length];
}

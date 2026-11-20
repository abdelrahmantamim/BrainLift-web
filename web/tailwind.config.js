/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["'Fredoka'", 'sans-serif'],
        body: ["'Nunito'", 'sans-serif'],
      },
      colors: {
        // Existing shadcn-style tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Playground palette
        pg: {
          cream: 'var(--pg-cream)',
          coral: 'var(--pg-coral)',
          yellow: 'var(--pg-yellow)',
          teal: 'var(--pg-teal)',
          lilac: 'var(--pg-lilac)',
          navy: 'var(--pg-navy)',
          indigo: 'var(--pg-indigo)',
          surface: 'var(--pg-surface)',
          text: 'var(--pg-text)',
          'text-secondary': 'var(--pg-text-secondary)',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: '16px',
        'card-lg': '20px',
        btn: '12px',
        pill: '999px',
      },
      boxShadow: {
        'clay-coral': '4px 4px 0px var(--pg-coral)',
        'clay-yellow': '4px 4px 0px var(--pg-yellow)',
        'clay-teal': '4px 4px 0px var(--pg-teal)',
        'clay-lilac': '4px 4px 0px var(--pg-lilac)',
        'clay-navy': '4px 4px 0px var(--pg-navy)',
        'clay-coral-hover': '2px 6px 0px var(--pg-coral)',
        'clay-yellow-hover': '2px 6px 0px var(--pg-yellow)',
        'clay-teal-hover': '2px 6px 0px var(--pg-teal)',
        'clay-lilac-hover': '2px 6px 0px var(--pg-lilac)',
        'clay-navy-hover': '2px 6px 0px var(--pg-navy)',
        'pg-subtle': '0 2px 12px rgba(0,0,0,0.08)',
      },
      borderWidth: {
        '3': '3px',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'hero-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(3deg)' },
          '75%': { transform: 'rotate(-3deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(5deg)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'xp-fill': {
          from: { width: '0%' },
          to: { width: 'var(--xp-width, 65%)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'celebrate-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'brain-lift': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      animation: {
        'hero-bounce': 'hero-bounce 2.4s ease-in-out infinite',
        wobble: 'wobble 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'xp-fill': 'xp-fill 1.5s ease-out 0.5s forwards',
        wiggle: 'wiggle 1.5s ease-in-out infinite',
        'celebrate-pop': 'celebrate-pop 0.4s ease-out forwards',
        'brain-lift': 'brain-lift 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
}

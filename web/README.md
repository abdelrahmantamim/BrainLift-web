# BrainLift Web Application

Modern web version of the AI Tutoring App built with React, TypeScript, Tailwind CSS, and Shadcn UI.

## Tech Stack

- **Frontend Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **State Management**: Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios with interceptors
- **Build Tool**: Vite
- **UI Features**: Glass morphism design, responsive layout

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update the API URL in `.env`:
```
VITE_API_URL=http://localhost:3001/api
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Features

- ✅ Responsive design with adaptive layouts
  - Desktop: Collapsible sidebar navigation
  - Mobile: Bottom navigation bar
- ✅ Glass morphism design system
- ✅ Authentication with JWT tokens and refresh mechanism
- ✅ Protected routes
- ✅ API interceptors for automatic token refresh
- ✅ Dark/Light theme support
- ✅ Modern UI with smooth animations

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── auth/        # Authentication components
│   ├── layout/      # Layout components (Sidebar, Header, etc.)
│   ├── common/      # Shared components
│   ├── chat/        # Chat-related components
│   ├── quiz/        # Quiz components
│   ├── flashcards/  # Flashcard components
│   └── files/       # File management components
├── pages/           # Route-based page components
├── services/        # API services and utilities
├── store/           # Zustand store definitions
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── config/          # Configuration files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler check

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: http://localhost:3001/api)

## Next Steps

The foundation is set up with:
- Authentication flow ready to be connected
- Responsive layout system
- State management
- API configuration

To continue development:
1. Implement the authentication forms functionality
2. Build out the core features (Chat, Files, Quizzes, Flashcards)
3. Add real-time features with WebSocket
4. Implement file upload functionality
5. Add PWA support for mobile-like experience
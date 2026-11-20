import { Link } from 'react-router-dom';
import BrainLiftLogo from '@/assets/brainlift-liftlogo.png';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-pg-cream px-4">
      <div className="text-center">
        <img src={BrainLiftLogo} alt="BrainLift" className="h-24 w-auto mx-auto mb-6" />
        <h1 className="text-8xl font-heading font-bold text-pg-coral">404</h1>
        <p className="mt-4 text-xl text-pg-navy font-heading font-semibold">Page not found</p>
        <p className="mt-2 text-pg-text-secondary font-body">The page you are looking for does not exist.</p>
        <Link
          to="/"
          className="mt-8 inline-block pg-btn pg-btn-coral"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}

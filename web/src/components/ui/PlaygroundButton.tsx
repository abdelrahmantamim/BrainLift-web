import React from 'react';
import type { AccentColor } from '@/styles/playground-theme';

type ButtonVariant = AccentColor | 'outline' | 'navy';
type ButtonSize = 'sm' | 'md' | 'lg';

interface PlaygroundButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  as?: 'button' | 'a';
  href?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  coral: 'bg-pg-coral text-white shadow-clay-navy hover:shadow-clay-navy-hover',
  yellow: 'bg-pg-yellow text-pg-navy shadow-clay-navy hover:shadow-clay-navy-hover',
  teal: 'bg-pg-teal text-white shadow-clay-navy hover:shadow-clay-navy-hover',
  lilac: 'bg-pg-lilac text-white shadow-clay-navy hover:shadow-clay-navy-hover',
  navy: 'bg-pg-navy text-white shadow-[4px_4px_0px_var(--pg-coral)] hover:shadow-[2px_6px_0px_var(--pg-coral)]',
  outline: 'bg-transparent text-pg-navy border-pg-navy hover:bg-pg-cream',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-9 py-4 text-lg',
};

export const PlaygroundButton: React.FC<PlaygroundButtonProps> = ({
  children,
  variant = 'coral',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  className = '',
  disabled,
  as = 'button',
  href,
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    font-heading font-semibold
    border-2 border-pg-navy rounded-btn
    transition-all duration-200 cursor-pointer
    hover:-translate-y-0.5
    active:translate-y-0.5
    focus:outline-none focus:ring-2 focus:ring-pg-coral/30
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  if (as === 'a' && href) {
    return (
      <a href={href} className={baseClasses}>
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
        {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
      </a>
    );
  }

  return (
    <button className={baseClasses} disabled={disabled} {...props}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  );
};

export default PlaygroundButton;

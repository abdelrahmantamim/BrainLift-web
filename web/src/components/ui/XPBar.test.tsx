import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XPBar } from './XPBar';

describe('XPBar', () => {
  it('falls back to the local level table when no server level is provided', () => {
    render(<XPBar currentXP={250} showLabel />);
    // 250 XP falls in the "Rising Star" band (200-500) per the canonical table.
    expect(screen.getByText(/Rising Star/)).toBeInTheDocument();
  });

  it('prefers the server-provided level/levelName over the local table', () => {
    render(<XPBar currentXP={250} level={9} levelName="Grandmaster" showLabel />);
    expect(screen.getByText(/Grandmaster/)).toBeInTheDocument();
    expect(screen.getByText(/Lv\.9/)).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { xpLevels, getLevelForXP } from '../playground-theme';

describe('xpLevels (canonical table)', () => {
  it('has 10 entries', () => {
    expect(xpLevels).toHaveLength(10);
  });

  it('xpLevels[1] matches the canonical Rising Star threshold', () => {
    expect(xpLevels[1]).toMatchObject({ level: 2, name: 'Rising Star', minXP: 200 });
  });

  it('getLevelForXP(250) resolves to Rising Star', () => {
    expect(getLevelForXP(250).name).toBe('Rising Star');
  });

  it('getLevelForXP(9999) resolves to Grandmaster', () => {
    expect(getLevelForXP(9999).name).toBe('Grandmaster');
  });

  it('getLevelForXP(10000) resolves to Legend', () => {
    expect(getLevelForXP(10000).name).toBe('Legend');
  });
});

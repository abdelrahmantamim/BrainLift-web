import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const DESIGNS = [
  { path: '/4', label: 'Playground', color: '#FF6B6B' },
  { path: '/6', label: 'Candy Pop', color: '#FF69B4' },
  { path: '/7', label: 'Retro Arcade', color: '#39FF14' },
  { path: '/8', label: 'Sticker Book', color: '#E74C3C' },
  { path: '/9', label: 'Cosmic Quest', color: '#8B5CF6' },
  { path: '/10', label: 'Nature Explorer', color: '#2D6A4F' },
];

const STYLES = `
.ds-wrap {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 99999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.ds-toggle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.3);
  background: rgba(30,30,30,0.9);
  backdrop-filter: blur(12px);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  transition: all 0.2s ease;
}
.ds-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 28px rgba(0,0,0,0.5);
}

.ds-panel {
  position: absolute;
  bottom: 60px;
  right: 0;
  background: rgba(20,20,20,0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 14px;
  padding: 8px;
  min-width: 200px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
  opacity: 0;
  transform: translateY(8px) scale(0.95);
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ds-panel.ds-open {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: all;
}

.ds-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(255,255,255,0.4);
  padding: 6px 10px 4px;
}

.ds-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  color: rgba(255,255,255,0.75);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  transition: all 0.15s ease;
}
.ds-item:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
.ds-item.ds-active {
  background: rgba(255,255,255,0.12);
  color: #fff;
}

.ds-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid rgba(255,255,255,0.2);
}
.ds-active .ds-dot {
  border-color: transparent;
  box-shadow: 0 0 6px currentColor;
}

.ds-check {
  margin-left: auto;
  font-size: 14px;
  opacity: 0;
}
.ds-active .ds-check {
  opacity: 1;
}
`;

export function DesignSwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="ds-wrap">
      <style>{STYLES}</style>
      <div className={`ds-panel ${open ? 'ds-open' : ''}`}>
        <div className="ds-title">Switch Design</div>
        {DESIGNS.map((d) => (
          <button
            key={d.path}
            className={`ds-item ${location.pathname === d.path ? 'ds-active' : ''}`}
            onClick={() => {
              navigate(d.path);
              setOpen(false);
            }}
          >
            <span className="ds-dot" style={{ background: d.color }} />
            {d.label}
            <span className="ds-check">&#10003;</span>
          </button>
        ))}
      </div>
      <button
        className="ds-toggle"
        onClick={() => setOpen(!open)}
        aria-label="Switch design"
        title="Switch design"
      >
        {open ? '\u2715' : '\u270E'}
      </button>
    </div>
  );
}

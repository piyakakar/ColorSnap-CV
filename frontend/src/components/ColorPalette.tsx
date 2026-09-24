import React from 'react';
import { Palette } from 'lucide-react';
import { SUPPORTED_COLORS } from '../utils/colorDetector';
import { SupportedColorName } from '../types';

interface ColorPaletteProps {
  activeColor: SupportedColorName | null;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ activeColor }) => {
  return (
    <div className="glass-card palette-card">
      <div className="section-title-row">
        <h2 className="section-heading">
          <Palette size={20} color="#6366f1" />
          Supported Color Palette (10 Classes)
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          HSV Calibrated Ranges
        </span>
      </div>

      <div className="palette-grid">
        {SUPPORTED_COLORS.map((col) => {
          const isActive = activeColor?.toLowerCase() === col.name.toLowerCase();

          return (
            <div
              key={col.name}
              className={`palette-item ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? col.hex : 'var(--border-color)',
                backgroundColor: isActive ? col.badgeBg : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              {isActive && <div className="palette-indicator" />}
              <div
                className="palette-swatch"
                style={{
                  backgroundColor: col.hex,
                  boxShadow: isActive ? `0 0 14px ${col.hex}` : 'none',
                }}
              />
              <span className="palette-name" style={{ color: isActive ? '#ffffff' : col.textColor }}>
                {col.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

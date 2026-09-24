import React from 'react';
import { Sparkles, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { SupportedColorName } from '../types';

interface ResultPanelProps {
  detectedColor: SupportedColorName | null;
  confidence: number;
  hexCode: string;
  rgb: { r: number; g: number; b: number };
  hsv: { h: number; s: number; v: number };
  isCameraActive: boolean;
  isHandDetected: boolean;
  isObjectDetected: boolean;
  statusMessage: string;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({
  detectedColor,
  confidence,
  hexCode,
  rgb,
  hsv,
  isCameraActive,
  isHandDetected,
  isObjectDetected,
  statusMessage,
}) => {
  const isHighConfidence = confidence >= 70;
  const isLowConfidence = isCameraActive && detectedColor && confidence < 60;

  return (
    <div className="glass-card result-card">
      <div className="section-title-row">
        <h2 className="section-heading">
          <Sparkles size={20} color="#ec4899" />
          Detection Result
        </h2>
        {detectedColor && (
          <div className="badge success">
            <ShieldCheck size={12} />
            <span>{isHighConfidence ? 'Stable Detection' : 'Analyzing'}</span>
          </div>
        )}
      </div>

      {/* Main Detected Color Card */}
      <div
        className="detected-color-display"
        style={{
          boxShadow: detectedColor ? `0 0 40px ${hexCode}33` : 'none',
          borderColor: detectedColor ? `${hexCode}66` : 'var(--border-color)',
        }}
      >
        <div
          className="color-swatch-circle"
          style={{
            backgroundColor: detectedColor ? hexCode : '#1e293b',
            boxShadow: detectedColor ? `0 0 30px ${hexCode}88` : 'none',
          }}
        />

        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Detected Color
          </div>
          <h1
            className="detected-color-name"
            style={{
              color: detectedColor ? (detectedColor === 'White' ? '#ffffff' : hexCode) : 'var(--text-dim)',
            }}
          >
            {detectedColor ? detectedColor : (isCameraActive ? 'SEARCHING...' : 'CAMERA OFF')}
          </h1>
        </div>

        {/* Confidence Meter */}
        <div className="confidence-section">
          <div className="confidence-header">
            <span>Confidence</span>
            <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#fff' }}>
              {detectedColor ? `${confidence}%` : '0%'}
            </span>
          </div>
          <div className="confidence-bar-bg">
            <div
              className="confidence-bar-fill"
              style={{
                width: `${detectedColor ? confidence : 0}%`,
                background: confidence > 75 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : 'linear-gradient(90deg, #f59e0b, #ef4444)',
              }}
            />
          </div>
        </div>
      </div>

      {/* CV Metrics Grid */}
      <div className="color-metrics-grid">
        <div className="metric-box">
          <div className="metric-label">HSV Color Space</div>
          <div className="metric-value">
            {detectedColor ? `H:${Math.round(hsv.h)}° S:${Math.round(hsv.s * 100)}% V:${Math.round(hsv.v * 100)}%` : '--'}
          </div>
        </div>

        <div className="metric-box">
          <div className="metric-label">RGB Sample</div>
          <div className="metric-value">
            {detectedColor ? `R:${rgb.r} G:${rgb.g} B:${rgb.b}` : '--'}
          </div>
        </div>
      </div>

      {/* Dynamic Feedback / Guidance */}
      {isCameraActive && (
        <div className={`feedback-banner ${isLowConfidence ? 'warning' : 'info'}`}>
          {isLowConfidence ? (
            <>
              <AlertTriangle size={18} />
              <span>Low confidence. Move the object closer to the camera or improve lighting.</span>
            </>
          ) : !isHandDetected ? (
            <>
              <AlertTriangle size={18} />
              <span>Place your hand holding an object in front of the camera.</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              <span>{statusMessage || 'Object detected and color analyzed.'}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { Eye, Database, Activity } from 'lucide-react';

interface HeaderProps {
  dbConnected: boolean;
  isCameraActive: boolean;
  fps: number;
}

export const Header: React.FC<HeaderProps> = ({ dbConnected, isCameraActive, fps }) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-icon">
          <Eye size={24} color="#ffffff" />
        </div>
        <div>
          <h1 className="brand-title">ColorSnap</h1>
          <p className="brand-subtitle">Real-Time Handheld Object Color Detector</p>
        </div>
      </div>

      <div className="header-badges">
        {isCameraActive && (
          <div className="badge success">
            <Activity size={12} />
            <span>{fps} FPS</span>
          </div>
        )}

        <div className={`badge ${dbConnected ? 'success' : 'warning'}`}>
          <Database size={12} />
          <span className="badge-dot pulse" />
          <span>{dbConnected ? 'MongoDB Connected' : 'Local Persistence'}</span>
        </div>
      </div>
    </header>
  );
};

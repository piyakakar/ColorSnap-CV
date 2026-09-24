import React, { useRef, useEffect } from 'react';
import { Camera, CameraOff, RefreshCw, Hand, Box, CheckCircle2 } from 'lucide-react';
import { BoundingBox } from '../types';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isCameraActive: boolean;
  isHandDetected: boolean;
  isObjectDetected: boolean;
  objectBox: BoundingBox | null;
  handLandmarks: { x: number; y: number }[] | null;
  onStartCamera: () => void;
  onStopCamera: () => void;
  error: string | null;
  detectedColorHex: string;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  isCameraActive,
  isHandDetected,
  isObjectDetected,
  objectBox,
  handLandmarks,
  onStartCamera,
  onStopCamera,
  error,
  detectedColorHex,
}) => {
  const [isMirrored, setIsMirrored] = React.useState(true);

  // Render canvas overlays whenever landmarks or objectBox update
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isCameraActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Draw Hand Landmarks if available
    if (handLandmarks && handLandmarks.length > 0) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.75)';
      for (const pt of handLandmarks) {
        // adjust for mirror if mirrored
        const x = (isMirrored ? (1 - pt.x) : pt.x) * w;
        const y = pt.y * h;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw Object Bounding Box
    if (objectBox) {
      const boxX = (isMirrored ? (1 - objectBox.x - objectBox.width) : objectBox.x) * w;
      const boxY = objectBox.y * h;
      const boxW = objectBox.width * w;
      const boxH = objectBox.height * h;

      // Draw subtle box glow
      ctx.shadowColor = detectedColorHex || '#6366f1';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = detectedColorHex || '#6366f1';
      ctx.lineWidth = 2.5;

      // Rounded rectangle or corner bracket bounding box
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      // Label background
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
      ctx.fillRect(boxX, boxY - 26, Math.max(110, boxW * 0.5), 24);
      ctx.strokeStyle = detectedColorHex || '#6366f1';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY - 26, Math.max(110, boxW * 0.5), 24);

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText('HELD OBJECT ROI', boxX + 8, boxY - 9);
    }
  }, [handLandmarks, objectBox, isCameraActive, isMirrored, detectedColorHex]);

  return (
    <div className="glass-card camera-card">
      <div className="section-title-row">
        <h2 className="section-heading">
          <Camera size={20} color="#6366f1" />
          Live Camera Feed
        </h2>
        {isCameraActive && (
          <button
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={() => setIsMirrored(!isMirrored)}
            title="Mirror Camera"
          >
            <RefreshCw size={14} />
            {isMirrored ? 'Mirrored' : 'Normal'}
          </button>
        )}
      </div>

      <div className="video-container">
        <video
          ref={videoRef}
          className={`video-element ${!isMirrored ? 'no-mirror' : ''}`}
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={canvasRef}
          className="canvas-overlay"
          width={640}
          height={480}
        />

        {!isCameraActive && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon">
              <CameraOff size={32} />
            </div>
            <div>
              <h3 style={{ color: '#fff', marginBottom: '0.3rem' }}>Camera is Inactive</h3>
              <p style={{ fontSize: '0.85rem' }}>
                Click below to start your webcam and begin detecting handheld colors.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Camera Controls */}
      <div className="camera-controls">
        {!isCameraActive ? (
          <button id="start-camera-btn" className="btn btn-primary" onClick={onStartCamera}>
            <Camera size={18} />
            Start Camera
          </button>
        ) : (
          <button id="stop-camera-btn" className="btn btn-danger" onClick={onStopCamera}>
            <CameraOff size={18} />
            Stop Camera
          </button>
        )}
      </div>

      {/* Status Chips */}
      <div className="status-chips-row">
        <div className={`status-chip ${isCameraActive ? 'active' : ''}`}>
          <span className="badge-dot" style={{ backgroundColor: isCameraActive ? '#6366f1' : '#64748b' }} />
          Camera {isCameraActive ? 'Active' : 'Offline'}
        </div>

        <div className={`status-chip ${isHandDetected ? 'active hand' : ''}`}>
          <Hand size={14} />
          {isHandDetected ? 'Hand Detected' : 'No Hand Detected'}
        </div>

        <div className={`status-chip ${isObjectDetected ? 'active object' : ''}`}>
          <Box size={14} />
          {isObjectDetected ? 'Object In ROI' : 'No Object In ROI'}
        </div>
      </div>
    </div>
  );
};

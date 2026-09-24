import React from 'react';
import { Camera, CameraOff, RefreshCw, Hand, Box } from 'lucide-react';
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
  isMirrored: boolean;
  setIsMirrored: (mirror: boolean | ((prev: boolean) => boolean)) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  isCameraActive,
  isHandDetected,
  isObjectDetected,
  onStartCamera,
  onStopCamera,
  isMirrored,
  setIsMirrored,
}) => {
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
            onClick={() => setIsMirrored((prev) => !prev)}
            title="Mirror Camera"
          >
            <RefreshCw size={14} />
            {isMirrored ? 'Mirrored' : 'Normal'}
          </button>
        )}
      </div>

      <div className="video-container">
        {/* Hidden video element for receiving the media stream */}
        <video
          ref={videoRef}
          style={{ display: 'none' }}
          playsInline
          muted
          autoPlay
        />
        {/* Canvas that renders the camera feed and overlays synchronously */}
        <canvas
          ref={canvasRef}
          className="canvas-view"
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

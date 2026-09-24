import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { CameraView } from './components/CameraView';
import { ResultPanel } from './components/ResultPanel';
import { ColorPalette } from './components/ColorPalette';
import { HistoryList } from './components/HistoryList';
import {
  rgbToHsv,
  isSkinTone,
  classifyHsvPixel,
  calculateAverageColor,
  StabilityManager,
  SUPPORTED_COLORS,
  RGB,
} from './utils/colorDetector';
import { createHandTracker, getCentralTargetBox, HandLandmark } from './utils/handTracker';
import { SupportedColorName, DetectionRecord, BoundingBox } from './types';
import { AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  // State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [detectedColor, setDetectedColor] = useState<SupportedColorName | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [hexCode, setHexCode] = useState<string>('#6366f1');
  const [rgb, setRgb] = useState<RGB>({ r: 0, g: 0, b: 0 });
  const [hsv, setHsv] = useState<{ h: number; s: number; v: number }>({ h: 0, s: 0, v: 0 });
  
  const [isHandDetected, setIsHandDetected] = useState<boolean>(false);
  const [isObjectDetected, setIsObjectDetected] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [objectBox, setObjectBox] = useState<BoundingBox | null>(null);
  const [handLandmarks, setHandLandmarks] = useState<{ x: number; y: number }[] | null>(null);

  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [history, setHistory] = useState<DetectionRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(30);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const stabilityManagerRef = useRef<StabilityManager>(new StabilityManager(7));
  const handTrackerRef = useRef<{ processFrame: (video: HTMLVideoElement) => Promise<void>; close: () => void } | null>(null);
  const isTrackingRef = useRef<boolean>(false);
  const lastTrackingTimeRef = useRef<number>(0);
  
  const lastSavedColorRef = useRef<string | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const latestHandResultRef = useRef<{
    hasHand: boolean;
    landmarks: HandLandmark[] | null;
    objectBox: BoundingBox | null;
  }>({
    hasHand: false,
    landmarks: null,
    objectBox: null,
  });

  // Fetch backend status & detection history
  const fetchBackendData = useCallback(async () => {
    try {
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setDbConnected(Boolean(healthData.dbConnected));
      }

      setIsLoadingHistory(true);
      const detectionsRes = await fetch('/api/detections');
      if (detectionsRes.ok) {
        const detectionsData = await detectionsRes.json();
        if (detectionsData.success && Array.isArray(detectionsData.data)) {
          setHistory(detectionsData.data);
        }
      }
    } catch (err) {
      console.warn('Backend API connection issue:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchBackendData();
    const interval = setInterval(fetchBackendData, 10000);
    return () => clearInterval(interval);
  }, [fetchBackendData]);

  // Save detection to backend
  const saveDetectionToBackend = useCallback(async (color: SupportedColorName, conf: number, hex: string) => {
    const now = Date.now();
    if (lastSavedColorRef.current === color && now - lastSavedTimeRef.current < 4000) {
      return;
    }

    lastSavedColorRef.current = color;
    lastSavedTimeRef.current = now;

    try {
      const res = await fetch('/api/detections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color,
          confidence: conf,
          hexCode: hex,
          timestamp: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setHistory((prev) => [data.data, ...prev.slice(0, 24)]);
        }
      }
    } catch (e) {
      console.warn('Failed to auto-save detection:', e);
    }
  }, []);

  // Clear history
  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/detections', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
      }
    } catch (e) {
      console.error('Error clearing history:', e);
    }
  };

  // Computer Vision Processing Pipeline
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const w = canvas.width;
    const h = canvas.height;

    // Measure FPS
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    // Run Hand Tracking throttled asynchronously (every 180ms) to maintain 60 FPS smoothly
    if (handTrackerRef.current && !isTrackingRef.current && now - lastTrackingTimeRef.current > 180) {
      isTrackingRef.current = true;
      lastTrackingTimeRef.current = now;
      handTrackerRef.current.processFrame(video).finally(() => {
        isTrackingRef.current = false;
      });
    }

    // 1. Draw live webcam frame directly onto the visible canvas
    ctx.save();
    if (isMirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // 2. Prepare offscreen unmirrored canvas for reliable pixel processing
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = w;
      offscreenCanvasRef.current.height = h;
    }
    const offscreen = offscreenCanvasRef.current;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
    if (offCtx) {
      offCtx.drawImage(video, 0, 0, w, h);
    }

    const handState = latestHandResultRef.current;
    const hasHand = handState.hasHand;
    setIsHandDetected(hasHand);
    setHandLandmarks(handState.landmarks);

    // Determine Object Region of Interest (ROI)
    const roiBox = (hasHand && handState.objectBox) ? handState.objectBox : getCentralTargetBox();
    setObjectBox(roiBox);

    const roiPixelX = Math.floor(roiBox.x * w);
    const roiPixelY = Math.floor(roiBox.y * h);
    const roiPixelW = Math.floor(roiBox.width * w);
    const roiPixelH = Math.floor(roiBox.height * h);

    if (offCtx && roiPixelW > 10 && roiPixelH > 10) {
      try {
        const frameData = offCtx.getImageData(roiPixelX, roiPixelY, roiPixelW, roiPixelH);
        const data = frameData.data;

        const colorHistogram: Record<SupportedColorName, number> = {
          Red: 0,
          Orange: 0,
          Yellow: 0,
          Green: 0,
          Cyan: 0,
          Blue: 0,
          Purple: 0,
          Pink: 0,
          White: 0,
          Black: 0,
        };

        const matchingColorPixels: Record<SupportedColorName, RGB[]> = {
          Red: [],
          Orange: [],
          Yellow: [],
          Green: [],
          Cyan: [],
          Blue: [],
          Purple: [],
          Pink: [],
          White: [],
          Black: [],
        };

        let validObjectPixelCount = 0;
        let skinPixelCount = 0;

        const centerX = roiPixelW / 2;
        const centerY = roiPixelH / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

        const step = 2; // fast 2x pixel sampling
        for (let y = 0; y < roiPixelH; y += step) {
          for (let x = 0; x < roiPixelW; x += step) {
            const index = (y * roiPixelW + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            const pixelRgb: RGB = { r, g, b };
            const pixelHsv = rgbToHsv(r, g, b);

            // Filter human skin tone
            if (isSkinTone(pixelRgb, pixelHsv)) {
              skinPixelCount++;
              continue;
            }

            const classified = classifyHsvPixel(pixelHsv, pixelRgb);
            if (classified) {
              const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
              const weight = 1 + (1 - dist / maxDist);

              colorHistogram[classified] += weight;
              matchingColorPixels[classified].push(pixelRgb);
              validObjectPixelCount += 1;
            }
          }
        }

        // Evaluate dominant color
        let candidateColor: SupportedColorName | null = null;
        let maxCount = 0;
        let totalWeighted = 0;

        for (const [colName, count] of Object.entries(colorHistogram) as [SupportedColorName, number][]) {
          totalWeighted += count;
          if (count > maxCount) {
            maxCount = count;
            candidateColor = colName;
          }
        }

        const dominanceRatio = totalWeighted > 0 ? maxCount / totalWeighted : 0;
        const hasObject = validObjectPixelCount >= 15 && dominanceRatio >= 0.25;
        setIsObjectDetected(hasObject);

        // Stability Filter
        const stabilityResult = stabilityManagerRef.current.addFrame(hasObject ? candidateColor : null);

        if (stabilityResult.isStable && stabilityResult.stableColor) {
          const matchedColor = stabilityResult.stableColor;
          const matchedDef = SUPPORTED_COLORS.find((c) => c.name === matchedColor);
          const colorPixels = matchingColorPixels[matchedColor] || [];
          const avgSample = calculateAverageColor(colorPixels);
          const sampleHsv = rgbToHsv(avgSample.rgb.r, avgSample.rgb.g, avgSample.rgb.b);

          const rawConf = Math.round((dominanceRatio * 0.45 + stabilityResult.stabilityScore * 0.55) * 100);
          const finalConfidence = Math.min(96, Math.max(68, rawConf));

          setDetectedColor(matchedColor);
          setConfidence(finalConfidence);
          setHexCode(matchedDef ? matchedDef.hex : avgSample.hex);
          setRgb(avgSample.rgb);
          setHsv(sampleHsv);
          setStatusMessage(`Object detected: ${matchedColor}`);

          saveDetectionToBackend(matchedColor, finalConfidence, matchedDef ? matchedDef.hex : avgSample.hex);
        } else if (!hasObject) {
          if (isCameraActive) {
            setStatusMessage(hasHand ? 'Hold an object inside your hand' : 'Place hand + object in frame');
          }
        }
      } catch (err) {
        console.error('CV frame analysis error:', err);
      }
    }

    // 3. Draw overlays onto the visible canvas
    // Hand Landmarks
    if (handState.landmarks && handState.landmarks.length > 0) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
      for (const pt of handState.landmarks) {
        const lx = (isMirrored ? (1 - pt.x) : pt.x) * w;
        const ly = pt.y * h;
        ctx.beginPath();
        ctx.arc(lx, ly, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Held Object ROI Bounding Box
    if (roiBox) {
      const boxX = (isMirrored ? (1 - roiBox.x - roiBox.width) : roiBox.x) * w;
      const boxY = roiBox.y * h;
      const boxW = roiBox.width * w;
      const boxH = roiBox.height * h;

      ctx.shadowColor = hexCode || '#6366f1';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = hexCode || '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
      ctx.fillRect(boxX, boxY - 24, Math.max(120, boxW * 0.5), 22);
      ctx.strokeStyle = hexCode || '#6366f1';
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY - 24, Math.max(120, boxW * 0.5), 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText('HELD OBJECT ROI', boxX + 8, boxY - 8);
    }

    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [isCameraActive, isMirrored, hexCode, saveDetectionToBackend]);

  // Start Camera
  const handleStartCamera = async () => {
    setErrorMessage(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;

      if (video) {
        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.onloadedmetadata = () => resolve();
          }
        });

        try {
          await video.play();
        } catch (playErr: any) {
          if (playErr.name !== 'AbortError') {
            console.warn('Video play warning:', playErr);
          }
        }
      }

      setIsCameraActive(true);
      stabilityManagerRef.current.reset();

      // Initialize MediaPipe Hands asynchronously
      if (!handTrackerRef.current) {
        createHandTracker((res) => {
          latestHandResultRef.current = res;
        }).then((tracker) => {
          handTrackerRef.current = tracker;
        });
      }

      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access is required. Please allow camera permission in your browser and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('No webcam detected. Please connect a webcam to continue.');
      } else {
        setErrorMessage(`Unable to access webcam: ${err.message || 'Unknown error'}`);
      }
    }
  };

  // Stop Camera
  const handleStopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (handTrackerRef.current) {
      handTrackerRef.current.close();
      handTrackerRef.current = null;
    }

    setIsCameraActive(false);
    setIsHandDetected(false);
    setIsObjectDetected(false);
    setDetectedColor(null);
    setConfidence(0);
    setObjectBox(null);
    setHandLandmarks(null);
    stabilityManagerRef.current.reset();
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="app-container">
      <Header dbConnected={dbConnected} isCameraActive={isCameraActive} fps={fps} />

      {errorMessage && (
        <div className="error-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={20} />
            <span>{errorMessage}</span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
            onClick={() => setErrorMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Live Camera & Detection Result */}
      <div className="main-grid">
        <CameraView
          videoRef={videoRef}
          canvasRef={canvasRef}
          isCameraActive={isCameraActive}
          isHandDetected={isHandDetected}
          isObjectDetected={isObjectDetected}
          objectBox={objectBox}
          handLandmarks={handLandmarks}
          onStartCamera={handleStartCamera}
          onStopCamera={handleStopCamera}
          error={errorMessage}
          detectedColorHex={hexCode}
          isMirrored={isMirrored}
          setIsMirrored={setIsMirrored}
        />

        <ResultPanel
          detectedColor={detectedColor}
          confidence={confidence}
          hexCode={hexCode}
          rgb={rgb}
          hsv={hsv}
          isCameraActive={isCameraActive}
          isHandDetected={isHandDetected}
          isObjectDetected={isObjectDetected}
          statusMessage={statusMessage}
        />
      </div>

      {/* Supported Color Palette with Live Highlight */}
      <ColorPalette activeColor={detectedColor} />

      {/* Detection History */}
      <HistoryList
        history={history}
        onClearHistory={handleClearHistory}
        isLoading={isLoadingHistory}
      />
    </div>
  );
};

export default App;

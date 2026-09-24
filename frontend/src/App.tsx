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
  const stabilityManagerRef = useRef<StabilityManager>(new StabilityManager(10));
  const handTrackerRef = useRef<{ processFrame: (video: HTMLVideoElement) => Promise<void>; close: () => void } | null>(null);
  
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
      // Health check
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setDbConnected(Boolean(healthData.dbConnected));
      }

      // Detections history
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
    // Poll history periodically
    const interval = setInterval(fetchBackendData, 10000);
    return () => clearInterval(interval);
  }, [fetchBackendData]);

  // Save detection to backend
  const saveDetectionToBackend = useCallback(async (color: SupportedColorName, conf: number, hex: string) => {
    const now = Date.now();
    // Only save if color changed OR 4 seconds passed since last save of same color
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
    if (!videoRef.current || videoRef.current.readyState < 2) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoRef.current;
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreen = offscreenCanvasRef.current;
    if (offscreen.width !== video.videoWidth || offscreen.height !== video.videoHeight) {
      offscreen.width = video.videoWidth || 640;
      offscreen.height = video.videoHeight || 480;
    }

    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Measure FPS
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    // Trigger MediaPipe tracking frame if ready
    if (handTrackerRef.current) {
      handTrackerRef.current.processFrame(video).catch(() => {});
    }

    // Draw video frame to offscreen canvas
    ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);

    const handState = latestHandResultRef.current;
    const hasHand = handState.hasHand;
    setIsHandDetected(hasHand);
    setHandLandmarks(handState.landmarks);

    // Determine Object Region of Interest (ROI)
    const roiBox = (hasHand && handState.objectBox) ? handState.objectBox : getCentralTargetBox();
    setObjectBox(roiBox);

    const roiPixelX = Math.floor(roiBox.x * offscreen.width);
    const roiPixelY = Math.floor(roiBox.y * offscreen.height);
    const roiPixelW = Math.floor(roiBox.width * offscreen.width);
    const roiPixelH = Math.floor(roiBox.height * offscreen.height);

    if (roiPixelW > 10 && roiPixelH > 10) {
      try {
        const frameData = ctx.getImageData(roiPixelX, roiPixelY, roiPixelW, roiPixelH);
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

        // Sample pixels with step for fast CV performance
        const step = 2; // sample every 2nd pixel (4x speedup)
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
              // Center-weighted voting (pixels closer to center of ROI have 1.5x - 2x vote)
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

        // Run through Temporal Stability Filter to eliminate flickering
        const stabilityResult = stabilityManagerRef.current.addFrame(hasObject ? candidateColor : null);

        if (stabilityResult.isStable && stabilityResult.stableColor) {
          const matchedColor = stabilityResult.stableColor;
          const matchedDef = SUPPORTED_COLORS.find((c) => c.name === matchedColor);
          const colorPixels = matchingColorPixels[matchedColor] || [];
          const avgSample = calculateAverageColor(colorPixels);
          const sampleHsv = rgbToHsv(avgSample.rgb.r, avgSample.rgb.g, avgSample.rgb.b);

          // Calculate confidence (capped at 96% to avoid unrealistic 100%)
          const rawConf = Math.round((dominanceRatio * 0.45 + stabilityResult.stabilityScore * 0.55) * 100);
          const finalConfidence = Math.min(96, Math.max(62, rawConf));

          setDetectedColor(matchedColor);
          setConfidence(finalConfidence);
          setHexCode(matchedDef ? matchedDef.hex : avgSample.hex);
          setRgb(avgSample.rgb);
          setHsv(sampleHsv);
          setStatusMessage(`Object detected: ${matchedColor}`);

          // Trigger backend save on stable detection event
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

    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [isCameraActive, saveDetectionToBackend]);

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

        // Safely wait for video metadata before playing
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

      // Initialize MediaPipe Hands
      if (!handTrackerRef.current) {
        const tracker = await createHandTracker((res) => {
          latestHandResultRef.current = res;
        });
        handTrackerRef.current = tracker;
      }

      // Start CV loop
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

import { BoundingBox } from '../types';

export interface HandLandmark {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  z?: number;
}

export interface HandDetectionResult {
  hasHand: boolean;
  landmarks: HandLandmark[] | null;
  handBox: BoundingBox | null;
  objectBox: BoundingBox | null;
}

/**
 * Initializes MediaPipe Hands if available on window
 */
export async function createHandTracker(
  onResults: (result: HandDetectionResult) => void
): Promise<{ processFrame: (videoElement: HTMLVideoElement) => Promise<void>; close: () => void } | null> {
  if (typeof window === 'undefined' || !window.Hands) {
    console.warn('MediaPipe Hands is not loaded from CDN yet, falling back to central ROI tracking');
    return null;
  }

  try {
    const hands = new window.Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results: any) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks: HandLandmark[] = results.multiHandLandmarks[0];

        // Compute Hand Bounding Box
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        for (const pt of landmarks) {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }

        // Add safety padding
        const padX = (maxX - minX) * 0.1;
        const padY = (maxY - minY) * 0.1;
        const hBox: BoundingBox = {
          x: Math.max(0, minX - padX),
          y: Math.max(0, minY - padY),
          width: Math.min(1 - minX, maxX - minX + padX * 2),
          height: Math.min(1 - minY, maxY - minY + padY * 2),
        };

        // Object Region: Calculate centered zone between palm center (landmark 0, 9) & fingers
        const palmX = (landmarks[0].x + landmarks[9].x) / 2;
        const palmY = (landmarks[0].y + landmarks[9].y) / 2;
        const objWidth = Math.min(0.35, Math.max(0.18, (maxX - minX) * 0.8));
        const objHeight = Math.min(0.35, Math.max(0.18, (maxY - minY) * 0.8));

        const objBox: BoundingBox = {
          x: Math.max(0.02, Math.min(0.98 - objWidth, palmX - objWidth / 2)),
          y: Math.max(0.02, Math.min(0.98 - objHeight, palmY - objHeight / 2)),
          width: objWidth,
          height: objHeight,
        };

        onResults({
          hasHand: true,
          landmarks,
          handBox: hBox,
          objectBox: objBox,
        });
      } else {
        onResults({
          hasHand: false,
          landmarks: null,
          handBox: null,
          objectBox: null,
        });
      }
    });

    return {
      processFrame: async (video: HTMLVideoElement) => {
        if (video && video.readyState >= 2) {
          await hands.send({ image: video });
        }
      },
      close: () => {
        try {
          hands.close();
        } catch (e) {
          console.error(e);
        }
      },
    };
  } catch (error) {
    console.error('Failed to initialize MediaPipe Hands:', error);
    return null;
  }
}

/**
 * Returns a fallback Central Object Target ROI when hand is not explicitly tracked via MediaPipe
 */
export function getCentralTargetBox(): BoundingBox {
  return {
    x: 0.32,
    y: 0.28,
    width: 0.36,
    height: 0.44,
  };
}

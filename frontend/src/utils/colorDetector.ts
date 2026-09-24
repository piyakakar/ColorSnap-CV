import { ColorDef, SupportedColorName } from '../types';

export const SUPPORTED_COLORS: ColorDef[] = [
  { name: 'Red', hex: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.2)', textColor: '#f87171', description: 'Red / Crimson / Scarlet' },
  { name: 'Orange', hex: '#f97316', badgeBg: 'rgba(249, 115, 22, 0.2)', textColor: '#fb923c', description: 'Orange / Amber / Peach' },
  { name: 'Yellow', hex: '#eab308', badgeBg: 'rgba(234, 179, 8, 0.2)', textColor: '#facc15', description: 'Yellow / Gold / Lemon' },
  { name: 'Green', hex: '#22c55e', badgeBg: 'rgba(34, 197, 94, 0.2)', textColor: '#4ade80', description: 'Green / Lime / Forest' },
  { name: 'Cyan', hex: '#06b6d4', badgeBg: 'rgba(6, 182, 212, 0.2)', textColor: '#22d3ee', description: 'Cyan / Aqua / Turquoise' },
  { name: 'Blue', hex: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.2)', textColor: '#60a5fa', description: 'Blue / Navy / Royal' },
  { name: 'Purple', hex: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.2)', textColor: '#c084fc', description: 'Purple / Violet / Indigo' },
  { name: 'Pink', hex: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.2)', textColor: '#f472b6', description: 'Pink / Magenta / Rose' },
  { name: 'White', hex: '#f8fafc', badgeBg: 'rgba(248, 250, 252, 0.2)', textColor: '#ffffff', description: 'White / Bright / Cream' },
  { name: 'Black', hex: '#18181b', badgeBg: 'rgba(24, 24, 27, 0.5)', textColor: '#9ca3af', description: 'Black / Dark Gray / Deep' },
];

export interface HSV {
  h: number; // 0 - 360
  s: number; // 0 - 1
  v: number; // 0 - 1
}

export interface RGB {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
}

/**
 * Convert RGB to HSV color space
 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6);
    } else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2);
    } else {
      h = 60 * ((rNorm - gNorm) / delta + 4);
    }
  }

  if (h < 0) {
    h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

/**
 * Determines whether a given pixel is likely skin tone to exclude human hand/fingers
 */
export function isSkinTone(rgb: RGB, hsv: HSV): boolean {
  const { r, g, b } = rgb;
  const { h, s, v } = hsv;

  // HSV skin range filter
  const isSkinHsv = ((h >= 0 && h <= 42) || h >= 335) && s >= 0.16 && s <= 0.72 && v >= 0.30 && v <= 0.98;

  // Standard RGB rule check for human skin
  const isSkinRgb = r > 60 && g > 40 && b > 20 && r > g && g > b && (r - g) >= 12;

  return isSkinHsv && isSkinRgb;
}

/**
 * Classify single HSV pixel into one of the 10 target colors
 */
export function classifyHsvPixel(hsv: HSV): SupportedColorName | null {
  const { h, s, v } = hsv;

  // 1. Black: Low Value (darkness)
  if (v < 0.22 || (v < 0.28 && s < 0.32)) {
    return 'Black';
  }

  // 2. White: High Value, very low Saturation
  if (v >= 0.72 && s <= 0.18) {
    return 'White';
  }

  // If saturation is too low but value is medium, it's neutral gray
  if (s < 0.16 && v >= 0.22 && v < 0.72) {
    return null;
  }

  // 3. Chromatic Colors based on Hue ranges with shade tolerance
  if ((h >= 345 && h <= 360) || (h >= 0 && h < 15)) {
    if (s >= 0.22 && v >= 0.20) return 'Red';
  } else if (h >= 15 && h < 45) {
    if (s >= 0.26 && v >= 0.26) return 'Orange';
  } else if (h >= 45 && h < 72) {
    if (s >= 0.22 && v >= 0.30) return 'Yellow';
  } else if (h >= 72 && h < 165) {
    if (s >= 0.18 && v >= 0.18) return 'Green';
  } else if (h >= 165 && h < 195) {
    if (s >= 0.20 && v >= 0.22) return 'Cyan';
  } else if (h >= 195 && h < 265) {
    if (s >= 0.22 && v >= 0.18) return 'Blue';
  } else if (h >= 265 && h < 315) {
    if (s >= 0.20 && v >= 0.18) return 'Purple';
  } else if (h >= 315 && h < 345) {
    if (s >= 0.18 && v >= 0.28) return 'Pink';
  }

  return null;
}

/**
 * Get average RGB and Hex from a sample of pixels
 */
export function calculateAverageColor(pixels: RGB[]): { rgb: RGB; hex: string } {
  if (pixels.length === 0) {
    return { rgb: { r: 128, g: 128, b: 128 }, hex: '#808080' };
  }

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (let i = 0; i < pixels.length; i++) {
    totalR += pixels[i].r;
    totalG += pixels[i].g;
    totalB += pixels[i].b;
  }

  const r = Math.round(totalR / pixels.length);
  const g = Math.round(totalG / pixels.length);
  const b = Math.round(totalB / pixels.length);

  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

  return { rgb: { r, g, b }, hex };
}

/**
 * Stability Manager to prevent flickering across frames
 */
export class StabilityManager {
  private history: (SupportedColorName | null)[] = [];
  private windowSize: number;

  constructor(windowSize: number = 8) {
    this.windowSize = windowSize;
  }

  public addFrame(color: SupportedColorName | null): {
    stableColor: SupportedColorName | null;
    stabilityScore: number;
    isStable: boolean;
  } {
    this.history.push(color);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    const counts: Record<string, number> = {};
    let validFrames = 0;

    for (const c of this.history) {
      if (c) {
        counts[c] = (counts[c] || 0) + 1;
        validFrames++;
      }
    }

    let dominantColor: SupportedColorName | null = null;
    let maxCount = 0;

    for (const [col, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = col as SupportedColorName;
      }
    }

    const stabilityRatio = this.history.length > 0 ? maxCount / this.history.length : 0;
    const isStable = stabilityRatio >= 0.60 && maxCount >= 3;

    return {
      stableColor: isStable ? dominantColor : null,
      stabilityScore: stabilityRatio,
      isStable,
    };
  }

  public reset(): void {
    this.history = [];
  }
}

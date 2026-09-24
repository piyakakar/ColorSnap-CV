import { ColorDef, SupportedColorName } from '../types';

export const SUPPORTED_COLORS: ColorDef[] = [
  { name: 'Red', hex: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.2)', textColor: '#f87171', description: 'Red / Crimson / Scarlet' },
  { name: 'Orange', hex: '#f97316', badgeBg: 'rgba(249, 115, 22, 0.2)', textColor: '#fb923c', description: 'Orange / Amber / Tangerine' },
  { name: 'Yellow', hex: '#eab308', badgeBg: 'rgba(234, 179, 8, 0.2)', textColor: '#facc15', description: 'Yellow / Gold / Lemon' },
  { name: 'Green', hex: '#22c55e', badgeBg: 'rgba(34, 197, 94, 0.2)', textColor: '#4ade80', description: 'Green / Lime / Forest / Emerald' },
  { name: 'Cyan', hex: '#06b6d4', badgeBg: 'rgba(6, 182, 212, 0.2)', textColor: '#22d3ee', description: 'Cyan / Aqua / Turquoise / Sky' },
  { name: 'Blue', hex: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.2)', textColor: '#60a5fa', description: 'Blue / Navy / Royal / Cobalt' },
  { name: 'Purple', hex: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.2)', textColor: '#c084fc', description: 'Purple / Violet / Indigo / Lavender' },
  { name: 'Pink', hex: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.2)', textColor: '#f472b6', description: 'Pink / Magenta / Rose / Hot Pink' },
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
 * Convert RGB to HSV color space with high precision
 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta > 0.001) {
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
 * Accurately check if a pixel is human skin tone (to avoid filtering out yellow/orange objects)
 */
export function isSkinTone(rgb: RGB, hsv: HSV): boolean {
  const { r, g, b } = rgb;
  const { h, s, v } = hsv;

  // Strict skin chromatic range: Hue 6° to 34°, moderate saturation, good lighting
  const isSkinHue = (h >= 6 && h <= 34);
  const isSkinSat = s >= 0.20 && s <= 0.65;
  const isSkinVal = v >= 0.35 && v <= 0.92;

  // Exact RGB biometric differential for human skin
  // In human skin: R > G > B, and (R - G) is strictly between 12 and 75, (G - B) is between 6 and 50
  const isSkinRgb = (
    r > 75 &&
    g > 45 &&
    b > 25 &&
    r > g &&
    g > b &&
    (r - g) >= 12 &&
    (r - g) <= 75 &&
    (g - b) >= 6 &&
    (g - b) <= 50
  );

  return isSkinHue && isSkinSat && isSkinVal && isSkinRgb;
}

/**
 * Robust, highly accurate HSV + RGB hybrid classification for 10 color classes
 * Handles real-world webcam conditions, auto-exposure, and lighting shifts.
 */
export function classifyHsvPixel(hsv: HSV, rgb: RGB): SupportedColorName | null {
  const { h, s, v } = hsv;
  const { r, g, b } = rgb;

  const maxVal = Math.max(r, g, b);
  const minVal = Math.min(r, g, b);
  const chroma = maxVal - minVal; // RGB spread

  // 1. BLACK: Low overall brightness or dark surfaces
  // e.g., Black TV remotes, black phones, dark gray items
  if (v < 0.22 || (v < 0.32 && s < 0.30 && maxVal < 80)) {
    return 'Black';
  }

  // 2. WHITE: High brightness across all channels and very low color difference
  // e.g., White paper, white bottles, white cards
  if (v >= 0.70 && s <= 0.15 && r > 165 && g > 165 && b > 165 && chroma <= 28) {
    return 'White';
  }

  // Discard neutral uncolored grays (prevents webcam background noise from registering as Red)
  if (s < 0.14 && chroma < 22) {
    return null;
  }

  // 3. GREEN: Strong green channel, hue between 75° and 165°
  // Handles lime green, dark green, forest green, neon green
  if ((h >= 75 && h < 165) || (g > r + 15 && g > b + 15 && g > 55)) {
    if (g >= r - 10 && g >= b + 10 && (s >= 0.16 || chroma >= 25)) {
      return 'Green';
    }
  }

  // 4. BLUE: Strong blue channel, hue between 195° and 260°
  // Handles navy blue, royal blue, sky blue, light blue
  if ((h >= 195 && h < 260) || (b > r + 15 && b > g + 10 && b > 55)) {
    if (b >= r + 10 && (s >= 0.16 || chroma >= 25)) {
      return 'Blue';
    }
  }

  // 5. YELLOW: Strong Red + Green channels, Low Blue, hue between 45° and 75°
  // Handles yellow sticky notes, yellow sponges, highlighters, lemon
  if ((h >= 45 && h < 75) || (r > 90 && g > 90 && (r + g) / 2 > b + 35)) {
    if (r > b + 30 && g > b + 30 && (s >= 0.18 || chroma >= 30) && v >= 0.30) {
      return 'Yellow';
    }
  }

  // 6. CYAN / AQUA: Strong Green + Blue channels, hue between 165° and 195°
  // Handles turquoise, aqua, cyan caps
  if ((h >= 165 && h < 195) || (g > 70 && b > 70 && (g + b) / 2 > r + 30)) {
    if (b > r + 20 && g > r + 20 && s >= 0.16) {
      return 'Cyan';
    }
  }

  // 7. ORANGE: Red > Green > Blue with hue between 14° and 45°
  // Handles orange fruit, amber, orange notebooks
  if (h >= 14 && h < 45 && r > g + 12 && g > b + 15 && s >= 0.28 && v >= 0.30) {
    return 'Orange';
  }

  // 8. PURPLE / VIOLET: Strong Blue + Red channels, Low Green, hue between 260° and 315°
  // Handles violet, lavender, indigo markers
  if ((h >= 260 && h < 315) || (b > g + 20 && r > g + 15 && maxVal > 60)) {
    if (b > g + 12 && s >= 0.18 && v >= 0.20) {
      return 'Purple';
    }
  }

  // 9. PINK / MAGENTA: High Red + moderate Blue, hue between 315° and 345°
  // Handles pink erasers, magenta, rose
  if ((h >= 315 && h < 345) || (r > g + 30 && b > g + 10 && v >= 0.35)) {
    if (r > g + 20 && s >= 0.18) {
      return 'Pink';
    }
  }

  // 10. RED: Strong Red channel, Hue wraps around [345°, 360°] and [0°, 14°]
  // Must have R strictly greater than G and B to prevent neutral/gray false positives!
  if ((h >= 345 || h < 14)) {
    if (r > g + 25 && r > b + 25 && s >= 0.22 && v >= 0.22) {
      return 'Red';
    }
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
 * Responsive Stability Manager to prevent flickering while adapting rapidly
 */
export class StabilityManager {
  private history: (SupportedColorName | null)[] = [];
  private windowSize: number;

  constructor(windowSize: number = 7) {
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
    // Fast response: stable if dominant color is present in at least 50% of recent window (min 3 frames)
    const isStable = stabilityRatio >= 0.50 && maxCount >= 3;

    return {
      stableColor: isStable ? dominantColor : (validFrames >= 2 ? dominantColor : null),
      stabilityScore: Math.max(0.65, stabilityRatio),
      isStable: isStable || validFrames >= 3,
    };
  }

  public reset(): void {
    this.history = [];
  }
}

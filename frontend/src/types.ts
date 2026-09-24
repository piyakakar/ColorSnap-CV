export type SupportedColorName =
  | 'Red'
  | 'Orange'
  | 'Yellow'
  | 'Green'
  | 'Cyan'
  | 'Blue'
  | 'Purple'
  | 'Pink'
  | 'White'
  | 'Black';

export interface ColorDef {
  name: SupportedColorName;
  hex: string;
  badgeBg: string;
  textColor: string;
  description: string;
}

export interface DetectionRecord {
  _id?: string;
  color: string;
  confidence: number;
  hexCode: string;
  timestamp: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CVAnalysisResult {
  color: SupportedColorName | null;
  confidence: number;
  hexCode: string;
  rgb: { r: number; g: number; b: number };
  hsv: { h: number; s: number; v: number };
  isHandDetected: boolean;
  isObjectDetected: boolean;
  statusMessage: string;
  objectBox: BoundingBox | null;
  handLandmarks?: { x: number; y: number }[];
}

// ============================================
// FACIAL ACTION UNIT TYPES
// All data structures for AU analysis
// ============================================

/**
 * Raw Action Unit values (0-1 probability)
 */
export interface AUValues {
  AU12: number; // Lip corner pull
  AU26: number; // Jaw drop
  AU1: number;  // Inner brow raise
  AU4: number;  // Brow lowerer
  AU45: number; // Eye closure (blink)
}

/**
 * Temporal analysis metrics
 */
export interface TemporalMetrics {
  expressiveness: number;   // Movement variability (0-1)
  activity: number;         // Overall movement level (0-1)
  stability: number;        // Consistency over time (0-1)
  baselineDeviation: number | null; // Deviation from baseline (0-1)
}

/**
 * Description for each AU
 */
export interface AUDescriptions {
  AU12: string;
  AU26: string;
  AU1: string;
  AU4: string;
  AU45: string;
}

/**
 * A single temporal event
 */
export interface TemporalEvent {
  timestamp: number;        // Unix timestamp (ms)
  type: 'onset' | 'offset' | 'rapid' | 'deviation';
  au: string;
  message: string;
  value?: number;
  duration?: number;
}

/**
 * A single frame of AU data
 */
export interface AUFrame {
  timestamp: number;        // Unix timestamp (ms)
  frameIndex: number;       // Frame number
  aus: AUValues;            // Raw AU values
  descriptions: AUDescriptions;
  metrics: TemporalMetrics;
  faceDetected: boolean;
}

/**
 * Complete interview AU session data
 */
export interface AUSessionData {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  frames: AUFrame[];
  events: TemporalEvent[];
  baseline: AUValues | null;
  summary: AUSessionSummary | null;
}

/**
 * Summary statistics for a session
 */
export interface AUSessionSummary {
  totalFrames: number;
  duration: number; // ms
  faceDetectedFrames: number;
  faceDetectionRate: number; // 0-1
  
  // Per-AU statistics
  auStats: {
    [key: string]: {
      mean: number;
      max: number;
      min: number;
      stdDev: number;
      activationCount: number;
      totalActivationDuration: number;
    };
  };
  
  // Overall metrics
  averageExpressiveness: number;
  averageActivity: number;
  averageStability: number;
  peakExpressiveness: number;
  
  // Baseline comparison
  averageBaselineDeviation: number | null;
  
  // Event counts
  rapidChangeCount: number;
  significantDeviationCount: number;
}

/**
 * Configuration for AU analyzer
 */
export interface AUAnalyzerConfig {
  smoothingEnabled: boolean;
  smoothingWindow: number;
  showLandmarks: boolean;
  loggingEnabled: boolean;
  onsetThreshold: number;
  rapidOnsetMs: number;
}

export const DEFAULT_AU_CONFIG: AUAnalyzerConfig = {
  smoothingEnabled: true,
  smoothingWindow: 5,
  showLandmarks: true,
  loggingEnabled: true,
  onsetThreshold: 0.15,
  rapidOnsetMs: 300,
};

export const AU_THRESHOLDS: Record<keyof AUValues, number> = {
  AU12: 0.35,
  AU26: 0.25,
  AU1: 0.4,
  AU4: 0.45,
  AU45: 0.6,
};

export const AU_LABELS: Record<keyof AUValues, { name: string; description: string }> = {
  AU12: { name: 'Lip Corner Pull', description: 'Possible smile indicator' },
  AU26: { name: 'Jaw Drop', description: 'Mouth opening indicator' },
  AU1: { name: 'Inner Brow Raise', description: 'Eyebrow elevation indicator' },
  AU4: { name: 'Brow Lowerer', description: 'Frown indicator' },
  AU45: { name: 'Eye Closure', description: 'Eyelid closure indicator' },
};

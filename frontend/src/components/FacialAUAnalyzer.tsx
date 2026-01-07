import { useCallback, useEffect, useRef, useState } from 'react';
import type {
    AUValues,
    AUDescriptions,
    TemporalMetrics,
    TemporalEvent,
    AUFrame,
    AUAnalyzerConfig,
} from '@/types/au-types';
import {
    AU_THRESHOLDS,
    AU_LABELS,
    DEFAULT_AU_CONFIG,
} from '@/types/au-types';

// ============================================
// TYPES
// ============================================

interface FacialAUAnalyzerProps {
    /** Video element to analyze (must have srcObject set) */
    videoRef: React.RefObject<HTMLVideoElement | null>;
    /** Whether analysis is active */
    isActive: boolean;
    /** Callback for each analyzed frame */
    onFrame?: (frame: Omit<AUFrame, 'frameIndex'>) => void;
    /** Callback for temporal events */
    onEvent?: (event: TemporalEvent) => void;
    /** Callback when baseline is set */
    onBaseline?: (baseline: AUValues) => void;
    /** Optional configuration */
    config?: Partial<AUAnalyzerConfig>;
    /** Optional className for the container */
    className?: string;
}

// ============================================
// LANDMARK INDICES (MediaPipe Face Mesh)
// ============================================

const LANDMARKS = {
    leftMouthCorner: 61,
    rightMouthCorner: 291,
    upperLipTop: 13,
    lowerLipBottom: 14,
    leftInnerBrow: 107,
    rightInnerBrow: 336,
    noseBridge: 168,
    leftEyeUpper: 159,
    leftEyeLower: 145,
    rightEyeUpper: 386,
    rightEyeLower: 374,
    leftEyeInner: 133,
    leftEyeOuter: 33,
    rightEyeInner: 362,
    rightEyeOuter: 263,
    leftCheek: 234,
    rightCheek: 454,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function standardDeviation(arr: number[]): number {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

// ============================================
// COMPONENT
// ============================================

export function FacialAUAnalyzer({
    videoRef,
    isActive,
    onFrame,
    onEvent,
    onBaseline,
    config: configOverride,
    className = '',
}: FacialAUAnalyzerProps) {
    // Merge config with defaults
    const config: AUAnalyzerConfig = { ...DEFAULT_AU_CONFIG, ...configOverride };

    // State
    const [isReady, setIsReady] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [currentAUs, setCurrentAUs] = useState<AUValues | null>(null);
    const [_currentDescriptions, setCurrentDescriptions] = useState<AUDescriptions | null>(null);
    const [currentMetrics, setCurrentMetrics] = useState<TemporalMetrics | null>(null);
    const [baseline, setBaseline] = useState<AUValues | null>(null);
    const [isRecordingBaseline, setIsRecordingBaseline] = useState(false);
    const [baselineProgress, setBaselineProgress] = useState(0);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const faceMeshRef = useRef<any>(null);
    const animationFrameRef = useRef<number | null>(null);
    const auHistoryRef = useRef<Record<string, number[]>>({
        AU12: [], AU26: [], AU1: [], AU4: [], AU45: [],
    });
    const temporalStateRef = useRef<Record<string, {
        history: number[];
        lastValue: number;
        lastChangeTime: number;
        onsetTime: number | null;
        isActive: boolean;
        peakValue: number;
    }>>({});
    const expressivenessHistoryRef = useRef<number[]>([]);
    const activityHistoryRef = useRef<number[]>([]);
    const baselineFramesRef = useRef<AUValues[]>([]);
    const frameCountRef = useRef(0);

    const AU_KEYS = ['AU12', 'AU26', 'AU1', 'AU4', 'AU45'] as const;
    const TEMPORAL_WINDOW = 30;
    const BASELINE_DURATION = 60;

    // Initialize temporal state
    useEffect(() => {
        AU_KEYS.forEach(key => {
            temporalStateRef.current[key] = {
                history: [],
                lastValue: 0,
                lastChangeTime: 0,
                onsetTime: null,
                isActive: false,
                peakValue: 0,
            };
        });
    }, []);

    // ============================================
    // AU COMPUTATION
    // ============================================

    const smoothValue = useCallback((key: string, value: number): number => {
        if (!config.smoothingEnabled) return value;
        const history = auHistoryRef.current[key];
        history.push(value);
        if (history.length > config.smoothingWindow) history.shift();
        return history.reduce((a, b) => a + b, 0) / history.length;
    }, [config.smoothingEnabled, config.smoothingWindow]);

    const computeActionUnits = useCallback((landmarks: any[]): AUValues => {
        const faceWidth = distance(landmarks[LANDMARKS.leftCheek], landmarks[LANDMARKS.rightCheek]);

        // AU12: Lip Corner Pull
        const mouthWidth = distance(landmarks[LANDMARKS.leftMouthCorner], landmarks[LANDMARKS.rightMouthCorner]);
        const mouthWidthRatio = mouthWidth / faceWidth;
        const AU12 = smoothValue('AU12', clamp01((mouthWidthRatio - 0.35) / 0.13));

        // AU26: Jaw Drop
        const mouthOpen = distance(landmarks[LANDMARKS.upperLipTop], landmarks[LANDMARKS.lowerLipBottom]);
        const mouthOpenRatio = mouthOpen / faceWidth;
        const AU26 = smoothValue('AU26', clamp01((mouthOpenRatio - 0.02) / 0.13));

        // AU1: Inner Brow Raise
        const leftBrowHeight = distance(landmarks[LANDMARKS.leftInnerBrow], landmarks[LANDMARKS.noseBridge]);
        const rightBrowHeight = distance(landmarks[LANDMARKS.rightInnerBrow], landmarks[LANDMARKS.noseBridge]);
        const avgBrowHeight = (leftBrowHeight + rightBrowHeight) / 2;
        const browHeightRatio = avgBrowHeight / faceWidth;
        const AU1 = smoothValue('AU1', clamp01((browHeightRatio - 0.11) / 0.06));

        // AU4: Brow Lowerer
        const browDistance = distance(landmarks[LANDMARKS.leftInnerBrow], landmarks[LANDMARKS.rightInnerBrow]);
        const browDistanceRatio = browDistance / faceWidth;
        const AU4 = smoothValue('AU4', clamp01(1 - ((browDistanceRatio - 0.06) / 0.07)));

        // AU45: Blink
        const leftEyeHeight = distance(landmarks[LANDMARKS.leftEyeUpper], landmarks[LANDMARKS.leftEyeLower]);
        const leftEyeWidth = distance(landmarks[LANDMARKS.leftEyeInner], landmarks[LANDMARKS.leftEyeOuter]);
        const leftEAR = leftEyeHeight / leftEyeWidth;
        const rightEyeHeight = distance(landmarks[LANDMARKS.rightEyeUpper], landmarks[LANDMARKS.rightEyeLower]);
        const rightEyeWidth = distance(landmarks[LANDMARKS.rightEyeInner], landmarks[LANDMARKS.rightEyeOuter]);
        const rightEAR = rightEyeHeight / rightEyeWidth;
        const avgEAR = (leftEAR + rightEAR) / 2;
        const AU45 = smoothValue('AU45', clamp01(1 - ((avgEAR - 0.1) / 0.25)));

        return { AU12, AU26, AU1, AU4, AU45 };
    }, [smoothValue]);

    // ============================================
    // TEMPORAL ANALYSIS
    // ============================================

    const analyzeTemporalPatterns = useCallback((aus: AUValues): { descriptions: AUDescriptions; events: TemporalEvent[] } => {
        const now = performance.now();
        const descriptions: AUDescriptions = {} as AUDescriptions;
        const events: TemporalEvent[] = [];

        AU_KEYS.forEach(key => {
            const state = temporalStateRef.current[key];
            const value = aus[key];
            const threshold = AU_THRESHOLDS[key];
            const isNowActive = value > threshold;
            const wasActive = state.isActive;

            state.history.push(value);
            if (state.history.length > TEMPORAL_WINDOW) state.history.shift();

            // Detect onset
            if (isNowActive && !wasActive) {
                state.onsetTime = now;
                state.peakValue = value;
                events.push({
                    timestamp: Date.now(),
                    type: 'onset',
                    au: key,
                    message: `${AU_LABELS[key].name} activated`,
                    value,
                });
            }

            // Track peak
            if (isNowActive && value > state.peakValue) {
                state.peakValue = value;
            }

            // Detect offset
            if (!isNowActive && wasActive && state.onsetTime) {
                const duration = now - state.onsetTime;
                events.push({
                    timestamp: Date.now(),
                    type: 'offset',
                    au: key,
                    message: `${AU_LABELS[key].name} deactivated`,
                    duration,
                    value: state.peakValue,
                });
                state.onsetTime = null;
            }

            // Detect rapid changes
            const delta = Math.abs(value - state.lastValue);
            if (delta > config.onsetThreshold) {
                const timeSinceLastChange = now - state.lastChangeTime;
                if (timeSinceLastChange < config.rapidOnsetMs && state.lastChangeTime > 0) {
                    events.push({
                        timestamp: Date.now(),
                        type: 'rapid',
                        au: key,
                        message: `Rapid ${AU_LABELS[key].name} change over ${Math.round(timeSinceLastChange)}ms`,
                        value: delta,
                    });
                }
                state.lastChangeTime = now;
            }

            // Generate description
            const intensity = value > 0.7 ? 'strongly' : value > 0.4 ? 'moderately' : 'slightly';
            if (key === 'AU12') {
                descriptions[key] = isNowActive ? `Lip corners pulled upward (${intensity})` : 'Neutral position';
            } else if (key === 'AU26') {
                descriptions[key] = isNowActive ? `Jaw drop / mouth opening (${intensity})` : 'Mouth closed';
            } else if (key === 'AU1') {
                descriptions[key] = isNowActive ? `Inner brows raised (${intensity})` : 'Neutral position';
            } else if (key === 'AU4') {
                descriptions[key] = isNowActive ? `Brows drawn together (${intensity})` : 'Neutral position';
            } else if (key === 'AU45') {
                descriptions[key] = value > 0.8 ? 'Eyelids closed (blink)' : isNowActive ? 'Eyes partially closed' : 'Eyes open';
            }

            state.lastValue = value;
            state.isActive = isNowActive;
        });

        return { descriptions, events };
    }, [config.onsetThreshold, config.rapidOnsetMs]);

    // ============================================
    // METRICS COMPUTATION
    // ============================================

    const computeMetrics = useCallback((aus: AUValues): TemporalMetrics => {
        // Expressiveness
        const allVariability = AU_KEYS.map(key => {
            const state = temporalStateRef.current[key];
            return standardDeviation(state.history);
        });
        const expressiveness = allVariability.reduce((a, b) => a + b, 0) / AU_KEYS.length;
        expressivenessHistoryRef.current.push(expressiveness);
        if (expressivenessHistoryRef.current.length > 30) expressivenessHistoryRef.current.shift();

        // Activity
        const activity = AU_KEYS.reduce((sum, key) => sum + aus[key], 0) / AU_KEYS.length;
        activityHistoryRef.current.push(activity);
        if (activityHistoryRef.current.length > 30) activityHistoryRef.current.shift();

        // Stability
        const stabilityRaw = 1 - standardDeviation(expressivenessHistoryRef.current.slice(-15));
        const stability = clamp01(stabilityRaw * 2);

        // Baseline deviation
        let baselineDeviation: number | null = null;
        if (baseline) {
            const deviations = AU_KEYS.map(key => Math.abs(aus[key] - baseline[key]));
            baselineDeviation = deviations.reduce((a, b) => a + b, 0) / AU_KEYS.length;

            // Log significant deviation
            if (baselineDeviation > 0.25 && frameCountRef.current % 30 === 0 && onEvent) {
                onEvent({
                    timestamp: Date.now(),
                    type: 'deviation',
                    au: 'all',
                    message: `Facial movement deviates from baseline (Δ ${(baselineDeviation * 100).toFixed(0)}%)`,
                    value: baselineDeviation,
                });
            }
        }

        return {
            expressiveness: clamp01(expressiveness * 5),
            activity: clamp01(activity),
            stability,
            baselineDeviation,
        };
    }, [baseline, onEvent]);

    // ============================================
    // BASELINE RECORDING
    // ============================================

    const startBaselineRecording = useCallback(() => {
        setIsRecordingBaseline(true);
        baselineFramesRef.current = [];
        setBaselineProgress(0);
    }, []);

    const recordBaselineFrame = useCallback((aus: AUValues) => {
        baselineFramesRef.current.push(aus);
        const progress = (baselineFramesRef.current.length / BASELINE_DURATION) * 100;
        setBaselineProgress(progress);

        if (baselineFramesRef.current.length >= BASELINE_DURATION) {
            // Compute average baseline
            const frames = baselineFramesRef.current;
            const newBaseline: AUValues = {
                AU12: frames.reduce((sum, f) => sum + f.AU12, 0) / frames.length,
                AU26: frames.reduce((sum, f) => sum + f.AU26, 0) / frames.length,
                AU1: frames.reduce((sum, f) => sum + f.AU1, 0) / frames.length,
                AU4: frames.reduce((sum, f) => sum + f.AU4, 0) / frames.length,
                AU45: frames.reduce((sum, f) => sum + f.AU45, 0) / frames.length,
            };

            setBaseline(newBaseline);
            setIsRecordingBaseline(false);
            setBaselineProgress(100);

            if (onBaseline) {
                onBaseline(newBaseline);
            }
        }
    }, [onBaseline]);

    const resetBaseline = useCallback(() => {
        setBaseline(null);
        setIsRecordingBaseline(false);
        setBaselineProgress(0);
        baselineFramesRef.current = [];
    }, []);

    // ============================================
    // MEDIAPIPE SETUP
    // ============================================

    useEffect(() => {
        if (!isActive) return;

        // Dynamic import of MediaPipe (loaded from CDN in index.html)
        const initFaceMesh = async () => {
            // Wait for MediaPipe to be available (loaded via CDN)
            const checkMediaPipe = () => {
                return new Promise<void>((resolve) => {
                    const check = () => {
                        if ((window as any).FaceMesh) {
                            resolve();
                        } else {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
            };

            await checkMediaPipe();

            const FaceMesh = (window as any).FaceMesh;
            const faceMesh = new FaceMesh({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
            });

            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            faceMesh.onResults((results: any) => {
                if (!canvasRef.current || !videoRef.current) return;

                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = videoRef.current.videoWidth || 640;
                canvas.height = videoRef.current.videoHeight || 480;

                frameCountRef.current++;

                if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                    const landmarks = results.multiFaceLandmarks[0];
                    setFaceDetected(true);

                    // Compute AUs
                    const aus = computeActionUnits(landmarks);
                    setCurrentAUs(aus);

                    // Temporal analysis
                    const { descriptions, events } = analyzeTemporalPatterns(aus);
                    setCurrentDescriptions(descriptions);

                    // Metrics
                    const metrics = computeMetrics(aus);
                    setCurrentMetrics(metrics);

                    // Baseline recording
                    if (isRecordingBaseline) {
                        recordBaselineFrame(aus);
                    }

                    // Emit events
                    events.forEach(event => {
                        if (onEvent) onEvent(event);
                    });

                    // Emit frame
                    if (onFrame) {
                        onFrame({
                            timestamp: Date.now(),
                            aus,
                            descriptions,
                            metrics,
                            faceDetected: true,
                        });
                    }

                    // Draw landmarks
                    if (config.showLandmarks) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
                        landmarks.forEach((landmark: any) => {
                            const x = landmark.x * canvas.width;
                            const y = landmark.y * canvas.height;
                            ctx.beginPath();
                            ctx.arc(x, y, 1.5, 0, 2 * Math.PI);
                            ctx.fill();
                        });

                        // Highlight key points
                        const keyPoints = [
                            LANDMARKS.leftMouthCorner, LANDMARKS.rightMouthCorner,
                            LANDMARKS.upperLipTop, LANDMARKS.lowerLipBottom,
                            LANDMARKS.leftInnerBrow, LANDMARKS.rightInnerBrow,
                        ];
                        ctx.fillStyle = 'rgba(124, 58, 237, 0.9)';
                        keyPoints.forEach(index => {
                            const lm = landmarks[index];
                            ctx.beginPath();
                            ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 3, 0, 2 * Math.PI);
                            ctx.fill();
                        });
                    } else {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                } else {
                    setFaceDetected(false);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    if (onFrame) {
                        onFrame({
                            timestamp: Date.now(),
                            aus: { AU12: 0, AU26: 0, AU1: 0, AU4: 0, AU45: 0 },
                            descriptions: {
                                AU12: 'No face',
                                AU26: 'No face',
                                AU1: 'No face',
                                AU4: 'No face',
                                AU45: 'No face',
                            },
                            metrics: { expressiveness: 0, activity: 0, stability: 0, baselineDeviation: null },
                            faceDetected: false,
                        });
                    }
                }
            });

            faceMeshRef.current = faceMesh;
            setIsReady(true);
        };

        initFaceMesh();

        return () => {
            if (faceMeshRef.current) {
                faceMeshRef.current.close?.();
            }
        };
    }, [isActive]);

    // Process video frames
    useEffect(() => {
        if (!isReady || !isActive || !videoRef.current || !faceMeshRef.current) return;

        const processFrame = async () => {
            if (videoRef.current && faceMeshRef.current && isActive) {
                try {
                    await faceMeshRef.current.send({ image: videoRef.current });
                } catch (e) {
                    // Ignore send errors
                }
            }
            if (isActive) {
                animationFrameRef.current = requestAnimationFrame(processFrame);
            }
        };

        animationFrameRef.current = requestAnimationFrame(processFrame);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isReady, isActive, videoRef]);

    // ============================================
    // RENDER
    // ============================================

    return (
        <div className={`facial-au-analyzer ${className}`}>
            {/* Canvas overlay for landmarks */}
            <canvas
                ref={canvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
                style={{ transform: 'scaleX(-1)' }}
            />

            {/* AU Display Panel - Top horizontal bar for zero face obstruction */}
            <div className="absolute top-0 left-0 right-0 bg-black/90 px-4 py-2 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-20 shadow-xl overflow-hidden">
                {/* Left: Status & Baseline */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${faceDetected ? 'bg-emerald-400' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                        <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold whitespace-nowrap">
                            {faceDetected ? 'Face Active' : 'Offline'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={baseline ? resetBaseline : startBaselineRecording}
                        disabled={isRecordingBaseline}
                        className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-tight text-white/70 hover:bg-white/10 transition-all hover:border-white/40 active:scale-95"
                    >
                        {isRecordingBaseline
                            ? `Rec ${baselineProgress.toFixed(0)}%`
                            : baseline ? 'Reset' : 'Set Baseline'}
                    </button>
                </div>

                {/* Center: AU Bars (Miniature) */}
                {currentAUs && (
                    <div className="flex-1 flex justify-center gap-4 px-4 max-w-lg">
                        {AU_KEYS.map(key => {
                            const value = currentAUs[key];
                            const isActive = value > AU_THRESHOLDS[key];
                            return (
                                <div key={key} className="flex-1 flex flex-col gap-1 max-w-[60px]">
                                    <div className="flex justify-between items-center h-2">
                                        <span className={`text-[8px] font-black leading-none ${isActive ? 'text-cyan-400' : 'text-white/20'}`}>
                                            {key}
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-100 ${value > 0.8 ? 'bg-purple-500' : 'bg-cyan-500 shadow-[0_0_4px_rgba(34,211,238,0.5)]'}`}
                                            style={{ width: `${value * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Right: Summary Metrics */}
                {currentMetrics && (
                    <div className="flex items-center gap-3 shrink-0 border-l border-white/10 pl-4 h-6">
                        <div className="flex flex-col items-center">
                            <span className="text-[7px] text-white/25 uppercase font-bold">Expr</span>
                            <span className="text-[10px] text-cyan-400 font-mono leading-none">
                                {(currentMetrics.expressiveness * 100).toFixed(0)}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[7px] text-white/25 uppercase font-bold">Actv</span>
                            <span className="text-[10px] text-cyan-400 font-mono leading-none">
                                {(currentMetrics.activity * 100).toFixed(0)}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[7px] text-white/25 uppercase font-bold">Stab</span>
                            <span className="text-[10px] text-cyan-400 font-mono leading-none">
                                {(currentMetrics.stability * 100).toFixed(0)}
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[7px] text-white/25 uppercase font-bold">ΔBase</span>
                            <span className="text-[10px] text-emerald-400 font-mono leading-none text-right min-w-[14px]">
                                {currentMetrics.baselineDeviation !== null
                                    ? (currentMetrics.baselineDeviation * 100).toFixed(0)
                                    : '--'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FacialAUAnalyzer;

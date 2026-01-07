import { useCallback, useRef, useState } from 'react';
import type {
    AUFrame,
    AUSessionData,
    AUSessionSummary,
    AUValues,
    TemporalEvent,
} from '@/types/au-types';
import { AU_THRESHOLDS } from '@/types/au-types';

/**
 * Hook to manage AU session data storage
 * Stores all frames and events during an interview session
 */
export function useAUSession() {
    const [sessionData, setSessionData] = useState<AUSessionData | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const frameIndexRef = useRef(0);

    /**
     * Start a new recording session
     */
    const startSession = useCallback(() => {
        const session: AUSessionData = {
            sessionId: `au-session-${Date.now()}`,
            startTime: Date.now(),
            endTime: null,
            frames: [],
            events: [],
            baseline: null,
            summary: null,
        };
        setSessionData(session);
        setIsRecording(true);
        frameIndexRef.current = 0;
        console.log('[AU Session] Started:', session.sessionId);
    }, []);

    /**
     * Add a frame of AU data
     */
    const addFrame = useCallback((frame: Omit<AUFrame, 'frameIndex'>) => {
        if (!isRecording) return;

        setSessionData((prev) => {
            if (!prev) return prev;

            const newFrame: AUFrame = {
                ...frame,
                frameIndex: frameIndexRef.current++,
            };

            return {
                ...prev,
                frames: [...prev.frames, newFrame],
            };
        });
    }, [isRecording]);

    /**
     * Add a temporal event
     */
    const addEvent = useCallback((event: TemporalEvent) => {
        if (!isRecording) return;

        setSessionData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                events: [...prev.events, event],
            };
        });
    }, [isRecording]);

    /**
     * Set the baseline values
     */
    const setBaseline = useCallback((baseline: AUValues) => {
        setSessionData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                baseline,
            };
        });
    }, []);

    /**
     * Calculate summary statistics
     */
    const calculateSummary = useCallback((data: AUSessionData): AUSessionSummary => {
        const frames = data.frames;
        const totalFrames = frames.length;
        const faceDetectedFrames = frames.filter(f => f.faceDetected).length;

        if (totalFrames === 0) {
            return {
                totalFrames: 0,
                duration: 0,
                faceDetectedFrames: 0,
                faceDetectionRate: 0,
                auStats: {},
                averageExpressiveness: 0,
                averageActivity: 0,
                averageStability: 0,
                peakExpressiveness: 0,
                averageBaselineDeviation: null,
                rapidChangeCount: 0,
                significantDeviationCount: 0,
            };
        }

        const duration = (data.endTime ?? Date.now()) - data.startTime;

        // Calculate per-AU statistics
        const auKeys = ['AU12', 'AU26', 'AU1', 'AU4', 'AU45'] as const;
        const auStats: AUSessionSummary['auStats'] = {};

        auKeys.forEach((key) => {
            const values = frames.map(f => f.aus[key]);
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = sum / values.length;
            const max = Math.max(...values);
            const min = Math.min(...values);
            const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            // Count activations
            const threshold = AU_THRESHOLDS[key];
            let activationCount = 0;
            let totalActivationDuration = 0;
            let inActivation = false;
            let activationStart = 0;

            frames.forEach((frame) => {
                const isActive = frame.aus[key] > threshold;
                if (isActive && !inActivation) {
                    inActivation = true;
                    activationStart = frame.timestamp;
                    activationCount++;
                } else if (!isActive && inActivation) {
                    inActivation = false;
                    totalActivationDuration += frame.timestamp - activationStart;
                }
            });

            // Close any ongoing activation
            if (inActivation && frames.length > 0) {
                totalActivationDuration += frames[frames.length - 1].timestamp - activationStart;
            }

            auStats[key] = { mean, max, min, stdDev, activationCount, totalActivationDuration };
        });

        // Calculate overall metrics
        const expressiveness = frames.map(f => f.metrics.expressiveness);
        const activity = frames.map(f => f.metrics.activity);
        const stability = frames.map(f => f.metrics.stability);

        const averageExpressiveness = expressiveness.reduce((a, b) => a + b, 0) / expressiveness.length;
        const averageActivity = activity.reduce((a, b) => a + b, 0) / activity.length;
        const averageStability = stability.reduce((a, b) => a + b, 0) / stability.length;
        const peakExpressiveness = Math.max(...expressiveness);

        // Baseline deviation
        const deviations = frames
            .map(f => f.metrics.baselineDeviation)
            .filter((d): d is number => d !== null);
        const averageBaselineDeviation = deviations.length > 0
            ? deviations.reduce((a, b) => a + b, 0) / deviations.length
            : null;

        // Event counts
        const rapidChangeCount = data.events.filter(e => e.type === 'rapid').length;
        const significantDeviationCount = data.events.filter(e => e.type === 'deviation').length;

        return {
            totalFrames,
            duration,
            faceDetectedFrames,
            faceDetectionRate: faceDetectedFrames / totalFrames,
            auStats,
            averageExpressiveness,
            averageActivity,
            averageStability,
            peakExpressiveness,
            averageBaselineDeviation,
            rapidChangeCount,
            significantDeviationCount,
        };
    }, []);

    /**
     * Stop the session and generate summary
     */
    const stopSession = useCallback(() => {
        setIsRecording(false);

        setSessionData((prev) => {
            if (!prev) return prev;

            const endTime = Date.now();
            const summary = calculateSummary({ ...prev, endTime });

            console.log('[AU Session] Stopped:', prev.sessionId);
            console.log('[AU Session] Summary:', summary);

            return {
                ...prev,
                endTime,
                summary,
            };
        });
    }, [calculateSummary]);

    /**
     * Clear the session data
     */
    const clearSession = useCallback(() => {
        setSessionData(null);
        setIsRecording(false);
        frameIndexRef.current = 0;
    }, []);

    /**
     * Get session data as JSON (for storage/transmission)
     */
    const exportSession = useCallback(() => {
        if (!sessionData) return null;
        return JSON.stringify(sessionData, null, 2);
    }, [sessionData]);

    return {
        sessionData,
        isRecording,
        startSession,
        stopSession,
        addFrame,
        addEvent,
        setBaseline,
        clearSession,
        exportSession,
    };
}

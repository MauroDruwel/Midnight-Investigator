import { useState, useRef, useCallback } from "react";
import type { useAUSession } from "@/hooks/use-au-session";

export function useDashboardRecording(auSession: ReturnType<typeof useAUSession>) {
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "stopping">("idle");
    const [volumeLevel, setVolumeLevel] = useState(0);
    const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
    const [auAnalysisActive, setAuAnalysisActive] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const volumeRafRef = useRef<number | null>(null);

    const stopVolumeMeter = useCallback(() => {
        if (volumeRafRef.current) {
            cancelAnimationFrame(volumeRafRef.current);
            volumeRafRef.current = null;
        }
        setVolumeLevel(0);
        analyserRef.current = null;
        audioCtxRef.current?.close().catch(() => undefined);
        audioCtxRef.current = null;
    }, []);

    const cleanupCapture = useCallback(() => {
        mediaStream?.getTracks().forEach((track) => track.stop());
        if (mediaRecorder?.state === "recording") {
            mediaRecorder.stop();
        }
        setMediaStream(null);
        setMediaRecorder(null);
        setRecordingStatus("idle");
        stopVolumeMeter();
        setAuAnalysisActive(false);
        auSession.clearSession();
    }, [mediaStream, mediaRecorder, stopVolumeMeter, auSession]);

    const startCapture = useCallback(async () => {
        if (recordingStatus === "recording") return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            setMediaStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(() => undefined);
            }

            const media = new MediaRecorder(stream);
            const chunks: BlobPart[] = [];

            media.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            media.onstop = () => {
                const blob = new Blob(chunks, { type: "audio/webm" });
                const url = URL.createObjectURL(blob);
                setRecordingBlob(blob);
                setRecordingUrl(url);
                setRecordingStatus("idle");
                stopVolumeMeter();
                stream.getTracks().forEach((track) => track.stop());
            };

            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;
            audioCtxRef.current = audioCtx;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateVolume = () => {
                analyser.getByteTimeDomainData(dataArray);
                const rms = Math.sqrt(
                    dataArray.reduce((sum, value) => sum + (value - 128) * (value - 128), 0) / dataArray.length
                );
                const normalized = Math.min(1, rms / 50);
                setVolumeLevel(normalized);
                volumeRafRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();

            media.start(1000);
            setMediaRecorder(media);
            setRecordingStatus("recording");

            auSession.startSession();
            setAuAnalysisActive(true);
        } catch (error) {
            console.error("Failed to start capture", error);
            setRecordingStatus("idle");
            stopVolumeMeter();
        }
    }, [recordingStatus, stopVolumeMeter, auSession]);

    const stopCapture = useCallback(() => {
        if (recordingStatus === "idle") return;
        setRecordingStatus("stopping");
        mediaRecorder?.stop();
        mediaStream?.getTracks().forEach((track) => track.stop());
        stopVolumeMeter();

        setAuAnalysisActive(false);
        auSession.stopSession();
    }, [recordingStatus, mediaRecorder, mediaStream, stopVolumeMeter, auSession]);

    return {
        mediaStream,
        recordingUrl,
        recordingStatus,
        volumeLevel,
        recordingBlob,
        auAnalysisActive,
        videoRef,
        startCapture,
        stopCapture,
        cleanupCapture,
        setRecordingUrl,
        setRecordingBlob,
    };
}

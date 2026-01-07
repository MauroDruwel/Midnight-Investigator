import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ModalShell } from "./ModalShell";
import type { Interview } from "@/types/interview";
import { API_BASE_URL } from "@/utils/interviewUtils";

interface AddInterviewModalProps {
  open: boolean;
  onClose: () => void;
  onInterviewAdded: (interview: Interview) => void;
}

export function AddInterviewModal({ open, onClose, onInterviewAdded }: AddInterviewModalProps) {
  const [draftInterview, setDraftInterview] = useState({
    name: "",
    guilt_level: "",
    transcript: "",
    mp3_path: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [addStatus, setAddStatus] = useState<"idle" | "submitting">("idle");
  const [addError, setAddError] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "stopping">("idle");
  const [volumeLevel, setVolumeLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const volumeRafRef = useRef<number | null>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) {
      setDraftInterview((prev) => ({ ...prev, transcript: prev.transcript || "" }));
    }
  };

  const handleAddSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddError(null);
    const trimmedName = draftInterview.name.trim();
    if (!trimmedName) {
      setAddError("Name is required.");
      return;
    }

    const sourceFile: File | null = selectedFile
      ? selectedFile
      : recordingBlob
        ? new File([recordingBlob], `${trimmedName || "recording"}.webm`, {
            type: recordingBlob.type || "audio/webm",
          })
        : null;

    if (!sourceFile) {
      setAddError("Record audio or upload a file first.");
      return;
    }

    setAddStatus("submitting");
    setDraftInterview((prev) => ({ ...prev, transcript: "Processing transcript…" }));

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("file", sourceFile);

    try {
      const response = await fetch(`${API_BASE_URL}/interview`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Failed to add interview.");
      }

      const updatedInterview: Interview = {
        name: trimmedName,
        guilt_level: typeof data.guilt_level === "number" ? data.guilt_level : -1,
        transcript: data.transcript || "",
        mp3_path: data.mp3_path,
      };

      onInterviewAdded(updatedInterview);
      setDraftInterview({ name: "", guilt_level: "", transcript: "", mp3_path: "" });
      setRecordingUrl(null);
      setRecordingBlob(null);
      setSelectedFile(null);
      cleanupCapture();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setAddError(message);
    } finally {
      setAddStatus("idle");
    }
  };

  const stopVolumeMeter = () => {
    if (volumeRafRef.current) {
      cancelAnimationFrame(volumeRafRef.current);
      volumeRafRef.current = null;
    }
    setVolumeLevel(0);
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  };

  const cleanupCapture = () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaRecorder?.state === "recording" && mediaRecorder.stop();
    setMediaStream(null);
    setMediaRecorder(null);
    setRecordingStatus("idle");
    stopVolumeMeter();
  };

  useEffect(() => {
    if (!open) {
      cleanupCapture();
      setRecordingUrl(null);
      setRecordingBlob(null);
    }
  }, [open]);

  const startCapture = async () => {
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

      // Volume meter setup
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
    } catch (error) {
      console.error("Failed to start capture", error);
      setRecordingStatus("idle");
      stopVolumeMeter();
    }
  };

  const stopCapture = () => {
    if (recordingStatus === "idle") return;
    setRecordingStatus("stopping");
    mediaRecorder?.stop();
    mediaStream?.getTracks().forEach((track) => track.stop());
    stopVolumeMeter();
  };

  return (
    <ModalShell open={open} onClose={onClose} title="Add interview">
      <form className="space-y-4" onSubmit={handleAddSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-white" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className="w-full rounded-md border border-white/10 bg-[#0c0d10] p-2 text-sm text-white outline-none focus:border-emerald-400"
            placeholder="Suspect name"
            value={draftInterview.name}
            onChange={(event) => setDraftInterview((prev) => ({ ...prev, name: event.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:items-stretch">
          <div className="flex h-full flex-col space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="recorder">
              Recording (audio + video)
            </label>
            <div className="flex min-h-[320px] flex-1 flex-col space-y-3 rounded-lg border border-white/10 bg-[#0c0d10] p-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startCapture}
                  disabled={recordingStatus === "recording"}
                  className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-black shadow hover:bg-emerald-400 disabled:opacity-60"
                >
                  {recordingStatus === "recording" ? "Recording…" : "Start"}
                </button>
                <button
                  type="button"
                  onClick={stopCapture}
                  disabled={recordingStatus !== "recording"}
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-white/40 disabled:opacity-60"
                >
                  Stop
                </button>
                <div className="flex h-2 flex-1 items-center gap-1" aria-label="Volume level">
                  {Array.from({ length: 12 }).map((_, index) => {
                    const threshold = (index + 1) / 12;
                    const active = volumeLevel >= threshold;
                    return (
                      <span
                        key={index}
                        className={`h-2 flex-1 rounded ${active ? "bg-emerald-400" : "bg-white/10"}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex-1 min-h-[220px] w-full overflow-hidden rounded-md border border-white/10 bg-black/40">
                <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              </div>
              {recordingUrl && (
                <div className="rounded-md border border-white/10 p-2 text-xs text-white/80">
                  Recorded clip ready. It will be sent with this entry.
                </div>
              )}
            </div>
          </div>
          <div className="flex h-full flex-col space-y-2">
            <label className="text-sm font-medium text-white" htmlFor="transcript">
              Transcript
            </label>
            <textarea
              id="transcript"
              readOnly
              className="flex-1 min-h-[320px] w-full resize-none overflow-auto rounded-md border border-white/10 bg-[#0c0d10] p-2 text-sm text-white outline-none"
              placeholder="Transcript will appear after processing"
              value={draftInterview.transcript}
            />
            <input
              id="upload"
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="text-xs text-neutral-300 file:mr-2 file:rounded-md file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1 file:text-white"
            />
            {addError && <p className="text-xs text-red-400">{addError}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-white hover:border-white/30"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={addStatus === "submitting"}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black shadow hover:bg-emerald-400 disabled:opacity-60"
          >
            {addStatus === "submitting" ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
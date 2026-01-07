import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FloatingDock } from "@/components/ui/floating-dock";
import { CometCard } from "@/components/ui/comet-card";
import {
  IconBrandGithub,
  IconFileText,
  IconHome,
  IconMicrophone,
  IconRefresh,
} from "@tabler/icons-react";
import { CloseIcon } from "@/components/expandable-card-demo-standard";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

type Interview = {
  name: string;
  transcript?: string;
  guilt_level?: number;
  mp3_path?: string;
};

type SummaryRankingEntry = {
  name: string;
  rank?: number;
  reason: string;
};

type SummaryPayload = {
  ranking: SummaryRankingEntry[];
  summary: string;
};

const API_BASE_URL = "http://localhost:8000";
const DEFAULT_SUSPECT_IMAGE = "/suspects/default.jpg";
const FALLBACK_DATA_URL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='512' height='320' viewBox='0 0 512 320' fill='none'><rect width='512' height='320' rx='20' fill='%23121a1c'/><circle cx='120' cy='140' r='60' fill='%232c3a3e'/><rect x='210' y='90' width='200' height='30' rx='8' fill='%233b4c52'/><rect x='210' y='140' width='180' height='24' rx='8' fill='%23485960'/><rect x='210' y='184' width='120' height='20' rx='8' fill='%236f868f'/><text x='120' y='255' fill='%2396a7ad' font-family='sans-serif' font-size='22' text-anchor='middle'>Suspect</text><text x='120' y='285' fill='%235f7279' font-family='sans-serif' font-size='14' text-anchor='middle'>Awaiting photo</text></svg>";
const OFFLINE_INTERVIEWS: Interview[] = [
  {
    name: "Jane",
    guilt_level: 42,
    transcript: "Renran insists they were cataloging evidence when the lights flickered."
  },
  {
    name: "Avery Moss",
    guilt_level: -1,
    transcript: "Claims to have been reviewing ledger entries; no alibi witness yet."
  },
  {
    name: "Casey Dawn",
    guilt_level: 73,
    transcript:
      "States they heard footsteps near the stairwell but couldn't identify the voice."
  },
];

export default function DashboardPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);
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
  const [storyTitle, setStoryTitle] = useState("Case storyline");
  const [storySavedAt, setStorySavedAt] = useState<string | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyData, setStoryData] = useState<SummaryPayload | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingName, setAnalyzingName] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const fetchInterviews = useCallback(
    async (signal?: AbortSignal) => {
      setOffline(false);
      setAnalysisError(null);
      if (loading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await fetch(`${API_BASE_URL}/interviews`, { signal });
        const data = await response.json();
        if (Array.isArray(data)) {
          setInterviews(data as Interview[]);
        } else {
          setInterviews([]);
        }
      } catch (error) {
        console.error("Failed to load interviews", error);
        setOffline(true);
        setInterviews(OFFLINE_INTERVIEWS);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loading]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchInterviews(controller.signal);
    return () => controller.abort();
  }, [fetchInterviews]);

  const fetchStorySummary = useCallback(async () => {
    setStoryLoading(true);
    setStoryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/summary`);
      const data = await response.json();
      if (data?.error) {
        throw new Error(data.error);
      }
      const payload: SummaryPayload = data.summary || data;
      const sorted = Array.isArray(payload?.ranking)
        ? [...payload.ranking].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        : [];
      const normalized: SummaryPayload = {
        ranking: sorted,
        summary: payload?.summary || "",
      };
      setStoryData(normalized);
      setStoryTitle("AI storyline");
      setStorySavedAt(new Date().toLocaleTimeString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load storyline.";
      setStoryError(message);
    } finally {
      setStoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showStoryModal) {
      fetchStorySummary();
    }
  }, [showStoryModal, fetchStorySummary]);

  const analyzedCount = useMemo(
    () => interviews.filter((iv) => typeof iv.guilt_level === "number" && iv.guilt_level >= 0).length,
    [interviews]
  );

  const dockItems = [
    {
      title: "Dashboard",
      icon: <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "#",
    },
    {
      title: "Add interview",
      icon: <IconMicrophone className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      onClick: () => setShowAddModal(true),
    },
    {
      title: "Storyline",
      icon: <IconFileText className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      onClick: () => setShowStoryModal(true),
    },
    {
      title: "GitHub",
      icon: <IconBrandGithub className="h-full w-full text-neutral-500 dark:text-neutral-300" />,
      href: "https://github.com/MauroDruwel/Midnight-Investigator",
    },
  ];

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

      setInterviews((prev) => {
        const filtered = prev.filter((iv) => iv.name !== trimmedName);
        return [updatedInterview, ...filtered];
      });

      setDraftInterview({ name: "", guilt_level: "", transcript: "", mp3_path: "" });
      setRecordingUrl(null);
      setRecordingBlob(null);
      setSelectedFile(null);
      cleanupCapture();
      setShowAddModal(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setAddError(message);
    } finally {
      setAddStatus("idle");
    }
  };

  const handleAnalyze = async (name: string) => {
    setAnalysisError(null);
    setAnalyzingName(name);
    try {
      const formData = new FormData();
      formData.append("name", name);
      const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Analysis failed.");
      }
      setInterviews((prev) =>
        prev.map((iv) => (iv.name === name ? { ...iv, guilt_level: data.guilt_level } : iv))
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Guilt analysis failed.";
      setAnalysisError(message);
    } finally {
      setAnalyzingName(null);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleteError(null);
    setDeletingName(name);
    try {
      const response = await fetch(`${API_BASE_URL}/interview/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Delete failed.");
      }
      setInterviews((prev) => prev.filter((iv) => iv.name !== name));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed.";
      setDeleteError(message);
    } finally {
      setDeletingName(null);
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
    if (!showAddModal) {
      cleanupCapture();
      setRecordingUrl(null);
      setRecordingBlob(null);
    }
  }, [showAddModal]);

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
    <div className="relative h-screen w-full">
      <div className="p-4">
        <TextGenerateEffect words="Dashboard" />
        {offline && (
          <div className="mt-2 text-sm text-red-400">
            Backend is offline — showing hardcoded suspects.
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <button
            type="button"
            onClick={() => fetchInterviews()}
            className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 font-semibold text-white hover:border-white/30"
            disabled={refreshing || loading}
          >
            <IconRefresh className="h-4 w-4" /> {refreshing || loading ? "Refreshing" : "Refresh interviews"}
          </button>
          {analysisError && <span className="text-red-400">{analysisError}</span>}
        </div>
        <div className="flex space-x-4">
          <CometCardDemo title="Interviews" count={interviews.length} />
          <CometCardDemo title="Analyzed" count={analyzedCount} />
          <CometCardDemo title="Pending" count={Math.max(interviews.length - analyzedCount, 0)} />
        </div>

        <div className="mt-8 space-y-6">
          <TextGenerateEffect words="Interviews" />
          <div className="flex flex-wrap gap-4">
            {loading && <div className="text-sm text-neutral-400">Loading interviews…</div>}
            {!loading && interviews.length === 0 && <div className="text-sm text-neutral-500">No interviews yet.</div>}
            {!loading && interviews.length > 0 && (
              <ExpandableInterviews
                interviews={interviews}
                onAnalyze={handleAnalyze}
                analyzingName={analyzingName}
                analysisError={analysisError}
                onDelete={handleDelete}
                deletingName={deletingName}
                deleteError={deleteError}
              />
            )}
          </div>
        </div>
      </div>
      <FloatingDock
        desktopClassName="fixed bottom-4 left-1/2 transform -translate-x-1/2"
        mobileClassName="fixed bottom-4 right-4"
        items={dockItems}
      />

      <ModalShell open={showAddModal} onClose={() => setShowAddModal(false)} title="Add interview">
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
              onClick={() => setShowAddModal(false)}
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

      <ModalShell open={showStoryModal} onClose={() => setShowStoryModal(false)} title="Case summary">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{storyTitle}</p>
              {storySavedAt && <p className="text-xs text-neutral-400">Updated {storySavedAt}</p>}
            </div>
            <button
              type="button"
              onClick={fetchStorySummary}
              className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-white hover:border-white/30"
              disabled={storyLoading}
            >
              <IconRefresh className="h-4 w-4" />
              {storyLoading ? "Updating…" : "Refresh"}
            </button>
          </div>

          {storyLoading && <p className="text-sm text-neutral-300">Generating storyline…</p>}
          {storyError && <p className="text-sm text-red-400">{storyError}</p>}

          {!storyLoading && !storyError && storyData && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border border-white/10 bg-[#0c0d10] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Ranking
                </p>
                {storyData.ranking.length === 0 && (
                  <p className="text-sm text-neutral-400">No ranking yet.</p>
                )}
                {storyData.ranking.length > 0 && (
                  <ol className="space-y-2 text-sm text-neutral-100">
                    {storyData.ranking.map((entry) => (
                      <li key={entry.name} className="flex items-start gap-2">
                        <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                          {entry.rank ?? "?"}
                        </span>
                        <div>
                          <p className="font-semibold">{entry.name}</p>
                          <p className="text-neutral-300">{entry.reason}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-white/10 bg-[#0c0d10] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Storyline
                </p>
                <p className="whitespace-pre-wrap text-sm text-neutral-100">{storyData.summary || "No summary yet."}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowStoryModal(false)}
              className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-white hover:border-white/30"
            >
              Close
            </button>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}

export function CometCardDemo({ title, count }: { title: string; count: number }) {
  return (
    <CometCard className="my-4 w-48">
      <div
        className="flex h-full cursor-pointer flex-col items-start gap-2 rounded-[16px] bg-[#1F2121] px-5 py-4 text-white shadow-lg"
        style={{ transformStyle: "preserve-3d" }}
      >
        <p className="text-sm text-gray-300">{title}</p>
        <div className="text-4xl font-semibold leading-none text-gray-100">{count}</div>
        <p className="text-xs text-gray-400">Updated recently</p>
      </div>
    </CometCard>
  );
}

const formatGuiltLevel = (value?: number) =>
  typeof value === "number" && value >= 0 ? `${value}%` : "Pending analysis";

const getTranscriptSnippet = (text?: string, limit = 140) => {
  if (!text) return "No transcript available yet.";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}…`;
};

const buildSuspectImagePath = (name: string) => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `/suspects/${slug}.jpg` : DEFAULT_SUSPECT_IMAGE;
};

const buildAudioUrl = (path?: string) => {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/audio/${path}`;
};

function ExpandableInterviews({
  interviews,
  onAnalyze,
  analyzingName,
  analysisError,
  onDelete,
  deletingName,
  deleteError,
}: {
  interviews: Interview[];
  onAnalyze: (name: string) => Promise<void>;
  analyzingName: string | null;
  analysisError: string | null;
  onDelete: (name: string) => Promise<void>;
  deletingName: string | null;
  deleteError: string | null;
}) {
  const [active, setActive] = useState<Interview | boolean | null>(null);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(false);
    };

    if (active && typeof active === "object") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [active]);

  useOutsideClick(ref, () => setActive(null));

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const target = event.currentTarget;
    const fallbackStage = target.dataset.fallback;
    if (fallbackStage === "default") {
      target.dataset.fallback = "final";
      target.src = FALLBACK_DATA_URL;
      return;
    }
    target.dataset.fallback = "default";
    target.src = DEFAULT_SUSPECT_IMAGE;
  };

  const isActiveCard = active && typeof active === "object";

  return (
    <>
      <AnimatePresence>
        {isActiveCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-10 h-full w-full bg-black/40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isActiveCard ? (
          <div className="fixed inset-0 z-[100] grid place-items-center p-4">
            <motion.button
              key={`button-${active.name}-${id}`}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.05 } }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow lg:hidden"
              onClick={() => setActive(null)}
            >
              <CloseIcon />
            </motion.button>

            <motion.div
              layoutId={`card-${active.name}-${id}`}
              ref={ref}
              className="flex h-full w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-[#0F1012] text-white shadow-2xl md:h-fit md:max-h-[92%]"
            >
              <motion.div layoutId={`image-${active.name}-${id}`}>
                <img
                  width={200}
                  height={220}
                  src={buildSuspectImagePath(active.name)}
                  alt={active.name}
                  data-fallback="start"
                  onError={handleImageError}
                  className="h-64 w-full object-cover object-[50%_40%]"
                />
              </motion.div>

              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <motion.h3
                      layoutId={`title-${active.name}-${id}`}
                      className="text-xl font-semibold"
                    >
                      {active.name}
                    </motion.h3>
                    <motion.p
                      layoutId={`description-${getTranscriptSnippet(active.transcript)}-${id}`}
                      className="text-sm text-neutral-300"
                    >
                      {getTranscriptSnippet(active.transcript)}
                    </motion.p>
                    <p className="text-xs font-medium text-emerald-300">
                      Guilt: {formatGuiltLevel(active.guilt_level)}
                    </p>
                    {active.mp3_path && (
                      <p className="text-xs text-neutral-400">
                        Audio: {buildAudioUrl(active.mp3_path)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(active.name);
                        setActive(null);
                      }}
                      disabled={deletingName === active.name}
                      className="rounded-full border border-red-300/60 px-4 py-2 text-sm font-semibold text-red-200 hover:border-red-200 disabled:opacity-60"
                    >
                      {deletingName === active.name ? "Deleting…" : "Delete interview"}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAnalyze(active.name);
                      }}
                      disabled={analyzingName === active.name}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:border-emerald-300 disabled:opacity-60"
                    >
                      {analyzingName === active.name ? "Analyzing…" : "Analyze guilt"}
                    </button>
                    {analysisError && (
                      <p className="text-[11px] text-red-400">{analysisError}</p>
                    )}
                    {deleteError && (
                      <p className="text-[11px] text-red-400">{deleteError}</p>
                    )}
                  </div>
                </div>

                <div className="relative pt-1">
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex max-h-64 flex-col gap-3 overflow-auto text-sm leading-relaxed text-neutral-200 [mask:linear-gradient(to_bottom,white,white,transparent)] [scrollbar-width:none] [-ms-overflow-style:none]"
                  >
                    {active.transcript ? (
                      <p>{active.transcript}</p>
                    ) : (
                      <p className="text-neutral-400">Transcript unavailable.</p>
                    )}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <ul className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        {interviews.map((interview) => {
          const snippet = getTranscriptSnippet(interview.transcript);
          return (
            <motion.li
              layoutId={`card-${interview.name}-${id}`}
              key={interview.name}
              onClick={() => setActive(interview)}
              className="cursor-pointer rounded-xl border border-white/10 bg-[#0F1012] p-4 text-white transition hover:border-emerald-400/60 hover:bg-[#13151a]"
            >
              <div className="flex items-start gap-3">
                <motion.div layoutId={`image-${interview.name}-${id}`} className="w-20 shrink-0">
                  <img
                    width={100}
                    height={100}
                    src={buildSuspectImagePath(interview.name)}
                    alt={interview.name}
                    data-fallback="start"
                    onError={handleImageError}
                    className="h-20 w-20 rounded-lg object-cover object-[50%_40%]"
                  />
                </motion.div>

                <div className="flex flex-1 flex-col gap-1">
                  <motion.h3
                    layoutId={`title-${interview.name}-${id}`}
                    className="text-lg font-semibold"
                  >
                    {interview.name}
                  </motion.h3>
                  <motion.p
                    layoutId={`description-${snippet}-${id}`}
                    className="text-sm text-neutral-300"
                  >
                    {snippet}
                  </motion.p>
                  <span className="text-xs font-semibold text-emerald-300">
                    Guilt: {formatGuiltLevel(interview.guilt_level)}
                  </span>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </>
  );
}

function ModalShell({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  useOutsideClick(ref, () => {
    if (open) onClose();
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              ref={ref}
              className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0F1012] p-6 text-white shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-lg font-semibold">{title}</h3>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow"
                  onClick={onClose}
                >
                  <CloseIcon />
                </button>
              </div>
              {children}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
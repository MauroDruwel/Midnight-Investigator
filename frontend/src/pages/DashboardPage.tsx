import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FloatingDock } from "@/components/ui/floating-dock";
import {
  IconBrandGithub,
  IconFileText,
  IconHome,
  IconMicrophone,
  IconRefresh,
} from "@tabler/icons-react";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { useAUSession } from "@/hooks/use-au-session";
import { useDashboardRecording } from "@/hooks/use-dashboard-recording";
import type { AUFrame, TemporalEvent, AUValues } from "@/types/au-types";

// Extracted imports
import type { Interview, SummaryPayload } from "@/types/dashboard";
import { setHardwareProcessing, setHardwareIdle } from "@/utils/hardware";
import { API_BASE_URL, OFFLINE_INTERVIEWS } from "@/constants/dashboard";
import { CometDashboardCard } from "@/components/dashboard/CometCard";
import { ExpandableInterviews } from "@/components/dashboard/ExpandableInterviews";
import { ModalShell } from "@/components/dashboard/ModalShell";
import { AddInterviewForm } from "@/components/dashboard/AddInterviewForm";
import { StorylineSummary } from "@/components/dashboard/StorylineSummary";

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
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
    is_demo: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [addStatus, setAddStatus] = useState<"idle" | "submitting">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const [storyTitle, setStoryTitle] = useState("Case storyline");
  const [storySavedAt, setStorySavedAt] = useState<string | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyData, setStoryData] = useState<SummaryPayload | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzingName, setAnalyzingName] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  // AU Session state
  const auSession = useAUSession();

  // Custom Hook for recording logic
  const {
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
  } = useDashboardRecording(auSession);

  const fetchInterviews = useCallback(
    async (signal?: AbortSignal) => {
      setOffline(false);
      setAnalysisError(null);
      if (loading) setLoading(true);
      else setRefreshing(true);
      setHardwareProcessing(); // Start spinner

      try {
        const response = await fetch(`${API_BASE_URL}/interviews`, { signal });
        if (!response.ok) throw new Error("Failed to fetch interviews");
        const data = await response.json();
        if (Array.isArray(data)) setInterviews(data as Interview[]);
        else setInterviews([]);
        setOffline(false);
      } catch (error) {
        console.error("Failed to load interviews", error);
        setOffline(true);
        // fallback
        setInterviews(OFFLINE_INTERVIEWS);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setHardwareIdle(); // Reset to idle
      }
    },
    [loading]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchInterviews(controller.signal);
    return () => controller.abort();
  }, [fetchInterviews]);

  useEffect(() => {
    const openAddModal = (location.state as { openAddModal?: boolean } | null)?.openAddModal;
    if (!openAddModal) return;
    setShowAddModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const fetchStorySummary = useCallback(async () => {
    setStoryLoading(true);
    setStoryError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/summary`);
      const data = await response.json();
      if (data?.error) throw new Error(data.error);
      const payload: SummaryPayload = data.summary || data;
      const sorted = Array.isArray(payload?.ranking)
        ? [...payload.ranking].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
        : [];
      setStoryData({
        ranking: sorted,
        summary: payload?.summary || "",
        timeline: payload?.timeline
      });
      setStoryTitle("AI storyline");
      setStorySavedAt(new Date().toLocaleTimeString());
    } catch (error) {
      console.error(error);
      setStoryError(error instanceof Error ? error.message : "Failed to load storyline.");
      setAnalysisError("Failed to build case timeline.");
    } finally {
      setStoryLoading(false);
      setHardwareIdle();
    }
  }, []);

  useEffect(() => {
    if (showStoryModal) {
      setHardwareProcessing();
      fetchStorySummary();
    }
  }, [showStoryModal, fetchStorySummary]);

  const analyzedInterviews = useMemo(
    () => interviews.filter((iv) => typeof iv.guilt_level === "number" && iv.guilt_level >= 0 && !iv.is_demo),
    [interviews]
  );

  const stats = useMemo(() => {
    const nonDemo = interviews.filter(iv => !iv.is_demo);
    const analyzed = nonDemo.filter(iv => typeof iv.guilt_level === "number" && iv.guilt_level >= 0);

    // Prime Suspect
    const prime = analyzed.length > 0
      ? [...analyzed].sort((a, b) => (b.guilt_level as number) - (a.guilt_level as number))[0]
      : null;

    // Avg Suspicion
    const avg = analyzed.length > 0
      ? Math.round(analyzed.reduce((sum, iv) => sum + (iv.guilt_level as number), 0) / analyzed.length)
      : 0;

    return {
      totalSuspects: nonDemo.length,
      primeSuspect: prime ? prime.name : "None",
      primeGuilt: prime ? prime.guilt_level : 0,
      avgSuspicion: avg,
      demoCount: interviews.filter(iv => iv.is_demo).length,
      totalFiles: interviews.length
    };
  }, [interviews]);

  const dockItems = useMemo(() => [
    { title: "Dashboard", icon: <IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />, href: "#" },
    { title: "Add interview", icon: <IconMicrophone className="h-full w-full text-neutral-500 dark:text-neutral-300" />, onClick: () => setShowAddModal(true) },
    { title: "Storyline", icon: <IconFileText className="h-full w-full text-neutral-500 dark:text-neutral-300" />, onClick: () => setShowStoryModal(true) },
    { title: "GitHub", icon: <IconBrandGithub className="h-full w-full text-neutral-500 dark:text-neutral-300" />, href: "https://github.com/MauroDruwel/Midnight-Investigator" },
  ], []);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    if (file) setDraftInterview((prev) => ({ ...prev, transcript: prev.transcript || "" }));
  };

  const handleAddSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddError(null);
    const trimmedName = draftInterview.name.trim();
    if (!trimmedName) {
      setAddError("Name is required.");
      return;
    }

    const sourceFile: File | null = selectedFile ? selectedFile : recordingBlob ? new File([recordingBlob], `${trimmedName || "recording"}.webm`, { type: recordingBlob.type || "audio/webm" }) : null;

    if (!sourceFile) {
      setAddError("Record audio or upload a file first.");
      return;
    }

    setAddStatus("submitting");
    setHardwareProcessing(); // Start spinner for upload/transcription
    setDraftInterview((prev) => ({ ...prev, transcript: "Processing transcript…" }));

    const formData = new FormData();
    formData.append("name", trimmedName);
    formData.append("file", sourceFile);
    formData.append("is_demo", String(draftInterview.is_demo));

    const auData = auSession.exportSession();
    if (auData) console.log("Successfully captured AU Analysis Data into variable:", JSON.parse(auData));

    try {
      const response = await fetch(`${API_BASE_URL}/interview`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || "Failed to add interview.");

      const updatedInterview: Interview = {
        name: trimmedName,
        guilt_level: typeof data.guilt_level === "number" ? data.guilt_level : -1,
        transcript: data.transcript || "",
        mp3_path: data.mp3_path,
        is_demo: draftInterview.is_demo,
      };

      setInterviews((prev) => [updatedInterview, ...prev.filter((iv) => iv.name !== trimmedName)]);
      setDraftInterview({ name: "", guilt_level: "", transcript: "", mp3_path: "", is_demo: false });
      setRecordingUrl(null);
      setRecordingBlob(null);
      setSelectedFile(null);
      cleanupCapture();
      setShowAddModal(false);

      // Automatically trigger analysis
      handleAnalyze(trimmedName);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setAddStatus("idle");
      setHardwareIdle();
    }
  };

  const handleAnalyze = async (name: string) => {
    setAnalysisError(null);
    setAnalyzingName(name);
    try {
      const formData = new FormData();
      formData.append("name", name);
      const response = await fetch(`${API_BASE_URL}/analyze`, { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || "Analysis failed.");
      setInterviews((prev) => prev.map((iv) => (iv.name === name ? { ...iv, guilt_level: data.guilt_level } : iv)));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "Guilt analysis failed.");
    } finally {
      setAnalyzingName(null);
    }
  };

  const handleDelete = async (name: string) => {
    setDeleteError(null);
    setDeletingName(name);
    try {
      const response = await fetch(`${API_BASE_URL}/interview/${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) throw new Error(data?.error || "Delete failed.");
      setInterviews((prev) => prev.filter((iv) => iv.name !== name));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeletingName(null);
    }
  };

  useEffect(() => {
    if (!showAddModal) {
      cleanupCapture();
      setRecordingUrl(null);
      setRecordingBlob(null);
    }
  }, [showAddModal, cleanupCapture, setRecordingUrl, setRecordingBlob]);

  const handleAUFrame = useCallback((frame: Omit<AUFrame, 'frameIndex'>) => auSession.addFrame(frame), [auSession]);
  const handleAUEvent = useCallback((event: TemporalEvent) => auSession.addEvent(event), [auSession]);
  const handleAUBaseline = useCallback((baseline: AUValues) => auSession.setBaseline(baseline), [auSession]);

  return (
    <div className="relative h-screen w-full">
      <div className="p-4">
        <TextGenerateEffect words="Dashboard" />
        {offline && <div className="mt-2 text-sm text-red-400">Backend is offline — showing hardcoded suspects.</div>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <button type="button" onClick={() => fetchInterviews()} className="flex items-center gap-1 rounded-md border border-white/10 px-3 py-2 font-semibold text-white hover:border-white/30" disabled={refreshing || loading}>
            <IconRefresh className="h-4 w-4" /> {refreshing || loading ? "Refreshing" : "Refresh interviews"}
          </button>
          {analysisError && <span className="text-red-400">{analysisError}</span>}
        </div>
        <div className="flex flex-wrap gap-4">
          <CometDashboardCard
            title="Prime Suspect"
            value={stats.primeSuspect}
            subtext={stats.primeSuspect !== "None" ? `${stats.primeGuilt}% GUILT` : "NO LEADS"}
          />
          <CometDashboardCard
            title="Avg. Suspicion"
            value={`${stats.avgSuspicion}%`}
            subtext={`${analyzedInterviews.length} EXAMINED`}
          />
          <CometDashboardCard
            title="Case Intel"
            value={stats.totalSuspects}
            subtext={`${stats.demoCount} DEMO EXCLUDED`}
          />
        </div>
        <div className="mt-8 space-y-6">
          <TextGenerateEffect words="Interviews" />
          <div className="flex flex-wrap gap-4">
            {loading && <div className="text-sm text-neutral-400">Loading interviews…</div>}
            {!loading && interviews.length === 0 && <div className="text-sm text-neutral-500">No interviews yet.</div>}
            {!loading && interviews.length > 0 && <ExpandableInterviews interviews={interviews} onAnalyze={handleAnalyze} analyzingName={analyzingName} analysisError={analysisError} onDelete={handleDelete} deletingName={deletingName} deleteError={deleteError} />}
          </div>
        </div>
      </div>
      <FloatingDock desktopClassName="fixed bottom-4 left-1/2 transform -translate-x-1/2" mobileClassName="fixed bottom-4 right-4" items={dockItems} />
      <ModalShell open={showAddModal} onClose={() => setShowAddModal(false)} title="Add interview" maxWidth="max-w-2xl">
        <AddInterviewForm draftInterview={{ name: draftInterview.name, transcript: draftInterview.transcript, is_demo: draftInterview.is_demo }} onDraftChange={(name, value) => setDraftInterview((p) => ({ ...p, [name]: value }))} onSubmit={handleAddSubmit} onCancel={() => setShowAddModal(false)} addStatus={addStatus} addError={addError} onFileSelect={handleFileSelect} recordingStatus={recordingStatus} volumeLevel={volumeLevel} recordingUrl={recordingUrl} videoRef={videoRef} onStartCapture={startCapture} onStopCapture={stopCapture} auAnalysisActive={auAnalysisActive} onAUFrame={handleAUFrame} onAUEvent={handleAUEvent} onAUBaseline={handleAUBaseline} auSessionSummary={auSession.sessionData?.summary} />
      </ModalShell>
      <ModalShell open={showStoryModal} onClose={() => setShowStoryModal(false)} title="Case summary" maxWidth="max-w-4xl">
        <StorylineSummary title={storyTitle} savedAt={storySavedAt} loading={storyLoading} error={storyError} data={storyData} onRefresh={fetchStorySummary} onClose={() => setShowStoryModal(false)} />
      </ModalShell>
    </div>
  );
}
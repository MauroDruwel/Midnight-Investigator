import { type ChangeEvent, type FormEvent, type RefObject } from "react";
import { FacialAUAnalyzer } from "@/components/FacialAUAnalyzer";
import type { AUFrame, TemporalEvent, AUValues } from "@/types/au-types";

type AddInterviewFormProps = {
    draftInterview: {
        name: string;
        transcript: string;
        is_demo: boolean;
    };
    onDraftChange: (name: string, value: any) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onCancel: () => void;
    addStatus: "idle" | "submitting";
    addError: string | null;
    onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;

    // Recording props
    recordingStatus: "idle" | "recording" | "stopping";
    volumeLevel: number;
    recordingUrl: string | null;
    videoRef: RefObject<HTMLVideoElement | null>;
    onStartCapture: () => void;
    onStopCapture: () => void;
    auAnalysisActive: boolean;
    onAUFrame: (frame: Omit<AUFrame, 'frameIndex'>) => void;
    onAUEvent: (event: TemporalEvent) => void;
    onAUBaseline: (baseline: AUValues) => void;
    auSessionSummary: any | null; // From auSession.sessionData
};

export function AddInterviewForm({
    draftInterview,
    onDraftChange,
    onSubmit,
    onCancel,
    addStatus,
    addError,
    onFileSelect,
    recordingStatus,
    volumeLevel,
    recordingUrl,
    videoRef,
    onStartCapture,
    onStopCapture,
    auAnalysisActive,
    onAUFrame,
    onAUEvent,
    onAUBaseline,
    auSessionSummary,
}: AddInterviewFormProps) {
    return (
        <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="name">
                    Name
                </label>
                <input
                    id="name"
                    className="w-full rounded-md border border-white/10 bg-[#0c0d10] p-2 text-sm text-white outline-none focus:border-emerald-400"
                    placeholder="Suspect name"
                    value={draftInterview.name}
                    onChange={(e) => onDraftChange("name", e.target.value)}
                />
            </div>

            {/* Demo Mode Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
                <div className="space-y-0.5">
                    <label className="text-sm font-bold text-white uppercase tracking-wider" htmlFor="demo-mode">
                        Demo Mode
                    </label>
                    <p className="text-[10px] text-neutral-500 font-medium leading-none uppercase tracking-widest">
                        Excludes this interview from the case dossier
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onDraftChange("is_demo", !draftInterview.is_demo)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${draftInterview.is_demo ? "bg-emerald-500" : "bg-neutral-800"
                        }`}
                >
                    <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${draftInterview.is_demo ? "translate-x-4" : "translate-x-0"
                            }`}
                    />
                </button>
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
                                onClick={onStartCapture}
                                disabled={recordingStatus === "recording"}
                                className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-black shadow hover:bg-emerald-400 disabled:opacity-60"
                            >
                                {recordingStatus === "recording" ? "Recording…" : "Start"}
                            </button>
                            <button
                                type="button"
                                onClick={onStopCapture}
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
                        <div className="relative flex-1 min-h-[220px] w-full overflow-hidden rounded-md border border-white/10 bg-black/40">
                            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline style={{ transform: 'scaleX(-1)' }} />
                            <FacialAUAnalyzer
                                videoRef={videoRef}
                                isActive={auAnalysisActive}
                                onFrame={onAUFrame}
                                onEvent={onAUEvent}
                                onBaseline={onAUBaseline}
                                className="absolute inset-0"
                            />
                        </div>
                        {recordingUrl && (
                            <div className="rounded-md border border-white/10 p-2 text-xs text-white/80">
                                Recorded clip ready. It will be sent with this entry.
                            </div>
                        )}
                        {auSessionSummary && (
                            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-300">
                                <div className="font-semibold mb-1">📊 Facial Analysis Complete</div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                    <span>Frames analyzed:</span>
                                    <span>{auSessionSummary.totalFrames}</span>
                                    <span>Face detection rate:</span>
                                    <span>{(auSessionSummary.faceDetectionRate * 100).toFixed(0)}%</span>
                                    <span>Avg expressiveness:</span>
                                    <span>{(auSessionSummary.averageExpressiveness * 100).toFixed(0)}%</span>
                                    <span>Rapid changes:</span>
                                    <span>{auSessionSummary.rapidChangeCount}</span>
                                </div>
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
                        onChange={onFileSelect}
                        className="text-xs text-neutral-300 file:mr-2 file:rounded-md file:border file:border-white/20 file:bg-white/10 file:px-3 file:py-1 file:text-white"
                    />
                    {addError && <p className="text-xs text-red-400">{addError}</p>}
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
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
    );
}

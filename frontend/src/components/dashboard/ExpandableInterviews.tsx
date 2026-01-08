import React, { useId, useRef, useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloseIcon } from "@/components/expandable-card-demo-standard";
import { useOutsideClick } from "@/hooks/use-outside-click";
import type { Interview } from "@/types/dashboard";
import {
    buildSuspectImagePath,
    getTranscriptSnippet,
    formatGuiltLevel,
    buildAudioUrl,
} from "@/utils/dashboard-utils";
import { setHardwareGuilt, setHardwareIdle, setHardwareProcessing } from "@/utils/hardware";
import { DEFAULT_SUSPECT_IMAGE, FALLBACK_DATA_URL } from "@/constants/dashboard";

type ExpandableInterviewsProps = {
    interviews: Interview[];
    onAnalyze: (name: string) => Promise<void>;
    analyzingName: string | null;
    analysisError: string | null;
    onDelete: (name: string) => Promise<void>;
    deletingName: string | null;
    deleteError: string | null;
};

export function ExpandableInterviews({
    interviews,
    onAnalyze,
    analyzingName,
    analysisError,
    onDelete,
    deletingName,
    deleteError,
}: ExpandableInterviewsProps) {
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
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        >
                            <motion.div
                                layoutId={`image-${active.name}-${id}`}
                                className="w-full relative"
                            >
                                <img
                                    width={200}
                                    height={220}
                                    src={buildSuspectImagePath(active.name)}
                                    alt={active.name}
                                    data-fallback="start"
                                    onError={handleImageError}
                                    className="h-64 w-full object-cover object-[50%_40%] rounded-t-3xl"
                                />
                            </motion.div>

                            <div className="flex flex-col gap-4 p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <motion.h3
                                            layoutId={`title-${active.name}-${id}`}
                                            className="text-2xl font-bold text-white"
                                        >
                                            {active.name}
                                            {active.is_demo && (
                                                <span className="ml-3 inline-block rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-500 border border-amber-500/30">
                                                    DEMO
                                                </span>
                                            )}
                                        </motion.h3>
                                        <div className="flex items-center gap-3">
                                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                                                Guilt Level: {formatGuiltLevel(active.guilt_level)}
                                            </span>
                                            {active.mp3_path && (
                                                <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                                                    Audio Recorded
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 gap-2">
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setHardwareProcessing();
                                                onAnalyze(active.name);
                                            }}
                                            disabled={analyzingName === active.name}
                                            className="flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                                        >
                                            {analyzingName === active.name ? "Analyzing…" : "Analyze"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onDelete(active.name);
                                                setActive(null);
                                            }}
                                            disabled={deletingName === active.name}
                                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:opacity-50"
                                            title="Delete interview"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {active.mp3_path && (
                                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Audio Playback</p>
                                        <audio
                                            controls
                                            className="h-10 w-full"
                                            src={buildAudioUrl(active.mp3_path)}
                                            onPlay={() => setHardwareProcessing()}
                                            onPause={() => setHardwareIdle()}
                                            onEnded={() => setHardwareIdle()}
                                        >
                                            Your browser does not support the audio element.
                                        </audio>
                                    </div>
                                )}

                                <div className="relative">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Examination Transcript</p>
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="max-h-64 overflow-auto rounded-xl border border-white/5 bg-black/20 p-4 text-sm leading-relaxed text-neutral-200 custom-scrollbar"
                                    >
                                        {active.transcript ? (
                                            <p className="whitespace-pre-wrap">{active.transcript}</p>
                                        ) : (
                                            <p className="italic text-neutral-500">Transcript unavailable.</p>
                                        )}
                                    </motion.div>
                                </div>

                                {analysisError && <p className="text-xs text-red-500">{analysisError}</p>}
                                {deleteError && <p className="text-xs text-red-500">{deleteError}</p>}
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
                            onMouseEnter={() => {
                                if (typeof interview.guilt_level === 'number') {
                                    setHardwareGuilt(interview.guilt_level);
                                }
                            }}
                            onMouseLeave={() => setHardwareIdle()}
                            className="cursor-pointer rounded-2xl border border-white/10 bg-[#0F1012] p-4 text-white transition-colors duration-200 hover:border-emerald-400/60 hover:bg-[#13151a]"
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
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
                                        className="text-lg font-semibold flex items-center gap-2"
                                    >
                                        {interview.name}
                                        {interview.is_demo && (
                                            <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-500 border border-amber-500/20">
                                                DEMO
                                            </span>
                                        )}
                                    </motion.h3>
                                    <p className="text-sm text-neutral-300">
                                        {snippet}
                                    </p>
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

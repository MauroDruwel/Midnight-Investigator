import { useState } from "react";
import { IconRefresh, IconHistory, IconTarget } from "@tabler/icons-react";
import type { SummaryPayload } from "@/types/dashboard";
import { Timeline } from "@/components/ui/timeline";
import { buildSuspectImagePath } from "@/utils/dashboard-utils";

type StorylineSummaryProps = {
    title: string;
    savedAt: string | null;
    loading: boolean;
    error: string | null;
    data: SummaryPayload | null;
    onRefresh: () => void;
    onClose: () => void;
};

export function StorylineSummary({
    title,
    savedAt,
    loading,
    error,
    data,
    onRefresh,
    onClose,
}: StorylineSummaryProps) {
    const [activeTab, setActiveTab] = useState<"chronicle" | "verdict">("chronicle");

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <p className="mt-4 text-sm font-medium text-emerald-100/60 animate-pulse uppercase tracking-widest">Consulting AI evidence files…</p>
            </div>
        );
    }

    const narrativeTimelineData = data?.timeline?.map((item) => ({
        title: item.title,
        content: (
            <div className="p-2">
                <p className="text-sm md:text-base leading-relaxed text-neutral-300">
                    {item.content}
                </p>
            </div>
        ),
    })) || [];

    return (
        <div className="space-y-6 py-2">
            {/* Dossier Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-2">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-1 uppercase italic">{title}</h2>
                    {savedAt && (
                        <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest leading-none">Dossier updated {savedAt}</p>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all active:scale-95"
                        disabled={loading}
                    >
                        <IconRefresh className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? "Decrypting…" : "Re-Analyze"}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black hover:bg-neutral-200 transition-all active:scale-95 shadow-lg shadow-white/5"
                    >
                        Close
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center">
                    <p className="text-sm text-red-400 font-bold mb-4">{error}</p>
                    <button onClick={onRefresh} className="text-xs font-black uppercase tracking-widest text-white underline underline-offset-4 decoration-red-500/40">Try Decrypting Again</button>
                </div>
            )}

            {!loading && !error && data && (
                <div className="space-y-6">
                    {/* Fixed Summary Briefing */}
                    {data.summary && (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-[0_0_20px_rgba(16,185,129,0.03)] border-l-4 border-l-emerald-500">
                            <p className="text-sm leading-relaxed text-emerald-100 font-medium italic opacity-90">
                                &ldquo;{data.summary}&rdquo;
                            </p>
                        </div>
                    )}

                    {/* Tab Switcher */}
                    <div className="flex p-1 gap-1 rounded-2xl bg-white/5 border border-white/5 self-start w-fit">
                        {[
                            { id: "chronicle", label: "Evidence Chronicle", icon: IconHistory },
                            { id: "verdict", label: "Final Verdict", icon: IconTarget },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                        ? "bg-white text-black shadow-lg"
                                        : "text-neutral-500 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <tab.icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Dynamic Tab Content */}
                    <div className="relative mt-2 min-h-[400px]">
                        {activeTab === "chronicle" ? (
                            narrativeTimelineData.length > 0 ? (
                                <div className="relative rounded-3xl border border-white/5 bg-black/40 backdrop-blur-xl p-4 shadow-inner">
                                    <div className="absolute -inset-2 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent opacity-50 blur-2xl rounded-[3rem]" />
                                    <Timeline data={narrativeTimelineData} />
                                </div>
                            ) : (
                                <div className="py-20 text-center">
                                    <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">No narrative evidence processed yet.</p>
                                </div>
                            )
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="grid gap-4">
                                    {data.ranking.map((suspect, idx) => (
                                        <div
                                            key={suspect.name}
                                            className={`group flex flex-col md:flex-row gap-5 rounded-2xl border border-white/5 bg-white/5 p-5 shadow-xl transition-all hover:border-emerald-500/30 ${idx === 0 ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20" : ""}`}
                                        >
                                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-lg">
                                                <img
                                                    src={buildSuspectImagePath(suspect.name)}
                                                    alt={suspect.name}
                                                    className="h-full w-full object-cover grayscale transition-all group-hover:grayscale-0"
                                                    onError={(e) => {
                                                        (e.currentTarget as HTMLImageElement).src = "/images/suspects/default.webp";
                                                    }}
                                                />
                                                {idx === 0 && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10">
                                                        <div className="h-full w-full animate-pulse bg-emerald-500/5" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-lg font-bold text-white tracking-tight">
                                                        {idx + 1}. {suspect.name}
                                                    </span>
                                                    {idx === 0 && (
                                                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/30">
                                                            Prime Suspect
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm leading-relaxed text-neutral-400 font-medium italic">
                                                    &ldquo;{suspect.reason}&rdquo;
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
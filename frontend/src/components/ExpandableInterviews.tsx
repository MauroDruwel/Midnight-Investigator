import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloseIcon } from "@/components/expandable-card-demo-standard";
import { useOutsideClick } from "@/hooks/use-outside-click";
import type { Interview } from "@/types/interview";
import { formatGuiltLevel, getTranscriptSnippet, buildSuspectImagePath, buildAudioUrl, DEFAULT_SUSPECT_IMAGE, FALLBACK_DATA_URL } from "@/utils/interviewUtils";

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

export { ExpandableInterviews };
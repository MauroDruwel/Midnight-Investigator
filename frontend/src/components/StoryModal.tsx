import { useCallback, useEffect, useState } from "react";
import { ModalShell } from "./ModalShell";
import { IconRefresh } from "@tabler/icons-react";
import type { SummaryPayload } from "@/types/interview";
import { API_BASE_URL } from "@/utils/interviewUtils";

interface StoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function StoryModal({ open, onClose }: StoryModalProps) {
  const [storyTitle, setStoryTitle] = useState("Case storyline");
  const [storySavedAt, setStorySavedAt] = useState<string | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyData, setStoryData] = useState<SummaryPayload | null>(null);

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
    if (open) {
      fetchStorySummary();
    }
  }, [open, fetchStorySummary]);

  return (
    <ModalShell open={open} onClose={onClose} title="Case summary">
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
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-white hover:border-white/30"
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
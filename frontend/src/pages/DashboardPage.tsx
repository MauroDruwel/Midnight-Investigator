import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FloatingDock } from "@/components/ui/floating-dock";
import {
  IconRefresh,
} from "@tabler/icons-react";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { CometCardDemo } from "@/components/CometCardDemo";
import { ExpandableInterviews } from "@/components/ExpandableInterviews";
import { AddInterviewModal } from "@/components/AddInterviewModal";
import { StoryModal } from "@/components/StoryModal";
import { useInterviews } from "@/hooks/useInterviews";
import { getDockItems } from "@/utils/dockItems";

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStoryModal, setShowStoryModal] = useState(false);

  const {
    interviews,
    setInterviews,
    loading,
    refreshing,
    offline,
    analysisError,
    analyzingName,
    deleteError,
    deletingName,
    fetchInterviews,
    handleAnalyze,
    handleDelete,
  } = useInterviews();

  useEffect(() => {
    const openAddModal = (location.state as { openAddModal?: boolean } | null)?.openAddModal;
    if (!openAddModal) return;

    setShowAddModal(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);



  const analyzedCount = useMemo(
    () => interviews.filter((iv) => typeof iv.guilt_level === "number" && iv.guilt_level >= 0).length,
    [interviews]
  );

  const dockItems = getDockItems(() => setShowAddModal(true), () => setShowStoryModal(true));

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

      <AddInterviewModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onInterviewAdded={(interview) => {
          setInterviews((prev) => {
            const filtered = prev.filter((iv) => iv.name !== interview.name);
            return [interview, ...filtered];
          });
        }}
      />

      <StoryModal open={showStoryModal} onClose={() => setShowStoryModal(false)} />
    </div>
  );
}
import { useCallback, useEffect, useState } from "react";
import type { Interview } from "@/types/interview";
import { API_BASE_URL } from "@/utils/interviewUtils";
import { OFFLINE_INTERVIEWS } from "@/utils/constants";

export function useInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
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
        // Ignore aborts caused by component unmounts or refreshes; they are expected.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
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

  return {
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
  };
}
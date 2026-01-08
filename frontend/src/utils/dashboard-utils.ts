import { API_BASE_URL, DEFAULT_SUSPECT_IMAGE } from "@/constants/dashboard";

export const formatGuiltLevel = (value?: number) =>
    typeof value === "number" && value >= 0 ? `${value}%` : "Pending analysis";

export const getTranscriptSnippet = (text?: string, limit = 140) => {
    if (!text) return "No transcript available yet.";
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}…`;
};

export const buildSuspectImagePath = (name: string) => {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug ? `/suspects/${slug}.jpg` : DEFAULT_SUSPECT_IMAGE;
};

export const buildAudioUrl = (path?: string) => {
    if (!path) return undefined;
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
    return `${API_BASE_URL}/audio/${path}`;
};

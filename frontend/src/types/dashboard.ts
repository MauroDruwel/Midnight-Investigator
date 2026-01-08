export type Interview = {
    name: string;
    transcript?: string;
    guilt_level?: number;
    mp3_path?: string;
    is_demo?: boolean;
};

export type SummaryRankingEntry = {
    name: string;
    rank?: number;
    reason: string;
};

export type SummaryPayload = {
    ranking: SummaryRankingEntry[];
    summary: string;
    timeline?: { title: string; content: string }[];
};

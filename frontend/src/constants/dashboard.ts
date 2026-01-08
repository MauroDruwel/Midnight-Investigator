import type { Interview } from "@/types/dashboard";

export const API_BASE_URL = "http://localhost:8000";
export const DEFAULT_SUSPECT_IMAGE = "/suspects/default.jpg";
export const FALLBACK_DATA_URL =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='512' height='320' viewBox='0 0 512 320' fill='none'><rect width='512' height='320' rx='20' fill='%23121a1c'/><circle cx='120' cy='140' r='60' fill='%232c3a3e'/><rect x='210' y='90' width='200' height='30' rx='8' fill='%233b4c52'/><rect x='210' y='140' width='180' height='24' rx='8' fill='%23485960'/><rect x='210' y='184' width='120' height='20' rx='8' fill='%236f868f'/><text x='120' y='255' fill='%2396a7ad' font-family='sans-serif' font-size='22' text-anchor='middle'>Suspect</text><text x='120' y='285' fill='%235f7279' font-family='sans-serif' font-size='14' text-anchor='middle'>Awaiting photo</text></svg>";

export const OFFLINE_INTERVIEWS: Interview[] = [
    {
        name: "Jane",
        guilt_level: 42,
        transcript: "Renran insists they were cataloging evidence when the lights flickered."
    },
    {
        name: "Avery Moss",
        guilt_level: -1,
        transcript: "Claims to have been reviewing ledger entries; no alibi witness yet."
    },
    {
        name: "Casey Dawn",
        guilt_level: 73,
        transcript:
            "States they heard footsteps near the stairwell but couldn't identify the voice."
    },
];

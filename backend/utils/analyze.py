
import os
import requests
import json
from dotenv import load_dotenv
load_dotenv()


# Retrieve environment variables once
API_KEY = os.getenv("HACKCLUB_API_KEY")
SERVER_URL = os.getenv("HACKCLUB_SERVER_URL", "")
MODEL = "openai/gpt-5.1"

# Centralized prompts for easy editing
PROMPT_GUILT_SYSTEM = (
    "You're a teenage detective. Analyze the transcript and give a guilt level from 0 (innocent) to 100 (guilty). "
    "Respond like a teenager, keep it casual, but only return the number."
)
PROMPT_SUMMARY_SYSTEM = (
    "You're a teenage detective AI. Given the following interview transcripts, rank the suspects from most to least likely to be the murderer. "
    "For each, give a short, casual, teenage-style reason, with some max gen z vibe, like put as most memes in it as possible. "
    "Return ONLY valid JSON (no markdown). The JSON must be an object of this exact shape: "
    "{\"ranking\": [{\"name\": string, \"rank\": number, \"reason\": string}], \"summary\": string}. "
    "Do not include a 'summary' field inside ranking items."
)


def analyze_guilt(transcript):
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_GUILT_SYSTEM},
            {"role": "user", "content": transcript}
        ]
    }
    response = requests.post(SERVER_URL, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    result = response.json()
    guilt_level = None
    if "choices" in result and result["choices"]:
        content = result["choices"][0].get("message", {}).get("content", "")
        try:
            guilt_level = int(content.strip())
        except Exception:
            guilt_level = content.strip()
    else:
        guilt_level = result
    return guilt_level

def analyze_summary(summary_prompt):
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_SUMMARY_SYSTEM},
            {"role": "user", "content": summary_prompt}
        ]
    }
    response = requests.post(SERVER_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    result = response.json()
    summary = None
    if "choices" in result and result["choices"]:
        content = result["choices"][0].get("message", {}).get("content", "")
        try:
            summary = json.loads(content)
        except Exception:
            summary = content.strip()
    else:
        summary = result
    return summary

import os
import requests
import json
from dotenv import load_dotenv
load_dotenv()
import logging
import traceback

logger = logging.getLogger(__name__)


# Retrieve environment variables once. Fall back to Hack Club proxy defaults
# used elsewhere in the app if explicit vars are not present.
API_KEY = os.getenv("HACKCLUB_API_KEY") or os.getenv("HACKCLUB_AI_KEY")
SERVER_URL = os.getenv(
    "HACKCLUB_SERVER_URL", "https://ai.hackclub.com/proxy/v1/chat/completions"
)
MODEL = os.getenv("HACKCLUB_MODEL", "openai/gpt-5.1")

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
    logger.info("analyze_guilt: starting analysis request; server=%s model=%s", SERVER_URL, MODEL)
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_GUILT_SYSTEM},
            {"role": "user", "content": transcript}
        ]
    }
    try:
        response = requests.post(SERVER_URL, headers=headers, json=payload, timeout=30)
    except Exception as e:
        logger.error("analyze_guilt: request failed: %s", e)
        logger.debug(traceback.format_exc())
        raise RuntimeError(f"Failed to reach analysis server at {SERVER_URL}: {e}") from e

    try:
        response.raise_for_status()
    except Exception as e:
        # surface server response for easier debugging
        body = None
        try:
            body = response.text
        except Exception:
            body = "<unable to read response body>"
        logger.error("analyze_guilt: server returned HTTP %s: %s", response.status_code, body)
        logger.debug(traceback.format_exc())
        raise RuntimeError(f"Analysis server returned HTTP {response.status_code}: {body}") from e

    try:
        result = response.json()
    except Exception:
        logger.error("analyze_guilt: non-JSON response: %s", response.text)
        raise RuntimeError(f"Analysis server returned non-JSON response: {response.text}")
    guilt_level = None
    if "choices" in result and result["choices"]:
        content = result["choices"][0].get("message", {}).get("content", "")
        try:
            guilt_level = int(content.strip())
        except Exception:
            guilt_level = content.strip()
            logger.info("analyze_guilt: non-integer content returned: %s", guilt_level)
    else:
        guilt_level = result
    logger.info("analyze_guilt: result=%s", guilt_level)
    return guilt_level

def analyze_summary(summary_prompt):
    logger.info("analyze_summary: starting analysis request; server=%s model=%s", SERVER_URL, MODEL)
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": PROMPT_SUMMARY_SYSTEM},
            {"role": "user", "content": summary_prompt}
        ]
    }
    try:
        response = requests.post(SERVER_URL, headers=headers, json=payload, timeout=60)
    except Exception as e:
        logger.error("analyze_summary: request failed: %s", e)
        logger.debug(traceback.format_exc())
        raise RuntimeError(f"Failed to reach analysis server at {SERVER_URL}: {e}") from e

    try:
        response.raise_for_status()
    except Exception as e:
        body = None
        try:
            body = response.text
        except Exception:
            body = "<unable to read response body>"
        logger.error("analyze_summary: server returned HTTP %s: %s", response.status_code, body)
        logger.debug(traceback.format_exc())
        raise RuntimeError(f"Analysis server returned HTTP {response.status_code}: {body}") from e

    try:
        result = response.json()
    except Exception:
        logger.error("analyze_summary: non-JSON response: %s", response.text)
        raise RuntimeError(f"Analysis server returned non-JSON response: {response.text}")
    summary = None
    if "choices" in result and result["choices"]:
        content = result["choices"][0].get("message", {}).get("content", "")
        try:
            summary = json.loads(content)
        except Exception:
            summary = content.strip()
    else:
        summary = result
    logger.info("analyze_summary: result type=%s", type(summary))
    return summary

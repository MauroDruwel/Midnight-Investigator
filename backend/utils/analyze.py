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
        response.raise_for_status()
        result = response.json()
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
    except Exception as e:
        logger.error("analyze_guilt: hackclub request failed, trying Gemini: %s", e)
        logger.debug(traceback.format_exc())
        # Gemini fallback
        try:
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            if not gemini_api_key:
                raise RuntimeError("GEMINI_API_KEY not set in environment")
            gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            prompt = PROMPT_GUILT_SYSTEM + "\n" + transcript
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            headers = {"Content-Type": "application/json"}
            params = {"key": gemini_api_key}
            response = requests.post(gemini_url, headers=headers, params=params, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()
            content = ""
            try:
                content = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            except Exception:
                content = str(result)
            try:
                guilt_level = int(content)
            except Exception:
                guilt_level = content
            logger.info("analyze_guilt: Gemini result=%s", guilt_level)
            return guilt_level
        except Exception as ge:
            logger.error("analyze_guilt: Gemini fallback failed: %s", ge)
            logger.debug(traceback.format_exc())
            raise RuntimeError(f"Both Hackclub and Gemini API failed: {ge}") from ge

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
        logger.info("analyze_summary: result type=%s", type(summary))
        return summary
    except Exception as e:
        logger.error("analyze_summary: hackclub request failed, trying Gemini: %s", e)
        logger.debug(traceback.format_exc())
        # Gemini fallback
        try:
            gemini_api_key = os.getenv("GEMINI_API_KEY")
            if not gemini_api_key:
                raise RuntimeError("GEMINI_API_KEY not set in environment")
            gemini_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
            prompt = PROMPT_SUMMARY_SYSTEM + "\n" + summary_prompt
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            headers = {"Content-Type": "application/json"}
            params = {"key": gemini_api_key}
            response = requests.post(gemini_url, headers=headers, params=params, json=payload, timeout=60)
            response.raise_for_status()
            result = response.json()
            content = ""
            try:
                content = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            except Exception:
                content = str(result)
            try:
                summary = json.loads(content)
            except Exception:
                summary = content
            logger.info("analyze_summary: Gemini result type=%s", type(summary))
            return summary
        except Exception as ge:
            logger.error("analyze_summary: Gemini fallback failed: %s", ge)
            logger.debug(traceback.format_exc())
            raise RuntimeError(f"Both Hackclub and Gemini API failed: {ge}") from ge

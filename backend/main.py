from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os
import re
import httpx
import base64
import logging
import traceback

# Basic logging to stdout for easier debugging in dev
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

from backend.utils.interview_files import load_interviews, save_interviews
from backend.utils.transcript import save_audio_file, generate_transcript
from backend.utils.analyze import analyze_guilt, analyze_summary

# =====================================================
# APP INIT (MUST BE FIRST)
# =====================================================

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# CONFIG
# =====================================================

HACKCLUB_PROXY_URL = "https://ai.hackclub.com/proxy/v1/chat/completions"
HACKCLUB_API_KEY = os.getenv("HACKCLUB_AI_KEY")

if not HACKCLUB_API_KEY:
    print("[WARN] HACKCLUB_AI_KEY not set")

# =====================================================
# VIDEO FEEDBACK (VISION MODEL)
# =====================================================

@app.post("/video-feedback")
async def video_feedback(
    file: UploadFile = File(...),
    goal: str = Form(
        "Give camera/communication feedback for an interview. Avoid judging guilt."
    ),
):
    if not HACKCLUB_API_KEY:
        logger.error("video_feedback: Missing HACKCLUB_AI_KEY")
        raise HTTPException(status_code=500, detail="Missing HACKCLUB_AI_KEY")

    img_bytes = await file.read()
    if not img_bytes:
        raise HTTPException(status_code=400, detail="Empty image upload")

    b64 = base64.b64encode(img_bytes).decode("utf-8")
    data_url = f"data:{file.content_type or 'image/jpeg'};base64,{b64}"

    payload = {
        "model": "qwen/qwen3-vl-235b-a22b-instruct",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a real-time interview coach. "
                    "Only comment on observable factors (lighting, framing, gaze, posture). "
                    "DO NOT infer guilt, deception, or intent. "
                    "Return 3–6 short bullet tips and a single quality_score (1–10)."
                ),
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": goal},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                HACKCLUB_PROXY_URL,
                headers={
                    "Authorization": f"Bearer {HACKCLUB_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            r.raise_for_status()
            data = r.json()

        logger.info("video_feedback: received response from model proxy")
        return {"feedback": data["choices"][0]["message"]["content"]}
    except Exception as e:
        logger.error("video_feedback: exception: %s", e)
        logger.debug(traceback.format_exc())
        raise HTTPException(status_code=502, detail=str(e))

# =====================================================
# INTERVIEWS
# =====================================================

@app.get("/interviews")
def get_interviews():
    interviews = load_interviews()
    if isinstance(interviews, list):
        return [iv for iv in interviews if isinstance(iv, dict) and iv.get("name")]
    return interviews


@app.post("/interview")
async def add_interview(
    name: str = Form(...),
    file: UploadFile = File(...),
):
    logger.info("add_interview: start for name=%s filename=%s", name, getattr(file, 'filename', None))
    content = await file.read()
    if not content:
        logger.error("add_interview: empty upload for %s", name)
        raise HTTPException(status_code=400, detail="Empty audio file")

    file_path, safe_filename = save_audio_file(name, content)

    try:
        transcript_text = generate_transcript(file_path)
    except Exception as e:
        logger.error("add_interview: transcription failed for %s: %s", name, e)
        logger.debug(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

    interviews = load_interviews()
    if not isinstance(interviews, list):
        interviews = []

    interviews = [iv for iv in interviews if iv.get("name") != name]

    interviews.append(
        {
            "name": name,
            "mp3_path": file_path,
            "guilt_level": -1,
            "transcript": transcript_text,
        }
    )

    save_interviews(interviews)
    logger.info("add_interview: saved interview %s", name)

    return {
        "message": "Interview added",
        "name": name,
        "transcript": transcript_text,
    }


@app.delete("/interview/{name}")
async def delete_interview(name: str):
    interviews = load_interviews()
    interview = next((iv for iv in interviews if iv.get("name") == name), None)

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    if interview.get("mp3_path") and os.path.exists(interview["mp3_path"]):
        os.remove(interview["mp3_path"])

    interviews = [iv for iv in interviews if iv.get("name") != name]
    save_interviews(interviews)

    logger.info("delete_interview: deleted %s", name)
    return {"message": f"Interview '{name}' deleted"}


@app.delete("/interviews/reset")
async def reset_interviews():
    interviews = load_interviews()

    for iv in interviews:
        if iv.get("mp3_path") and os.path.exists(iv["mp3_path"]):
            os.remove(iv["mp3_path"])

    save_interviews([])
    logger.info("reset_interviews: removed all interviews")
    return {"message": "All interviews deleted"}

# =====================================================
# ANALYSIS
# =====================================================

@app.post("/analyze")
async def analyze_guilt_endpoint(name: str = Form(...)):
    interviews = load_interviews()
    interview = next((iv for iv in interviews if iv.get("name") == name), None)

    if not interview or not interview.get("transcript"):
        logger.error("analyze_guilt: transcript not found for %s", name)
        raise HTTPException(status_code=404, detail="Transcript not found")

    try:
        guilt_level = analyze_guilt(interview["transcript"])
    except Exception as e:
        logger.error("analyze_guilt: analyze_guilt failed for %s: %s", name, e)
        logger.debug(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    interview["guilt_level"] = guilt_level
    save_interviews(interviews)

    logger.info("analyze_guilt: computed guilt=%s for %s", guilt_level, name)
    return {"name": name, "guilt_level": guilt_level}


@app.get("/summary")
async def summary_endpoint():
    interviews = load_interviews()
    valid = [iv for iv in interviews if iv.get("transcript")]

    if not valid:
        logger.error("summary_endpoint: no transcripts available")
        raise HTTPException(status_code=400, detail="No transcripts")

    prompt = "Transcripts:\n"
    for iv in valid:
        prompt += f"\nName: {iv['name']}\nTranscript: {iv['transcript']}\n"

    result = analyze_summary(prompt)
    logger.info("summary_endpoint: summary computed")
    return {"summary": result}

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os
import re
import httpx
import base64
import logging
import traceback
import asyncio
import numpy as np
import ffmpeg
from time import time

# Basic logging to stdout for easier debugging in dev (use DEBUG to show tracebacks)
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

from backend.utils.interview_files import load_interviews, save_interviews
from backend.utils.transcript import save_audio_file, generate_transcript, _load_model
from backend.utils.analyze import analyze_guilt, analyze_summary
from backend.utils.online_asr import OnlineASRProcessor

# =====================================================
# APP INIT (MUST BE FIRST)
# =====================================================

app = FastAPI()


@app.on_event("startup")
def log_routes_on_startup():
    logger.info("Registered routes:")
    try:
        for route in app.router.routes:
            methods = getattr(route, "methods", None)
            path = getattr(route, "path", None) or getattr(route, "name", str(route))
            logger.info("  %s %s", ",".join(methods) if methods else "--", path)
    except Exception:
        logger.debug("Failed to list routes: %s", traceback.format_exc())



# Middleware to log every incoming request (helps diagnose 404s/CORS)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        logger.info("incoming request: %s %s", request.method, request.url.path)
        # Log Origin header if present to help CORS debugging
        origin = request.headers.get("origin")
        if origin:
            logger.info("  Origin: %s", origin)
    except Exception:
        logger.debug("Failed to log incoming request: %s", traceback.format_exc())
    response = await call_next(request)
    return response

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
async def analyze_guilt_endpoint(request: Request, name: str = Form(None)):
    # Support both form-encoded and JSON payloads from the frontend.
    if not name:
        try:
            body = await request.json()
            name = body.get("name")
        except Exception:
            pass

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



@app.post("/analyze/")
async def analyze_guilt_endpoint_slash(request: Request, name: str = Form(None)):
    """Alias for /analyze to accept trailing-slash POSTs from clients."""
    # Support both form-encoded and JSON payloads from the frontend.
    if not name:
        try:
            body = await request.json()
            name = body.get("name")
        except Exception:
            pass

    interviews = load_interviews()
    interview = next((iv for iv in interviews if iv.get("name") == name), None)

    if not interview or not interview.get("transcript"):
        logger.error("analyze_guilt_slash: transcript not found for %s", name)
        raise HTTPException(status_code=404, detail="Transcript not found")

    try:
        guilt_level = analyze_guilt(interview["transcript"])
    except Exception as e:
        logger.error("analyze_guilt_slash: analyze_guilt failed for %s: %s", name, e)
        logger.debug(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    interview["guilt_level"] = guilt_level
    save_interviews(interviews)

    logger.info("analyze_guilt_slash: computed guilt=%s for %s", guilt_level, name)
    return {"name": name, "guilt_level": guilt_level}



@app.get("/ping")
def ping():
    """Simple health check endpoint."""
    return {"status": "ok"}

# =====================================================
# LIVE TRANSCRIPTION (WebSocket)
# =====================================================

# Constants for audio processing
SAMPLE_RATE = 16000
CHANNELS = 1
MIN_CHUNK_SIZE = 1.0  # seconds
BYTES_PER_SAMPLE = 2  # s16le = 2 bytes per sample
BYTES_PER_SEC = int(SAMPLE_RATE * MIN_CHUNK_SIZE * BYTES_PER_SAMPLE)


async def start_ffmpeg_decoder():
    """
    Start FFmpeg process to decode WebM audio to raw PCM.
    Returns the process object.
    """
    process = (
        ffmpeg.input("pipe:0", format="webm")
        .output(
            "pipe:1",
            format="s16le",
            acodec="pcm_s16le",
            ac=CHANNELS,
            ar=str(SAMPLE_RATE),
        )
        .run_async(pipe_stdin=True, pipe_stdout=True, pipe_stderr=True)
    )
    return process


@app.websocket("/live-transcribe")
async def live_transcribe_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for live audio transcription.
    Client sends WebM audio chunks, server returns real-time transcripts.
    """
    await websocket.accept()
    logger.info("WebSocket connection opened for live transcription")

    ffmpeg_process = None
    online = None
    
    try:
        # Start FFmpeg decoder
        ffmpeg_process = await start_ffmpeg_decoder()
        pcm_buffer = bytearray()
        
        # Load Whisper model and create online processor
        logger.info("Loading Whisper model for live transcription...")
        model = _load_model()
        online = OnlineASRProcessor(model, buffer_trimming_sec=15)
        logger.info("Whisper model loaded, ready for streaming")
        
        # Background task to read FFmpeg output and process transcription
        async def ffmpeg_stdout_reader():
            nonlocal pcm_buffer
            loop = asyncio.get_event_loop()
            full_transcription = ""
            last_time = time()
            
            while True:
                try:
                    # Calculate elapsed time for adaptive reading
                    elapsed = max(0.1, time() - last_time)
                    last_time = time()
                    
                    # Read from FFmpeg stdout
                    read_size = min(32000 * int(elapsed) + 4096, 64000)
                    chunk = await loop.run_in_executor(
                        None, ffmpeg_process.stdout.read, read_size
                    )
                    
                    if not chunk:
                        logger.info("FFmpeg stdout closed")
                        break
                    
                    pcm_buffer.extend(chunk)
                    
                    # Process when we have enough audio data
                    if len(pcm_buffer) >= BYTES_PER_SEC:
                        # Convert int16 PCM to float32 normalized audio
                        pcm_array = (
                            np.frombuffer(pcm_buffer, dtype=np.int16).astype(np.float32)
                            / 32768.0
                        )
                        pcm_buffer = bytearray()
                        
                        # Insert audio into online processor
                        online.insert_audio_chunk(pcm_array)
                        
                        # Process and get transcription
                        beg_ts, end_ts, transcript = online.process_iter()
                        
                        # Get uncommitted buffer (partial results)
                        buffer_result = online._to_flush(online.transcript_buffer.buffer)
                        buffer_text = buffer_result[2] if buffer_result else ""
                        
                        # Update full transcription
                        if transcript:
                            full_transcription += " " + transcript
                            full_transcription = full_transcription.strip()
                        
                        # Send response to client
                        response = {
                            "transcript": transcript if transcript else "",
                            "buffer": buffer_text,
                            "full_text": full_transcription,
                            "timestamp": {"start": beg_ts, "end": end_ts} if beg_ts else None
                        }
                        await websocket.send_json(response)
                        
                except Exception as e:
                    logger.error(f"Error in ffmpeg_stdout_reader: {e}")
                    logger.debug(traceback.format_exc())
                    break
            
            logger.info("FFmpeg reader task completed")
        
        # Start background reader task
        stdout_reader_task = asyncio.create_task(ffmpeg_stdout_reader())
        
        # Main loop: receive WebM chunks from client
        while True:
            message = await websocket.receive_bytes()
            # Feed to FFmpeg
            ffmpeg_process.stdin.write(message)
            ffmpeg_process.stdin.flush()
    
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected by client")
    except Exception as e:
        logger.error(f"Error in WebSocket endpoint: {e}")
        logger.debug(traceback.format_exc())
    finally:
        # Cleanup
        if ffmpeg_process:
            try:
                ffmpeg_process.stdin.close()
            except:
                pass
            try:
                ffmpeg_process.stdout.close()
            except:
                pass
            try:
                ffmpeg_process.wait(timeout=1)
            except:
                ffmpeg_process.kill()
        
        # Finish any remaining transcription
        if online:
            try:
                final = online.finish()
                if final and final[2]:
                    await websocket.send_json({
                        "transcript": final[2],
                        "buffer": "",
                        "full_text": final[2],
                        "timestamp": {"start": final[0], "end": final[1]},
                        "final": True
                    })
            except:
                pass
        
        logger.info("WebSocket connection closed and cleaned up")

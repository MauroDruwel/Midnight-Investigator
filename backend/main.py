
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.utils.interview_files import load_interviews, save_interviews
from backend.utils.transcript import save_audio_file, generate_transcript
from backend.utils.analyze import analyze_guilt, analyze_summary
from fastapi import Request
import os
import re


def _normalize_summary_result(summary_result):
    """Force summary into a stable shape:
    {"ranking": [{"name": str, "rank": number|None, "reason": str}], "summary": str}
    """
    base = {"ranking": [], "summary": ""}

    if summary_result is None:
        return base

    if isinstance(summary_result, str):
        return {"ranking": [], "summary": summary_result}

    if isinstance(summary_result, dict):
        ranking = summary_result.get("ranking")
        if not isinstance(ranking, list):
            ranking = []

        normalized_ranking = []
        for entry in ranking:
            if not isinstance(entry, dict):
                continue
            normalized_ranking.append({
                "name": entry.get("name") or "Unknown suspect",
                "rank": entry.get("rank"),
                "reason": entry.get("reason") or "No reason provided.",
            })

        summary_text = summary_result.get("summary")
        if not isinstance(summary_text, str):
            summary_text = ""

        return {"ranking": normalized_ranking, "summary": summary_text}

    if isinstance(summary_result, list):
        normalized_ranking = []
        summary_text = ""
        for entry in summary_result:
            if not isinstance(entry, dict):
                continue
            if isinstance(entry.get("summary"), str) and entry.get("summary"):
                summary_text = entry.get("summary")
                continue
            normalized_ranking.append({
                "name": entry.get("name") or "Unknown suspect",
                "rank": entry.get("rank"),
                "reason": entry.get("reason") or "No reason provided.",
            })
        return {"ranking": normalized_ranking, "summary": summary_text}

    return base

app = FastAPI()

# Allow frontend dev server to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/interviews")
def get_interviews():
    interviews = load_interviews()
    # interviews.json may contain non-interview entries (e.g. cached summary objects)
    # Keep the API contract stable by returning only actual interviews.
    if isinstance(interviews, list):
        return [iv for iv in interviews if isinstance(iv, dict) and iv.get("name")]
    return interviews

# DELETE endpoint to remove an interview and its audio file
@app.delete("/interview/{name}")
async def delete_interview(name: str):
    interviews = load_interviews()
    interview = next((iv for iv in interviews if iv.get("name") == name), None)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found.")
    # Remove audio file if exists
    mp3_path = interview.get("mp3_path")
    if mp3_path and os.path.exists(mp3_path):
        try:
            os.remove(mp3_path)
        except Exception as e:
            print(f"[ERROR] Failed to delete audio file: {e}")
    # Remove interview from list
    interviews = [iv for iv in interviews if iv.get("name") != name]
    try:
        save_interviews(interviews)
    except Exception as e:
        print(f"[ERROR] Failed to update interviews list: {e}")
        raise HTTPException(status_code=500, detail="Failed to update interviews list.")
    return {"message": f"Interview '{name}' deleted."}

# DELETE endpoint to remove all interviews and their audio files (reset)
@app.delete("/interviews/reset")
async def reset_interviews():
    interviews = load_interviews()
    # Remove all audio files
    for iv in interviews:
        mp3_path = iv.get("mp3_path")
        if mp3_path and os.path.exists(mp3_path):
            try:
                os.remove(mp3_path)
            except Exception as e:
                print(f"[ERROR] Failed to delete audio file: {e}")
    # Save empty interviews
    if isinstance(interviews, dict):
        interviews.clear()
    else:
        interviews = []
    save_interviews(interviews)
    return {"message": "All interviews and audio files deleted."}

@app.post("/interview")
async def add_interview(name: str = Form(...), file: UploadFile = File(...)):
    try:
        content = await file.read()
        if not content:
            return {"error": "Uploaded file is empty."}
        file_path, safe_filename = save_audio_file(name, content)
        print(f"[DEBUG] Saved file to: {file_path}")
    except Exception as e:
        print(f"[ERROR] Failed to save file: {e}")
        return {"error": "Failed to save file."}

    interviews = load_interviews()
    interviews = [iv for iv in interviews if iv.get("name") != name]
    transcript_text = None
    try:
        transcript_text = generate_transcript(file_path)
        print(transcript_text)
    except Exception as e:
        print(f"[ERROR] File upload or transcript failed: {e}")
        return {"error": "File upload or transcript failed."}

    interviews.append({
        "name": name,
        "mp3_path": file_path,
        "guilt_level": -1,
        "transcript": transcript_text
    })
    try:
        save_interviews(interviews)
    except Exception as e:
        print(f"[ERROR] Failed to save interviews.json: {e}")
        return {"error": "Failed to update interviews list."}
    return {"message": "Interview added or updated", "name": name, "mp3_path": safe_filename, "transcript": transcript_text}

# Analyze endpoint using Hack Club AI
@app.post("/analyze")
async def analyze_guilt_endpoint(name: str = Form(...)):
    interviews = load_interviews()
    interview = next((iv for iv in interviews if iv.get("name") == name), None)
    if not interview:
        return {"error": "Interview not found."}
    transcript = interview.get("transcript")
    if not transcript:
        return {"error": "No transcript available for this interview."}
    try:
        guilt_level = analyze_guilt(transcript)
        interview["guilt_level"] = guilt_level
        save_interviews(interviews)
        return {"name": name, "guilt_level": guilt_level}
    except Exception as e:
        print(f"[ERROR] Hack Club AI analyze failed: {e}")
        return {"error": "Guilt analysis failed."}

# New endpoint: Summarize all interviews and rank suspects
@app.get("/summary")
async def summary_endpoint():
    interviews = load_interviews()
    valid_interviews = [iv for iv in interviews if iv.get("transcript")]
    if not valid_interviews:
        return {"error": "No transcripts available for summary."}

    # Check if a summary is already stored and up-to-date
    summary_data = None
    # Store summary at the top-level of interviews.json as '_summary' (not in the list)
    if isinstance(interviews, dict) and "_summary" in interviews:
        summary_data = interviews["_summary"]
    elif isinstance(interviews, list):
        # Find any existing _summary in the list, regardless of position
        for iv in reversed(interviews):
            if isinstance(iv, dict) and "_summary" in iv:
                summary_data = iv["_summary"]
                break

    # Compute a hash of all transcripts to detect changes
    import hashlib, json as _json
    transcripts_concat = "".join(iv["transcript"] for iv in valid_interviews)
    transcripts_hash = hashlib.sha256(transcripts_concat.encode("utf-8")).hexdigest()

    # If summary exists and hash matches, return it
    if summary_data and summary_data.get("hash") == transcripts_hash:
        cached_result = summary_data.get("result")
        normalized_cached = _normalize_summary_result(cached_result)

        # Opportunistically rewrite cache into the normalized shape.
        try:
            if normalized_cached != cached_result:
                if isinstance(interviews, dict) and "_summary" in interviews:
                    interviews["_summary"]["result"] = normalized_cached
                    save_interviews(interviews)
                elif isinstance(interviews, list):
                    for iv in reversed(interviews):
                        if isinstance(iv, dict) and "_summary" in iv and isinstance(iv["_summary"], dict):
                            iv["_summary"]["result"] = normalized_cached
                            save_interviews(interviews)
                            break
        except Exception as e:
            print(f"[WARN] Failed to normalize cached summary: {e}")

        return {"summary": normalized_cached}

    # Otherwise, generate a new summary
    summary_prompt = "Transcripts:"
    for iv in valid_interviews:
        summary_prompt += f"\nName: {iv['name']}\nTranscript: {iv['transcript']}\n"
    try:
        summary_result = analyze_summary(summary_prompt)
        normalized = _normalize_summary_result(summary_result)
        # Store the summary and hash in interviews.json
        # If interviews is a dict, store at top-level; if list, store as last element
        if isinstance(interviews, dict):
            interviews["_summary"] = {"hash": transcripts_hash, "result": normalized}
            save_interviews(interviews)
        elif isinstance(interviews, list):
            # Remove any existing _summary entries so only one exists
            interviews = [iv for iv in interviews if not (isinstance(iv, dict) and "_summary" in iv)]
            interviews.append({"_summary": {"hash": transcripts_hash, "result": normalized}})
            save_interviews(interviews)
        return {"summary": normalized}
    except Exception as e:
        print(f"[ERROR] Summary analysis failed: {e}")
        return {"error": "Summary analysis failed."}

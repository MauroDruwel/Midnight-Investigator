import os
import re
_model = None


def _load_model():
    """Lazy-load the Whisper model. Raises a RuntimeError with actionable
    instructions if the `whisper` package or `ffmpeg` are not available.
    """
    global _model
    if _model is not None:
        return _model

    try:
        import whisper
    except Exception as e:  # ImportError or other
        raise RuntimeError(
            "Missing Python package 'whisper'. Install with: `pip install openai-whisper`\n"\
            "Also ensure `ffmpeg` is installed on your system (e.g. `brew install ffmpeg`)"
        ) from e

    model_name = os.getenv("WHISPER_MODEL", "small")
    try:
        _model = whisper.load_model(model_name)
    except Exception as e:
        raise RuntimeError(f"Failed to load whisper model '{model_name}': {e}") from e

    return _model

def save_audio_file(name, file_bytes):
    base_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip())
    safe_filename = f"{base_name}.mp3"
    save_dir = "backend/audio"
    os.makedirs(save_dir, exist_ok=True)

    file_path = os.path.join(save_dir, safe_filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return file_path, safe_filename

def generate_transcript(file_path: str) -> str:
    """
    Transcribe an audio file using Whisper (local, free).
    """
    model = _load_model()
    result = model.transcribe(file_path)
    return result.get("text", "")

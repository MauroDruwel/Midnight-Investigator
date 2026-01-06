import os
import re
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client()

def save_audio_file(name, file):
    base_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.strip())
    safe_filename = f"{base_name}.mp3"
    save_dir = "backend/audio"
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, safe_filename)
    content = file
    with open(file_path, "wb") as f:
        f.write(content)
    return file_path, safe_filename

def generate_transcript(file_path):
    mp3File = client.files.upload(file=file_path)
    transcript = client.models.generate_content(model='gemini-2.5-flash', contents=["Generate a transcript of the speech.", mp3File])
    return transcript.text

import os
import json

DATA_FILE = "backend/interviews.json"

def load_interviews():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r") as f:
        try:
            content = f.read().strip()
            if not content:
                return []
            return json.loads(content)
        except (json.JSONDecodeError, Exception):
            return []

def save_interviews(interviews):
    with open(DATA_FILE, "w") as f:
        json.dump(interviews, f)

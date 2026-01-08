import hashlib
import json
import os
import logging

logger = logging.getLogger(__name__)

CACHE_FILE = "backend/summary_cache.json"

def get_data_hash(data: str) -> str:
    """Returns a SHA-256 hash of the input string."""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()

def get_cached_summary(data_hash: str):
    """Retrieves the cached summary if the hash matches."""
    if not os.path.exists(CACHE_FILE):
        return None
    
    try:
        with open(CACHE_FILE, "r") as f:
            cache = json.load(f)
            if cache.get("hash") == data_hash:
                logger.info("Cache hit for hash: %s", data_hash)
                return cache.get("summary")
    except Exception as e:
        logger.error("Failed to read cache: %s", e)
    
    return None

def save_cached_summary(data_hash: str, summary: dict):
    """Saves the summary and its hash to the cache file."""
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump({
                "hash": data_hash,
                "summary": summary
            }, f)
        logger.info("Saved summary to cache with hash: %s", data_hash)
    except Exception as e:
        logger.error("Failed to save cache: %s", e)

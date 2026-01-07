"""
Online ASR processor for live streaming transcription with Whisper.
Adapted from whisper_streaming project.
"""
import sys
import numpy as np
import logging

logger = logging.getLogger(__name__)


class HypothesisBuffer:
    """Buffer for managing streaming hypothesis with longest common prefix."""
    
    def __init__(self, logfile=sys.stderr):
        self.commited_in_buffer = []
        self.buffer = []
        self.new = []
        self.last_commited_time = 0
        self.last_commited_word = None
        self.logfile = logfile

    def insert(self, new, offset):
        # Compare the last committed word with the new hypothesis
        # This stabilizes partial outputs
        new = [(a + offset, b + offset, t) for a, b, t in new]
        self.new = new

    def flush(self):
        # Returns committed chunk = the longest common prefix of 2 last inserts
        commit = []
        while self.new:
            na, nb, nt = self.new[0]

            if len(self.buffer) == 0:
                break

            if nt == self.buffer[0][2]:
                commit.append((na, nb, nt))
                self.last_commited_word = nt
                self.last_commited_time = nb
                self.buffer.pop(0)
                self.new.pop(0)
            else:
                break
        self.buffer = self.new
        self.new = []
        self.commited_in_buffer.extend(commit)
        return commit

    def pop_commited(self, time):
        while self.commited_in_buffer and self.commited_in_buffer[0][1] <= time:
            self.commited_in_buffer.pop(0)

    def complete(self):
        return self.buffer


class OnlineASRProcessor:
    """Processes audio in streaming fashion for live transcription."""
    
    SAMPLING_RATE = 16000

    def __init__(self, asr, buffer_trimming_sec=15, logfile=sys.stderr):
        """
        asr: ASR model object with transcribe() method
        buffer_trimming_sec: seconds - trim buffer if longer than this
        logfile: where to log
        """
        self.asr = asr
        self.logfile = logfile
        self.buffer_trimming_sec = buffer_trimming_sec
        self.init()

    def init(self, offset=None):
        """Run this when starting or restarting processing"""
        self.audio_buffer = np.array([], dtype=np.float32)
        self.transcript_buffer = HypothesisBuffer(logfile=self.logfile)
        self.buffer_time_offset = 0
        if offset is not None:
            self.buffer_time_offset = offset
        self.transcript_buffer.last_commited_time = self.buffer_time_offset
        self.commited = []

    def insert_audio_chunk(self, audio):
        """Add new audio chunk to buffer"""
        self.audio_buffer = np.append(self.audio_buffer, audio)

    def process_iter(self):
        """
        Process current audio buffer.
        Returns: tuple (beg_timestamp, end_timestamp, "text"), or (None, None, "").
        The non-empty text is confirmed (committed) partial transcript.
        """
        if len(self.audio_buffer) == 0:
            return (None, None, "")

        # Get last committed text as prompt for better continuity
        prompt = self._get_prompt()
        
        logger.debug(
            f"Transcribing {len(self.audio_buffer)/self.SAMPLING_RATE:2.2f} seconds from {self.buffer_time_offset:2.2f}"
        )
        
        # Transcribe current buffer
        result = self.asr.transcribe(self.audio_buffer)
        
        # Extract timestamped words
        tsw = self._extract_words(result)
        
        # Update hypothesis buffer
        self.transcript_buffer.insert(tsw, self.buffer_time_offset)
        o = self.transcript_buffer.flush()
        self.commited.extend(o)
        completed = self._to_flush(o)
        
        logger.debug(f"COMPLETE NOW: {completed[2]}")
        
        # Trim buffer if too long
        if len(self.audio_buffer) / self.SAMPLING_RATE > self.buffer_trimming_sec:
            self._trim_buffer()
        
        return self._to_flush(o)

    def finish(self):
        """Flush incomplete text when processing ends"""
        o = self.transcript_buffer.complete()
        f = self._to_flush(o)
        logger.debug(f"Final noncommitted: {f}")
        return f

    def _get_prompt(self):
        """Get last 200 chars of committed text as prompt"""
        if not self.commited:
            return ""
        
        # Get text from committed words
        k = len(self.commited) - 1
        while k > 0 and self.commited[k][0] > self.buffer_time_offset:
            k -= 1
        
        # Collect recent committed text
        p = " ".join(w[2] for w in self.commited[max(0, k-10):k+1])
        if len(p) > 200:
            p = p[-200:]
        return p

    def _extract_words(self, result):
        """Extract timestamped words from transcription result"""
        words = []
        text = result.get("text", "")
        
        if not text:
            return words
        
        # For simple implementation, create single segment
        # In production, use word-level timestamps if available
        segments = result.get("segments", [])
        if segments:
            for segment in segments:
                # Skip low confidence segments
                if segment.get("no_speech_prob", 0) > 0.9:
                    continue
                
                # Extract words with timestamps if available
                seg_words = segment.get("words", [])
                if seg_words:
                    for word in seg_words:
                        words.append((word["start"], word["end"], word["word"]))
                else:
                    # Fallback: use segment-level timestamps
                    words.append((segment["start"], segment["end"], segment["text"]))
        else:
            # No segments - use full text with estimated time
            duration = len(self.audio_buffer) / self.SAMPLING_RATE
            words.append((0, duration, text))
        
        return words

    def _trim_buffer(self):
        """Trim audio buffer and update offset"""
        if not self.commited:
            return
        
        # Find a good point to trim
        # Keep last few seconds
        keep_duration = 5.0  # Keep last 5 seconds
        trim_time = len(self.audio_buffer) / self.SAMPLING_RATE - keep_duration
        
        if trim_time > 0:
            cut_samples = int(trim_time * self.SAMPLING_RATE)
            self.audio_buffer = self.audio_buffer[cut_samples:]
            self.buffer_time_offset += trim_time
            self.transcript_buffer.pop_commited(self.buffer_time_offset)
            logger.debug(f"Trimmed buffer at {trim_time:.2f}s")

    def _to_flush(self, sents):
        """
        Concatenate timestamped words into one sequence.
        sents: [(beg1, end1, "word1"), ...] or [] if empty
        return: (beg1, end-of-last, "concatenation") or (None, None, "") if empty
        """
        if len(sents) == 0:
            return (None, None, "")
        
        # Join words with space
        text = " ".join(s[2] for s in sents)
        beg = sents[0][0]
        end = sents[-1][1]
        
        return (beg, end, text)

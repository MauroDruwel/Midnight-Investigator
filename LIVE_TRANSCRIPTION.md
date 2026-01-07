# Live Transcription Feature

This implementation adds real-time, streaming audio transcription to your Midnight Investigator project using Whisper and WebSockets.

## 🎯 What Changed

### New Files
1. **`backend/utils/online_asr.py`** - Online ASR processor for streaming transcription
2. **`backend/test_live_transcription.html`** - Test page for live transcription

### Modified Files
1. **`backend/main.py`** - Added WebSocket endpoint `/live-transcribe`
2. **`backend/requirements.txt`** - Added dependencies: `ffmpeg-python`, `websockets`, `soundfile`, `librosa`

## 🚀 How It Works

### Architecture
```
Browser (Microphone) → WebSocket → FFmpeg (WebM → PCM) → Whisper (Streaming) → Live Transcript
```

1. **Frontend**: Browser captures audio using MediaRecorder API and sends WebM chunks via WebSocket
2. **FFmpeg**: Decodes WebM audio chunks to raw PCM in real-time
3. **Online ASR Processor**: Manages audio buffer and processes chunks incrementally
4. **Whisper**: Transcribes audio with word-level timestamps
5. **Results**: Server sends back confirmed text + partial buffer updates

### Key Features
- ✅ **Real-time streaming** - No need to wait for entire recording
- ✅ **Progressive transcription** - Shows confirmed text + partial results
- ✅ **Buffer management** - Automatically trims old audio to prevent memory issues
- ✅ **Adaptive chunking** - Processes audio in configurable chunk sizes
- ✅ **Word-level timestamps** - Tracks timing information for each word

## 📋 Requirements

### System Requirements
- **FFmpeg** must be installed on your system
  ```bash
  # Ubuntu/Debian
  sudo apt-get install ffmpeg
  
  # macOS
  brew install ffmpeg
  
  # Check installation
  ffmpeg -version
  ```

### Python Dependencies
Already added to `requirements.txt`:
- `ffmpeg-python` - Python FFmpeg wrapper
- `websockets` - WebSocket support
- `soundfile` - Audio file reading
- `librosa` - Audio processing
- `openai-whisper` - Speech recognition model

## 🧪 Testing

### 1. Start the Backend Server
```bash
cd backend
source ../.venv/bin/activate  # or your venv path
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Open the Test Page
Open `backend/test_live_transcription.html` in your browser or navigate to it via a simple HTTP server:

```bash
# Option 1: Direct file
# Just double-click test_live_transcription.html

# Option 2: Python HTTP server
cd backend
python -m http.server 8080
# Then open http://localhost:8080/test_live_transcription.html
```

### 3. Test Live Transcription
1. Click the microphone button
2. Allow microphone access when prompted
3. Speak clearly into your microphone
4. Watch the transcription appear in real-time!

## 🔧 Integration with Your App

To integrate this into your frontend, use the WebSocket endpoint:

### JavaScript Example
```javascript
const ws = new WebSocket('ws://localhost:8000/live-transcribe');

// When connected
ws.onopen = () => {
  // Start recording
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  
  recorder.ondataavailable = (e) => {
    ws.send(e.data);  // Send audio chunks
  };
  
  recorder.start(1000);  // 1 second chunks
};

// Receive transcriptions
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  console.log('Confirmed:', data.transcript);
  console.log('Partial:', data.buffer);
  console.log('Full text:', data.full_text);
};
```

### Response Format
```json
{
  "transcript": "newly confirmed text",
  "buffer": "partial unconfirmed text",
  "full_text": "complete transcript so far",
  "timestamp": {
    "start": 0.5,
    "end": 2.3
  },
  "final": false
}
```

## ⚙️ Configuration

### Chunk Size
Adjust in the frontend (milliseconds):
- **500ms**: Very responsive, more network traffic
- **1000ms**: Balanced (default)
- **2000ms**: Less frequent updates, lower bandwidth

### Model Settings
Change Whisper model in `backend/utils/transcript.py`:
```python
# Current: "small" model
# Options: tiny, base, small, medium, large
model_name = os.getenv("WHISPER_MODEL", "small")
```

### Buffer Trimming
In `backend/utils/online_asr.py`:
```python
# Default: 15 seconds
online = OnlineASRProcessor(model, buffer_trimming_sec=15)
```

## 🎨 Frontend Integration Ideas

### Option 1: Add to Interview Modal
Add a "Live Record" button in your `AddInterviewModal.tsx`:
```typescript
const startLiveRecording = () => {
  const ws = new WebSocket('ws://localhost:8000/live-transcribe');
  // ... implementation
};
```

### Option 2: Dedicated Live Interview Page
Create a new page for live interviews with real-time feedback

### Option 3: Replace File Upload
Instead of uploading files, record directly in the browser

## 📊 Performance Tips

1. **Model Size**: Start with `small` model for faster processing
2. **Chunk Duration**: 1-2 seconds works best for most cases
3. **Buffer Management**: Keep buffer trimming at 15-20 seconds
4. **Network**: WebSocket is more efficient than HTTP for streaming

## 🐛 Troubleshooting

### "FFmpeg not found"
Install FFmpeg on your system (see Requirements section)

### "WebSocket connection failed"
- Check backend server is running
- Verify WebSocket URL matches your server
- Check CORS settings if different domain

### "No audio detected"
- Grant microphone permissions in browser
- Check browser console for errors
- Verify MediaRecorder API support

### "Slow transcription"
- Use smaller Whisper model (e.g., `tiny` or `base`)
- Increase chunk size to 2000ms
- Reduce buffer trimming window

## 🔍 How It Differs from Original

### Similarities with Reference Project
- Uses WebSocket for real-time communication
- FFmpeg for audio decoding
- Online ASR processor pattern
- Buffer management for streaming

### Differences
- **Simpler implementation**: Removed VAC/VAD for easier setup
- **Integrated**: Works with existing Whisper setup
- **Tailored**: Designed for interview recording use case
- **No diarization**: Focused on single speaker (can be added later)

## 📚 Next Steps

### Potential Enhancements
1. **Save Live Recordings**: Store transcripts from live sessions
2. **Speaker Diarization**: Identify multiple speakers
3. **VAD (Voice Activity Detection)**: Skip silence automatically
4. **Live Analysis**: Real-time guilt detection during interview
5. **Export Options**: Download transcript while recording
6. **Playback Sync**: Show transcript synced with audio playback

### Integration with Your App
1. Add live recording button to frontend
2. Create dedicated live interview component
3. Store live transcripts in database
4. Add live analysis feedback
5. Visual indicators for speech activity

## 🙏 Credits

This implementation is inspired by and adapted from:
- [whisper_streaming_web](https://github.com/ScienceIO/whisper_streaming_web) by ScienceIO
- [whisper_streaming](https://github.com/ufal/whisper_streaming) - Original streaming implementation
- OpenAI Whisper - Speech recognition model

## 📝 License

Same as your project's license.

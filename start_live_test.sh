#!/bin/bash

# Live Transcription Test Script
# Starts the backend server and opens the test page

echo "🎙️  Starting Midnight Investigator Live Transcription Test"
echo "=========================================================="
echo ""

# Check if in correct directory
if [ ! -f "backend/main.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if venv exists
if [ ! -d ".venv" ]; then
    echo "❌ Error: Virtual environment not found. Please create .venv first"
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/bin/activate

# Check FFmpeg
echo "🔍 Checking FFmpeg installation..."
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: FFmpeg not found. Please install it:"
    echo "   Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "   macOS: brew install ffmpeg"
    exit 1
fi
echo "✅ FFmpeg found: $(ffmpeg -version | head -n 1)"

# Install dependencies if needed
echo "📦 Checking Python dependencies..."
pip install -q ffmpeg-python websockets soundfile librosa 2>/dev/null
echo "✅ Dependencies ready"

echo ""
echo "🚀 Starting backend server..."
echo "   URL: http://localhost:8000"
echo "   WebSocket: ws://localhost:8000/live-transcribe"
echo ""
echo "📝 Test page will be available at:"
echo "   file://$(pwd)/backend/test_live_transcription.html"
echo ""
echo "💡 Instructions:"
echo "   1. Wait for server to start"
echo "   2. Open backend/test_live_transcription.html in your browser"
echo "   3. Click the microphone button and allow microphone access"
echo "   4. Start speaking!"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=========================================================="
echo ""

# Start the server
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

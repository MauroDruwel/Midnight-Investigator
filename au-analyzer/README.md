# Facial Action Unit Analyzer

A **browser-only** facial movement detection demo that runs entirely client-side using JavaScript and MediaPipe Face Mesh.

## ⚠️ Important Disclaimer

This tool detects **facial muscle movements only**. It does **NOT**:
- Infer emotions, feelings, or mental states
- Detect lying, deception, or truthfulness
- Assess intent, guilt, or any psychological state

All output values are **probabilistic indicators** based purely on geometric measurements of facial landmarks.

---

## 🎯 Features

- **Real-time detection** of facial Action Units (AUs)
- **100% client-side** — no video stored or transmitted
- **MediaPipe Face Mesh** for accurate 468-point landmark detection
- Smooth, modern dark-theme UI
- Toggle landmark visualization
- Optional value smoothing (moving average)

## 📊 Detected Action Units

| AU Code | Name | Description |
|---------|------|-------------|
| AU12 | Lip Corner Puller | Possible smile indicator |
| AU26 | Jaw Drop | Mouth opening indicator |
| AU1 | Inner Brow Raise | Eyebrow elevation indicator |
| AU4 | Brow Lowerer | Frown indicator |
| AU45 | Eye Blink | Eyelid closure indicator |

---

## 🚀 Quick Start

### Option 1: Open directly
Simply open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).

```bash
open index.html
```

### Option 2: Local server (recommended)
For best results, serve via a local HTTP server:

```bash
# Using Python 3
python3 -m http.server 8080

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8080
```

Then navigate to `http://localhost:8080`

---

## 🔧 Technical Details

### Requirements
- Modern browser with WebRTC support
- Webcam access
- Internet connection (for MediaPipe CDN assets)

### Dependencies (loaded via CDN)
- `@mediapipe/face_mesh` — Facial landmark detection
- `@mediapipe/camera_utils` — Camera frame handling

### How It Works

1. **Webcam Access**: Uses `navigator.mediaDevices.getUserMedia()` to access the camera
2. **Landmark Detection**: MediaPipe Face Mesh extracts 468 facial landmarks per frame
3. **Geometric Measurement**: Computes distances between key landmark pairs
4. **AU Calculation**: Maps measurements to Action Unit activations using thresholds
5. **Visualization**: Displays results with optional landmark overlay

### AU Detection Logic

Action Units are computed using normalized geometric ratios:

```
AU12 (Smile) = mouthWidth / faceWidth > threshold
AU26 (Jaw)   = mouthOpenHeight / faceWidth > threshold
AU1 (Brow)   = browHeight / faceWidth > threshold
AU4 (Frown)  = 1 - (browDistance / faceWidth) > threshold
AU45 (Blink) = 1 - (eyeAspectRatio) > threshold
```

---

## 🔒 Privacy & Security

- **No backend** — all processing happens in your browser
- **No storage** — video frames are never saved
- **No transmission** — no data leaves your device
- Camera access requires explicit user permission

---

## 📝 Framing Guidelines

When discussing output from this tool:

✅ **Do say:**
- "Facial movement detected"
- "Muscle activation observed"
- "Possible indicator"
- "Probabilistic signal"

❌ **Never say:**
- "Emotion detected"
- "Lying indicator"
- "Truth detection"
- "Intent analysis"
- "Mental state"

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🔬 References

- [Facial Action Coding System (FACS)](https://en.wikipedia.org/wiki/Facial_Action_Coding_System)
- [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh.html)
- [Face Mesh Landmark Indices](https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png)

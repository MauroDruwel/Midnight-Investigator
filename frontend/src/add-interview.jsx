import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './components/terminal.css';
import { pickCrownColorForGuilt, setLedCrownColor, setLedCrownWhite } from './lib/ledCrown';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export default function AddInterview() {
  const navigate = useNavigate();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const analyserDataRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording | recorded
  const [status, setStatus] = useState('ready');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [analysisState, setAnalysisState] = useState('idle'); // idle | running | success | error

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close?.();
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      analyserDataRef.current = null;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const stopVisualizer = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close?.();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    analyserDataRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startVisualizer = (stream) => {
    // No-op if unsupported
    const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextImpl) return;

    stopVisualizer();

    const audioCtx = new AudioContextImpl();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    analyserDataRef.current = data;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvasToDisplaySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return { width, height, dpr };
    };

    const draw = () => {
      const currentAnalyser = analyserRef.current;
      const currentData = analyserDataRef.current;
      if (!currentAnalyser || !currentData) return;

      const { width, height } = resizeCanvasToDisplaySize();

      currentAnalyser.getByteFrequencyData(currentData);

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = 'rgba(255, 243, 214, 0.06)';
      ctx.fillRect(0, 0, width, height);

      const bars = 28;
      const gap = Math.max(2, Math.floor(width * 0.006));
      const barWidth = Math.max(2, Math.floor((width - gap * (bars - 1)) / bars));
      const maxBarHeight = Math.floor(height * 0.82);

      // Map frequency bins -> bars by averaging slices
      const bins = currentData.length;
      const slice = Math.max(1, Math.floor(bins / bars));

      for (let i = 0; i < bars; i++) {
        const start = i * slice;
        const end = Math.min(bins, start + slice);

        let sum = 0;
        for (let j = start; j < end; j++) sum += currentData[j];
        const avg = sum / Math.max(1, end - start);
        const normalized = Math.min(1, avg / 255);

        // Slight emphasis for speech band without overthinking it
        const shaped = Math.pow(normalized, 1.6);
        const barHeight = Math.max(3, Math.floor(shaped * maxBarHeight));

        const x = i * (barWidth + gap);
        const y = height - barHeight;

        // Purple bars with cream highlight
        ctx.fillStyle = 'rgba(255, 243, 214, 0.22)';
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = 'rgba(255, 243, 214, 0.52)';
        ctx.fillRect(x, y, barWidth, Math.max(2, Math.floor(barHeight * 0.18)));
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
  };

  const safeFileName = useMemo(() => {
    if (!name.trim()) return 'recording.webm';
    return `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'recording'}.webm`;
  }, [name]);

  const startRecording = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      startVisualizer(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setFile(new File([blob], safeFileName, { type: 'audio/webm' }));
        setAudioUrl(url);
        setRecordingState('recorded');
        stream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        stopVisualizer();
      };

      mediaRecorder.start();
      setRecordingState('recording');
      setStatus('recording...');
    } catch (err) {
      setError('Microphone permission denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('recorded');
      setStatus('recorded');
    }
  };

  const onFilePick = (evt) => {
    setError('');
    const picked = evt.target.files?.[0];
    if (!picked) return;
    stopVisualizer();
    setFile(picked);
    setAudioUrl(URL.createObjectURL(picked));
    setRecordingState('recorded');
    setStatus('file ready');
  };

  const done = () => {
    navigate('/add-interview');
  };

  const submit = async () => {
    setError('');
    setAnalysisState('idle');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!file) {
      setError('Attach or record an audio file first.');
      return;
    }

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('file', file);

    setIsSaving(true);
    setStatus('uploading...');
    try {
      const res = await fetch(`${API_BASE}/interview`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to save interview');
      }
      setTranscript(data.transcript || '');

      // Immediately trigger guilt analysis in the background
      setStatus('analyzing...');
      setLedCrownWhite();
      setAnalysisState('running');
      try {
        const analyzeForm = new FormData();
        analyzeForm.append('name', name.trim());
        const analyzeRes = await fetch(`${API_BASE}/analyze`, {
          method: 'POST',
          body: analyzeForm,
        });
        const analyzeData = await analyzeRes.json();
        if (!analyzeRes.ok || analyzeData.error) {
          throw new Error(analyzeData.error || 'Analysis failed');
        }

        const color = pickCrownColorForGuilt(analyzeData.guilt_level, { redAtOrAbove: 60 });
        setLedCrownColor(color);
        setStatus('saved & analyzed');
        setAnalysisState('success');
      } catch (anErr) {
        // Keep the save success but surface analysis issue
        setLedCrownWhite();
        setStatus('saved (analysis failed)');
        setAnalysisState('error');
        setError(anErr.message || 'Analysis failed');
      }
    } catch (err) {
      setLedCrownWhite();
      setError(err.message || 'Failed to save interview');
      setStatus('ready');
      setTranscript('');
      setAnalysisState('idle');
    } finally {
      setIsSaving(false);
    }
  };

  const canFinish = !isSaving && (analysisState === 'success' || analysisState === 'error');

  return (
    <div className="terminal-page">
      <div className="noise-layer" aria-hidden="true"></div>
      <div className="panel" style={{ width: 'min(960px, 92vw)', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <p className="title" style={{ marginBottom: '4px' }}>add interview</p>
            <p className="log-line log-info" style={{ margin: 0, opacity: 0.9 }}>
              Same name will overwrite the existing interview.
            </p>
          </div>
          <div className="pill right-pill" style={{ position: 'relative', right: 0, bottom: 0 }}>
            <span className="pill-dot" style={{ background: recordingState === 'recording' ? '#ff6b6b' : '#2d2540' }}></span>
            <span className="pill-text">{status}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px' }}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <label style={{ color: '#ffe4b5', fontWeight: 600, fontSize: '14px' }}>Interview name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. suspect #12"
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '2px solid #ffe4b5',
                background: '#2d2540',
                color: '#fff3d6',
                fontSize: '16px',
                fontFamily: 'Space Grotesk, sans-serif'
              }}
            />

            <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
              <p className="log-line log-info" style={{ margin: 0 }}>Attach an audio file or record here.</p>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  border: '2px dashed #ffe4b5',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  color: '#ffe4b5'
                }}
              >
                <input type="file" accept="audio/*" style={{ display: 'none' }} onChange={onFilePick} />
                <span style={{ fontWeight: 700 }}>upload</span>
                <span className="log-line log-muted" style={{ fontSize: '13px' }}>{file ? file.name : 'audio or mp3/webm'}</span>
              </label>
            </div>
          </div>

          <div style={{
            border: '2px solid #ffe4b5',
            borderRadius: '12px',
            padding: '16px',
            background: '#2d2540',
            display: 'grid',
            gap: '12px'
          }}>
            <p className="log-line log-info" style={{ margin: 0 }}>Recorder</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={startRecording}
                disabled={recordingState === 'recording'}
                className="nav-item"
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '2px solid #ff6b6b',
                  background: '#3a2f52',
                  color: '#ff6b6b',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                start
              </button>
              <button
                onClick={stopRecording}
                disabled={recordingState !== 'recording'}
                className="nav-item"
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '2px solid #ffe4b5',
                  background: '#2d2540',
                  color: '#ffe4b5',
                  fontWeight: 700,
                  cursor: recordingState === 'recording' ? 'pointer' : 'not-allowed'
                }}
              >
                stop
              </button>
            </div>

            <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
              <p className="log-line log-info" style={{ margin: 0, opacity: recordingState === 'recording' ? 1 : 0.65 }}>
                live volume
              </p>
              <div
                style={{
                  borderRadius: '10px',
                  border: '2px solid rgba(255, 228, 181, 0.55)',
                  background: '#3a2f52',
                  padding: '8px',
                  opacity: recordingState === 'recording' ? 1 : 0.75,
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{ width: '100%', height: '64px', display: 'block' }}
                  aria-label="Microphone volume visualizer"
                  role="img"
                />
              </div>
            </div>

            {audioUrl && (
              <div style={{ display: 'grid', gap: '6px' }}>
                <p className="log-line log-info" style={{ margin: 0 }}>Preview</p>
                <audio controls src={audioUrl} style={{ width: '100%' }} />
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="log-line log-error" style={{ marginTop: '8px' }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={done}
            className="mam-action-btn"
            style={{ marginRight: 'auto' }}
            disabled={!canFinish}
            aria-disabled={!canFinish}
            title={!canFinish ? 'Finish is available after analysis completes' : 'Done'}
          >
            <span className="mam-action-btn__arrow" aria-hidden="true">✓</span>
            <span className="mam-action-btn__label">done</span>
          </button>
          <button
            onClick={submit}
            disabled={isSaving}
            style={{
              padding: '14px 18px',
              borderRadius: '12px',
              border: '3px solid #ff6b6b',
              background: '#2d2540',
              color: '#ff6b6b',
              fontWeight: 700,
              cursor: isSaving ? 'wait' : 'pointer',
              minWidth: '160px'
            }}
          >
            {isSaving ? 'saving...' : 'save interview'}
          </button>
        </div>

        {transcript && (
          <div style={{ marginTop: '16px' }}>
            <p className="log-line log-info" style={{ margin: 0 }}>Transcript</p>
            <div
              style={{
                marginTop: '8px',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '2px solid #ffe4b5',
                background: '#2d2540',
                color: '#fff3d6',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {transcript}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
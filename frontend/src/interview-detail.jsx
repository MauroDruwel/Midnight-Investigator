import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import './components/terminal.css';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const toHandle = name => (name || 'interview').toLowerCase().replace(/\s+/g, '_');

const guiltLabel = value => {
  if (value == null || value === -1) return 'Unknown';
  return value;
};

export default function InterviewDetail() {
  const { handle } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [working, setWorking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/interviews`);
        if (!res.ok) throw new Error('Failed to load interviews');
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Unexpected response shape');
        const match = data.find(iv => toHandle(iv.name) === handle);
        if (!cancelled) {
          setInterview(match || null);
          setError(match ? null : 'Interview not found');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load interview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const transcript = useMemo(() => interview?.transcript || 'No transcript available yet.', [interview]);

  const handleDelete = async () => {
    if (!interview?.name) return;
    const proceed = window.confirm('Delete this interview?');
    if (!proceed) return;
    setWorking(true);
    setActionMessage('');
    try {
      const res = await fetch(`${API_BASE}/interview/${encodeURIComponent(interview.name)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete interview');
      setActionMessage('Interview deleted.');
      setTimeout(() => navigate('/interviews'), 400);
    } catch (err) {
      setError(err.message || 'Failed to delete interview');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="terminal-page">
      <div className="noise-layer" aria-hidden="true" />
      <div className="panel detail-panel">
        <header className="detail-head">
          <p className="eyebrow">case file</p>
          <h1>{interview?.name || 'Interview'}</h1>
          <p className="lede">Guilt level: {guiltLabel(interview?.guilt_level)}</p>
        </header>

        <div className="detail-body">
          {loading && <div className="interviews-placeholder">Loading interview…</div>}
          {!loading && error && <div className="interviews-placeholder">{error}</div>}
          {!loading && !error && (
            <article className="transcript-card">
              <h2>Transcript</h2>
              <p className="transcript-text">{transcript}</p>
            </article>
          )}
          {actionMessage && <div className="interviews-placeholder">{actionMessage}</div>}
        </div>

        <div className="detail-actions">
          <Link className="pill-link" to="/interviews">← Back to interviews</Link>
          <button className="pill-link danger" type="button" onClick={handleDelete} disabled={working || !interview}>
            Delete interview
          </button>
        </div>
      </div>
    </div>
  );
}

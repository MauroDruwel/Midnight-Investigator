import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playSound } from '../lib/sound';
import './terminal.css';

const NAV_ITEMS = ['add interview', 'view interviews', 'interview summaries'];
const NAV_ROUTES = ['/add-interview', '/interviews', '/summaries'];
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export default function Terminal() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([
    { type: 'system', text: 'murder-at-midnight // minimal shell' },
    { type: 'system', text: 'type "help" below or use arrow keys' },
    { type: 'system', text: '' }
  ]);
  const [selectedNav, setSelectedNav] = useState(0);
  const [resetWorking, setResetWorking] = useState(false);
  const [resetStatus, setResetStatus] = useState('');

  const logRef = useRef(null);

  const arrowSoundRef = useRef(null);
  const clickSoundRef = useRef(null);

  const addToHistory = (entries) =>
    setHistory((prev) => [...prev, ...entries]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [history]);

  const playSound = (audioRef) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio
      .play()
      .catch((err) => {
        console.log('Sound play failed:', err);
      });
  };

  const handleNavigation = (index) => {
    playSound('/sounds/click.wav');
    const route = NAV_ROUTES[index];
    addToHistory([{ type: 'info', text: `navigating to ${NAV_ITEMS[index]}...` }]);
    playSound(clickSoundRef);
    setTimeout(() => navigate(route), 100);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        playSound(arrowSoundRef);
        setSelectedNav((prev) => (prev + 1) % NAV_ITEMS.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        playSound(arrowSoundRef);
        setSelectedNav((prev) => (prev - 1 + NAV_ITEMS.length) % NAV_ITEMS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setSelectedNav((prev) => {
          handleNavigation(prev);
          return prev;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleReset = async () => {
    if (resetWorking) return;
    playSound('/sounds/click.wav');
    const proceed = window.confirm('Reset all interviews? This cannot be undone.');
    if (!proceed) return;
    setResetWorking(true);
    setResetStatus('');
    try {
      const res = await fetch(`${API_BASE}/interviews/reset`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Reset failed');
      setResetStatus('All interviews cleared');
    } catch (err) {
      setResetStatus(err.message || 'Reset failed');
    } finally {
      setResetWorking(false);
    }
  };

  return (
    <div className="terminal-page">
      <div className="noise-layer" aria-hidden="true"></div>

      <div className="panel">
        <div className="panel-actions">
          <button
            className="ghost-btn"
            type="button"
            onClick={handleReset}
            disabled={resetWorking}
          >
            Reset all
          </button>
          {resetStatus && <span className="ghost-note">{resetStatus}</span>}
        </div>
        <p className="title">murder-at-midnight terminal</p>

        <div className="nav-list">
          {NAV_ITEMS.map((item, idx) => (
            <button
              key={item}
              className={`nav-item ${selectedNav === idx ? 'active' : ''}`}
              onClick={() => handleNavigation(idx)}
            >
              <span className="caret">&gt;</span>
              <span className="nav-text">{item}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="pill right-pill">
        <span className="arrow">▲</span>
        <span className="arrow">▼</span>
        <span className="pill-text">try using arrow keys!</span>
      </div>

      <audio
        ref={arrowSoundRef}
        src="/sounds/press.mp3"
        preload="auto"
      />
      <audio
        ref={clickSoundRef}
        src="/sounds/click.mp3"
        preload="auto"
      />
    </div>
  );
}
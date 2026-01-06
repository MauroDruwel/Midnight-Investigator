import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './components/terminal.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

export default function AddInterviewLanding() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/interviews`);
        if (!res.ok) throw new Error('Failed to fetch interviews');
        const data = await res.json();
        if (!cancelled) {
          const visible = Array.isArray(data)
            ? data.filter(iv => iv && typeof iv === 'object' && typeof iv.name === 'string' && iv.name.trim() !== '')
            : [];
          setInterviews(visible);
        }
      } catch (err) {
        /* no-op: keep page simple */
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddInterview = () => {
    navigate('/add-interview/new');
  };

  return (
    <div className="terminal-page">
      <div className="noise-layer" aria-hidden="true"></div>

      <div
        style={{
          position: 'relative',
          width: 'min(90vw, 1200px)',
          zIndex: 1,
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: 700,
            color: '#fff3d6',
            marginBottom: '48px',
            textAlign: 'center',
          }}
        >
          add interview
        </h1>

        <div
          style={{
            display: 'flex',
            gap: '24px',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
            {interviews.map((interview, idx) => (
            <div
                key={interview.name || interview.id || `iv-${idx}`}
              style={{
                width: '180px',
                height: '120px',
                background: '#2d2540',
                border: '3px solid #fff3d6',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
              }}
            >
              <span
                style={{
                  color: '#fff3d6',
                  fontSize: '18px',
                  fontWeight: 600,
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {interview.name}
              </span>
            </div>
          ))}

          <button
            onClick={handleAddInterview}
            style={{
              width: '180px',
              height: '120px',
              background: '#2d2540',
              border: '3px solid #ff6b6b',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 107, 107, 0.4)';
              e.currentTarget.style.background = '#3a2f52';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
              e.currentTarget.style.background = '#2d2540';
            }}
          >
            <span
              style={{
                color: '#ff6b6b',
                fontSize: '64px',
                fontWeight: 300,
                lineHeight: 1,
              }}
            >
              +
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

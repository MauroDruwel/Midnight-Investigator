import { useEffect, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function fetchInterviews() {
  const res = await fetch(`${API_BASE}/interviews`);
  if (!res.ok) throw new Error('Failed to load interviews');
  return res.json();
}

async function addInterview(payload) {
  const res = await fetch(`${API_BASE}/interview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to add interview');
  return res.json();
}

export default function App() {
  const [interviews, setInterviews] = useState([]);
  const [form, setForm] = useState({ name: '', mp3_path: '', guilt_level: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInterviews().then(setInterviews).catch((err) => setError(err.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await addInterview(form);
      const next = await fetchInterviews();
      setInterviews(next);
      setForm({ name: '', mp3_path: '', guilt_level: 0 });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="App">
      <h1>Interviews</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {interviews.map((iv, idx) => (
          <li key={idx}>
            <strong>{iv.name || 'Unnamed'}</strong> — guilt level {iv.guilt_level} — {iv.mp3_path}
          </li>
        ))}
      </ul>

      <h2>Add Interview</h2>
      <form onSubmit={submit}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="MP3 path"
          value={form.mp3_path}
          onChange={(e) => setForm({ ...form, mp3_path: e.target.value })}
        />
        <input
          type="number"
          placeholder="Guilt level"
          value={form.guilt_level}
          onChange={(e) => setForm({ ...form, guilt_level: Number(e.target.value) })}
        />
        <button type="submit">Save</button>
      </form>
    </div>
  );
}
import { useEffect, useState } from "react";
import "./App.css";
import VideoFeedback from "./VideoFeedback";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function fetchInterviews() {
  const res = await fetch(`${API_BASE}/interviews`);
  if (!res.ok) throw new Error("Failed to load interviews");
  return res.json();
}

export default function App() {
  const [interviews, setInterviews] = useState([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInterviews()
      .then(setInterviews)
      .catch((err) => setError(err.message));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name || !file) {
      setError("Name and audio file required");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/interview`, {
        method: "POST",
        body: formData, // ✅ FormData, not JSON
      });

      if (!res.ok) throw new Error("Upload failed");

      await fetchInterviews().then(setInterviews);
      setName("");
      setFile(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="App">
      <h1>Interview App</h1>

      {/* 🎥 LIVE CAMERA FEEDBACK */}
      <VideoFeedback />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <h2>Interviews</h2>
      <ul>
        {interviews.map((iv, idx) => (
          <li key={idx}>
            <strong>{iv.name}</strong> — guilt level {iv.guilt_level}
          </li>
        ))}
      </ul>

      <h2>Add Interview</h2>
      <form onSubmit={submit}>
        <input
          placeholder="Suspect name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button type="submit">Upload Interview</button>
      </form>
    </div>
  );
}

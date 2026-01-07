import { useEffect, useRef, useState } from "react";

export default function VideoFeedback() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [feedback, setFeedback] = useState("Starting camera…");

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        videoRef.current.srcObject = stream;
      })
      .catch(() => setFeedback("Camera permission denied"));
  }, []);

  useEffect(() => {
    const sendFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !video.videoWidth) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      const blob = await new Promise((res) =>
        canvas.toBlob(res, "image/jpeg", 0.8)
      );

      const form = new FormData();
      form.append("file", blob, "frame.jpg");

      const res = await fetch("http://localhost:8000/video-feedback", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      setFeedback(data.feedback || "No feedback");
    };

    const id = setInterval(sendFrame, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <h2>Live Video Feedback</h2>
      <video ref={videoRef} autoPlay playsInline width={320} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <pre>{feedback}</pre>
    </div>
  );
}

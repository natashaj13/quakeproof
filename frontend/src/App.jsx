import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [magnitude, setMagnitude] = useState(6.0);
  const [advice, setAdvice] = useState("");
  const [detections, setDetections] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false); // New lock state
  const [mode] = useState(new URLSearchParams(window.location.search).get("mode") || "laptop");

  const processFrame = async () => {
    // If a request is already out, don't send another one yet
    if (isProcessing || !webcamRef.current) return;

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) return;

    setIsProcessing(true); // Lock
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageSrc, magnitude: parseFloat(magnitude) })
      });

      if (!response.ok) throw new Error("Backend error");

      const data = await response.json();
      setDetections(data.detections);
      drawOnCanvas(data.detections);
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsProcessing(false); // Unlock
    }
  };

useEffect(() => {
  const interval = setInterval(processFrame, 200); // 5 FPS is plenty for a hackathon
  return () => clearInterval(interval);
}, [magnitude]); // This restarts the loop when magnitude changes

  const drawOnCanvas = (dets) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, 640, 480);
    ctx.font = "20px Arial";
    dets.forEach(d => {
      const [x1, y1, x2, y2] = d.bbox;
      ctx.strokeStyle = d.risk > 70 ? "red" : d.risk > 30 ? "orange" : "green";
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.fillStyle = "white";
      ctx.fillText(`${d.risk}%`, x1, y1 - 5);
    });
  };

  const getAdvice = async () => {
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detections })
    });
    const data = await res.json();
    setAdvice(data.advice);
  };

  useEffect(() => {
    const interval = setInterval(processFrame, 500); // Process 2 times per second
    return () => clearInterval(interval);
  }, [magnitude]);

  useEffect(() => {
    const sync = async () => {
      const res = await fetch("/api/state");
      const state = await res.json();
      
      if (mode === "phone") {
        setMagnitude(state.magnitude); // Phone gets magnitude from Laptop
      } else {
        setDetections(state.detections); // Laptop gets boxes from Phone
      }
    };
    const interval = setInterval(sync, 500);
    return () => clearInterval(interval);
  }, [mode]);

  if (mode === "phone") {
    return (
      <div className="relative w-screen h-screen">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            facingMode: "environment", // This forces the REAR camera
            width: { ideal: 640 },
            height: { ideal: 480 }
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw', // Make it responsive for phone screens
            height: 'auto',
            zIndex: 1
          }}
        />

        {/* Canvas must be ABSOLUTE and match the Video exactly */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '640px',
            height: '480px',
            zIndex: 2, // Sits on top of the webcam
            pointerEvents: 'none' // Allows clicks to pass through to the video if needed
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-10 bg-gray-900 text-white min-h-screen">
      <h1 className="text-4xl font-bold mb-8">Seismic Command Center</h1>
      
      {/* 1. Dashboard Visualization (Instead of Webcam) */}
      <div className="grid grid-cols-2 gap-8">
        <div className="bg-black p-4 rounded-xl border border-blue-500">
          <h2 className="mb-4">Live Object Stream</h2>
          <ul>
            {detections.map(d => (
              <li key={d.id} className={d.risk > 50 ? "text-red-400" : "text-green-400"}>
                {d.label}: {d.risk}% Fall Risk
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Controls */}
        <div>
          <label className="block mb-4 text-xl">Simulate Intensity: {magnitude}</label>
          <input 
            type="range" min="4" max="9" step="0.1" 
            value={magnitude} 
            onChange={async (e) => {
              const val = e.target.value;
              setMagnitude(val);
              await fetch("/api/update_magnitude", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({magnitude: val})
              });
            }}
            className="w-full h-4 bg-blue-700 rounded-lg appearance-none cursor-pointer"
          />
          
          <button onClick={getAdvice} className="mt-8 bg-blue-600 p-4 w-full rounded-xl text-2xl font-bold">
            Generate AI Remediation
          </button>
          
          {advice && <div className="mt-4 p-6 bg-gray-800 rounded-lg border-l-4 border-blue-500">{advice}</div>}
        </div>
      </div>
    </div>
  );

}

export default App;
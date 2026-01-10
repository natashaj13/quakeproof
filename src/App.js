import React, { useState, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { OrbitControls, Environment, Sky, Grid, useTexture } from '@react-three/drei'
import { GoogleGenerativeAI } from "@google/generative-ai"

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(API_KEY)

const PHYSICS_PROPS = {
  bookshelf: { size: [1.2, 4, 0.6], mass: 25, color: '#5d4037', hazardMsg: "Tipping Risk: High. Anchor to wall studs." },
  refrigerator: { size: [1.6, 3, 1.6], mass: 150, color: '#bdc3c7', hazardMsg: "Crush Hazard: High. Ensure door latches are secure." },
  chair: { size: [0.8, 1, 0.8], mass: 8, color: '#2c3e50', hazardMsg: "Sliding Hazard: Low. Use rubber floor grips." },
  table: { size: [3, 1, 2], mass: 45, color: '#8B4513', hazardMsg: "Stable base. Safe to duck under if reinforced." },
  lamp: { size: [0.4, 3.5, 0.4], mass: 5, color: '#f1c40f', hazardMsg: "Falling Hazard: High. Secure base or move away from beds." },
  tv: { size: [2.5, 1.5, 0.2], mass: 12, color: '#222', hazardMsg: "Impact Hazard: Use mounting brackets or safety straps." },
  plant: { size: [0.7, 1.5, 0.7], mass: 10, color: '#27ae60', hazardMsg: "Spillage/Fall Hazard: Use heavy ceramic pots." }
}

function PhotoPlane({ url }) {
  const texture = useTexture(url)
  return (
    <mesh position={[0, 8, -15]} scale={[40, 20, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent opacity={0.3} />
    </mesh>
  )
}

function Room({ magnitude }) {
  const rigidBody = useRef()
  useFrame(({ clock }) => {
    if (!rigidBody.current || magnitude === 0) return
    const t = clock.getElapsedTime()
    const intensity = Math.pow(magnitude / 9, 3)
    const freq = 12 + magnitude * 2
    const amp = intensity * 0.2
    rigidBody.current.setNextKinematicTranslation({
      x: Math.sin(t * freq) * amp,
      y: 0,
      z: Math.cos(t * freq * 1.1) * amp
    })
  })
  return (
    <RigidBody ref={rigidBody} type="kinematicPosition" colliders={false}>
      <CuboidCollider args={[25, 0.1, 25]} friction={4.0} restitution={0} />
      <Grid infiniteGrid fadeDistance={50} sectionColor="#333" cellColor="#111" />
    </RigidBody>
  )
}

export default function App() {
  const [magnitude, setMagnitude] = useState(0)
  const [previewImage, setPreviewImage] = useState(null)
  const [detectedObjects, setDetectedObjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("Awaiting room walkthrough video...")

  const analyzeVideo = async (file) => {
    setLoading(true)
    setStatus("Extracting frames...")

    try {
      const video = document.createElement('video')
      video.src = URL.createObjectURL(file)
      video.muted = true
      video.playsInline = true
      video.crossOrigin = "anonymous"

      await new Promise(r => video.onloadedmetadata = r)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const frames = []

      const captureTimes = [0.1, video.duration * 0.4, video.duration * 0.7, video.duration - 0.2]

      for (const time of captureTimes) {
        video.currentTime = time
        await new Promise(r => video.onseeked = r)
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const base64 = canvas.toDataURL('image/jpeg', 0.3).split(',')[1]
        frames.push({ inlineData: { data: base64, mimeType: "image/jpeg" } })
        if (time === 0.1) setPreviewImage(canvas.toDataURL('image/jpeg'))
      }

      setStatus("Analyzing with Gemini 2.5 Vision...")

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const prompt = `
Return ONLY raw JSON array.
Objects: bookshelf, refrigerator, chair, table, lamp, tv, plant.
Format: [{"type":"table","x":2,"z":-5}]
Camera at (0,0,0). X:-10..10, Z:-15..0.
No explanation. No markdown. Only JSON.
`

      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...frames
            ]
          }
        ]
      })

      const text = result.response.text()
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start === -1 || end === -1) throw new Error("No JSON in Gemini response")

      const parsed = JSON.parse(text.slice(start, end + 1))
      setDetectedObjects(parsed)
      setStatus(`Reconstruction Success: Found ${parsed.length} objects.`)

    } catch (err) {
      console.error("FULL ERROR:", err)
      setStatus("Gemini Error: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (file) analyzeVideo(file)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', fontFamily: 'monospace' }}>
      <div style={{
        position: 'absolute', zIndex: 10, padding: '25px', color: 'white',
        background: 'rgba(0,0,0,0.9)', width: '380px', height: '100vh',
        borderRight: '1px solid #333', display: 'flex', flexDirection: 'column'
      }}>
        <h1 style={{ color: '#00ffcc', letterSpacing: '2px', fontSize: '24px', margin: 0 }}>QUAKEPROOF AI</h1>
        <p style={{ color: '#888', fontSize: '11px', marginBottom: '20px' }}>v2.5 // SPATIAL VIDEO RECONSTRUCTION</p>

        <div style={{ padding: '15px', border: '1px dashed #444', borderRadius: '8px', background: '#0a0a0a' }}>
          <label style={{ color: '#888', display: 'block', fontSize: '10px', marginBottom: '8px' }}>UPLOAD WALKTHROUGH</label>
          <input type="file" accept="video/*" onChange={handleUpload} style={{ width: '100%', color: '#888' }} />
          <p style={{ fontSize: '11px', color: loading ? '#ffcc00' : '#00ffcc', marginTop: '12px' }}>{status}</p>
        </div>

        {detectedObjects.length > 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: '20px' }}>
            <div style={{ background: '#111', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #222' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '12px' }}>
                SEISMIC MAGNITUDE: <span style={{ color: '#00ffcc' }}>{magnitude}Mw</span>
            </label>
            <input 
                type="range" min="0" max="9" step="0.1" 
                style={{ width: '100%', accentColor: '#00ffcc', cursor: 'pointer' }} 
                value={magnitude} 
                onChange={(e) => setMagnitude(parseFloat(e.target.value))} 
            />
            <button 
                onClick={() => setMagnitude(0)} 
                style={{ marginTop: '10px', width: '100%', padding: '8px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
                RESET SIMULATION
            </button>
            </div>
        </div>
        )}
      </div>

      <Canvas shadows camera={{ position: [12, 12, 12], fov: 40 }}>
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[15, 15, 15]} castShadow intensity={1.2} />

        <Suspense fallback={null}>
          {previewImage && <PhotoPlane url={previewImage} />}

          <Physics gravity={[0, -9.81, 0]}>
            <Room magnitude={magnitude} />

            {detectedObjects.map((obj, i) => {
              const data = PHYSICS_PROPS[obj.type] || PHYSICS_PROPS.chair
              return (
                <RigidBody
                  key={`${obj.type}-${i}`}
                  position={[obj.x, data.size[1] / 2 + 2, obj.z]}
                  colliders="cuboid"
                  mass={data.mass}
                  linearDamping={0.5}
                  angularDamping={0.5}
                >
                  <mesh castShadow>
                    <boxGeometry args={data.size} />
                    <meshStandardMaterial color={data.color} metalness={0.6} roughness={0.2} />
                  </mesh>
                </RigidBody>
              )
            })}
          </Physics>
        </Suspense>

        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
        <Environment preset="city" />
      </Canvas>
    </div>
  )
}
